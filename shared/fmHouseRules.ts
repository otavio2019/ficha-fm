import { fmAttributeKeys, type FMHouseAttributeGeneration, type FMHouseRules } from "./fmTypes";
import type { InfiniteWorldGradeId } from "./infiniteWorlds";

export const FM_HOUSE_RULES_CITATION = "Regras da Casa Infinite Worlds, I–XII";
export const HOUSE_SHORT_REST_MS = 2 * 60 * 60 * 1000;
export const HOUSE_LONG_REST_MS = 4 * 60 * 60 * 1000;

const attributeKeySet = new Set<string>(fmAttributeKeys);

export function rollHouseAttributeGeneration(random: () => number = Math.random): FMHouseAttributeGeneration {
  let attempts = 0;
  let values: number[] = [];
  let total = 0;
  do {
    attempts += 1;
    values = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => Math.floor(Math.min(0.999999, Math.max(0, random())) * 6) + 1).sort((a, b) => a - b).slice(1).reduce((sum, value) => sum + value, 0));
    total = values.reduce((sum, value) => sum + value, 0);
  } while (total < 72 && attempts < 1000);
  return { values, total, attempts, generatedAt: Date.now() };
}

export function getHouseRestAvailability(rest: FMHouseRules["rest"], now = Date.now()) {
  const lastMissionAt = rest.lastMissionAt ?? 0;
  const elapsed = Math.max(0, now - lastMissionAt);
  const shortRestReady = rest.missionCount > 0 && elapsed >= HOUSE_SHORT_REST_MS;
  const longRestReady = rest.missionCount > 0 && elapsed >= HOUSE_LONG_REST_MS && rest.longRestMissionCount !== rest.missionCount;
  return { shortRestReady, longRestReady, shortRestRemaining: Math.max(0, HOUSE_SHORT_REST_MS - elapsed), longRestRemaining: Math.max(0, HOUSE_LONG_REST_MS - elapsed) };
}

export function getHouseMinimumHealth(healthMaximum: number, healthBonus: number) {
  return Math.max(1, healthMaximum - healthBonus);
}

export function getMassiveDamageOutcome(currentHealth: number, healthMaximum: number, damage: number) {
  const nextHealth = currentHealth - Math.max(0, damage);
  return { nextHealth, instantDeath: nextHealth <= -Math.max(1, healthMaximum) };
}

export function getDedicationRewardGrade(grade: InfiniteWorldGradeId, enabled: boolean): InfiniteWorldGradeId {
  if (!enabled) return grade;
  const order: InfiniteWorldGradeId[] = ["fourth", "third", "second", "first", "special"];
  return order[Math.min(order.length - 1, Math.max(0, order.indexOf(grade)) + 1)] ?? grade;
}

export function validateHouseRules(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const house = value as Partial<FMHouseRules>;
  const issues: string[] = [];
  const generation = house.attributeGeneration;
  if (generation && (!Array.isArray(generation.values) || generation.values.length !== 6 || generation.values.some(attribute => !Number.isInteger(attribute) || attribute < 3 || attribute > 18) || !Number.isInteger(generation.total) || generation.total < 72)) issues.push("A geração de atributos deve registrar seis valores válidos e total mínimo de 72.");
  const vow = house.birthVow;
  if (vow && !["none", "congenital-restriction", "celestial-restriction"].includes(vow.type)) issues.push("O voto de nascimento informado é inválido.");
  if (vow?.locked && vow.type === "none") issues.push("Um voto bloqueado precisa ter um tipo definido.");
  const declaration = house.actionDeclaration;
  if (declaration?.locked && (!declaration.attribute || !attributeKeySet.has(declaration.attribute))) issues.push("Uma ação bloqueada precisa manter o atributo declarado.");
  const rest = house.rest;
  if (rest && (!Number.isInteger(rest.exhaustion) || rest.exhaustion < 0 || !Number.isInteger(rest.missionCount) || rest.missionCount < 0)) issues.push("Exaustão e contagem de missões devem ser inteiros não negativos.");
  const freeBuildOptions = house.downtime?.freeBuildOptions;
  if (freeBuildOptions && freeBuildOptions.some(option => option.interludeCost !== 1 || !option.name.trim() || !option.prerequisites.trim() || option.sourceSpecialization === "restricted")) issues.push("Toda opção de Free Build exige nome, pré-requisitos, custo de 1 Interlúdio e origem diferente de Restringido.");
  return issues;
}
