import { getAptitudeDefinition } from "./fmCampaignCapabilities";
import { formatRequirement, requirementIsMet } from "./fmCharacterState";
import type { FMAptitudeProgression, FMAptitudeProgressionRecord, FMCharacterSheet } from "./fmTypes";

export const FM_APTITUDE_MAX_LEVEL = 5;

export function getAptitudeIncreaseSlots(level: number): number {
  const normalized = Math.max(1, Math.min(30, Math.floor(level)));
  return Math.floor(normalized / 2) + Math.floor(normalized / 10);
}

export function normalizeAptitudeProgression(sheet: Pick<FMCharacterSheet, "aptitudes" | "progression" | "aptitudeProgression">): FMAptitudeProgression {
  const existing = sheet.aptitudeProgression ?? { levels: {}, history: [] };
  const levels = { ...existing.levels };
  const aptitudes = Array.isArray(sheet.aptitudes) ? sheet.aptitudes : [];
  for (const aptitude of aptitudes) {
    const key = aptitude.catalogId || aptitude.id;
    if (!Number.isInteger(levels[key])) levels[key] = 1;
    levels[key] = Math.max(0, Math.min(FM_APTITUDE_MAX_LEVEL, Number(levels[key])));
  }
  return {
    levels,
    history: Array.isArray(existing.history) ? existing.history.filter(item => item && typeof item === "object") : [],
  };
}

export function getAptitudeLevel(sheet: Pick<FMCharacterSheet, "aptitudes" | "progression" | "aptitudeProgression">, aptitudeId: string): number {
  const progression = normalizeAptitudeProgression(sheet);
  const aptitudes = Array.isArray(sheet.aptitudes) ? sheet.aptitudes : [];
  const aptitude = aptitudes.find(item => item.id === aptitudeId || item.catalogId === aptitudeId || item.homebrewId === aptitudeId || item.name === aptitudeId);
  const key = aptitude?.catalogId || aptitude?.id || aptitudeId;
  return progression.levels[key] ?? 0;
}

export function getAptitudeProgressionSummary(sheet: Pick<FMCharacterSheet, "aptitudes" | "progression" | "aptitudeProgression">) {
  const progression = normalizeAptitudeProgression(sheet);
  const total = getAptitudeIncreaseSlots(Number(sheet.progression?.level) || 1);
  const spent = progression.history.length;
  const eligible = (Array.isArray(sheet.aptitudes) ? sheet.aptitudes : []).filter(aptitude => getAptitudeLevel(sheet, aptitude.catalogId || aptitude.id) < FM_APTITUDE_MAX_LEVEL);
  return { total, spent, available: Math.max(0, total - spent), eligible, progression };
}

export function getAptitudeIncreaseEligibility(sheet: FMCharacterSheet, aptitudeId: string) {
  const aptitude = sheet.aptitudes.find(item => item.id === aptitudeId || item.catalogId === aptitudeId || item.homebrewId === aptitudeId || item.name === aptitudeId);
  if (!aptitude) return { allowed: false, reasons: ["A Aptidão precisa estar adquirida na ficha antes de receber progressão."] };
  const summary = getAptitudeProgressionSummary(sheet);
  const currentLevel = getAptitudeLevel(sheet, aptitude.catalogId || aptitude.id);
  const definition = aptitude.homebrewId ? null : getAptitudeDefinition({
    id: aptitude.catalogId,
    name: aptitude.name,
    group: aptitude.group,
    requiredLevel: aptitude.requiredLevel,
    cost: aptitude.cost,
    prerequisite: aptitude.prerequisite,
    effect: aptitude.effect,
    description: aptitude.description,
    requirements: aptitude.requirements,
    modifiers: aptitude.modifiers,
    effects: aptitude.effects,
    limitations: aptitude.limitations,
    evolutions: aptitude.evolutions,
  });
  const reasons = [
    ...(summary.available <= 0 ? ["Nenhum aumento de Aptidão está disponível neste nível."] : []),
    ...(currentLevel >= FM_APTITUDE_MAX_LEVEL ? [`A Aptidão já está no nível máximo ${FM_APTITUDE_MAX_LEVEL}.`] : []),
    ...(sheet.progression.level < aptitude.requiredLevel ? [`Requer nível ${aptitude.requiredLevel} do personagem.`] : []),
    ...(definition ? definition.requirements.filter(requirement => !requirementIsMet(sheet, requirement)).map(formatRequirement) : []),
  ];
  return { allowed: reasons.length === 0, reasons, currentLevel, nextLevel: currentLevel + 1 };
}

export function increaseAptitude(sheet: FMCharacterSheet, aptitudeId: string, source = "Progressão de Personagem"): { sheet: FMCharacterSheet; record: FMAptitudeProgressionRecord } | { error: string } {
  const eligibility = getAptitudeIncreaseEligibility(sheet, aptitudeId);
  if (!eligibility.allowed) return { error: eligibility.reasons[0] ?? "Aumento de Aptidão inválido." };
  const aptitude = (Array.isArray(sheet.aptitudes) ? sheet.aptitudes : []).find(item => item.id === aptitudeId || item.catalogId === aptitudeId || item.homebrewId === aptitudeId || item.name === aptitudeId)!;
  const key = aptitude.catalogId || aptitude.id;
  const progression = normalizeAptitudeProgression(sheet);
  const previousLevel = eligibility.currentLevel ?? 0;
  const newLevel = eligibility.nextLevel ?? previousLevel + 1;
  const record: FMAptitudeProgressionRecord = {
    id: crypto.randomUUID(),
    aptitudeId: key,
    aptitudeName: aptitude.name,
    previousLevel,
    newLevel,
    characterLevel: sheet.progression.level,
    source,
    at: Date.now(),
    rulesVersion: sheet.rulesVersion ?? "2.5.2",
    sheetVersion: sheet.version,
  };
  return {
    sheet: { ...sheet, aptitudeProgression: { levels: { ...progression.levels, [key]: newLevel }, history: [...progression.history, record] } },
    record,
  };
}

export function validateAptitudeProgression(sheet: FMCharacterSheet): string[] {
  const summary = getAptitudeProgressionSummary(sheet);
  const errors: string[] = [];
  if (summary.spent > summary.total) errors.push(`A ficha registra ${summary.spent} aumento(s), mas o nível ${Number(sheet.progression?.level) || 1} libera apenas ${summary.total}.`);
  const aptitudes = Array.isArray(sheet.aptitudes) ? sheet.aptitudes : [];
  for (const [aptitudeId, level] of Object.entries(summary.progression.levels)) {
    if (!aptitudes.some(item => item.catalogId === aptitudeId || item.id === aptitudeId)) errors.push(`A progressão referencia a Aptidão ${aptitudeId}, que não está adquirida na ficha.`);
    if (!Number.isInteger(level) || level < 0 || level > FM_APTITUDE_MAX_LEVEL) errors.push(`A Aptidão ${aptitudeId} possui nível inválido.`);
  }
  return errors;
}
