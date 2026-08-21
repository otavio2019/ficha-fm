import { fmAttributeKeys, type FMAttributeKey, type FMAttributes, type FMCharacterSheet, type FMModifierDefinition, type FMModifierTarget, type FMRequirement } from "./fmTypes";

export type FMModifierSourceType = "permanent" | "origin" | "race" | "evolution" | "training" | "aptitude" | "equipment" | "cursed-tool" | "vow" | "technique" | "domain" | "invocation";
export type FMModifierSource = { type: FMModifierSourceType; id: string; name: string; enabled: boolean; requirements: FMRequirement[]; modifiers: FMModifierDefinition[] };
export type FMAppliedModifier = { id: string; sourceId: string; sourceName: string; sourceType: FMModifierSourceType; target: FMModifierTarget; value: number; note: string };
export type FMRequirementCheck = { sourceId: string; sourceName: string; requirement: FMRequirement; met: boolean; message: string };
export type FMValueBreakdown = { base: number; entries: FMAppliedModifier[]; final: number };
export type FMCharacterState = {
  attributes: FMAttributes;
  attributeBreakdown: Record<FMAttributeKey, FMValueBreakdown>;
  derivedModifiers: Record<Exclude<FMModifierTarget, FMAttributeKey>, number>;
  derivedBreakdown: Record<Exclude<FMModifierTarget, FMAttributeKey>, FMValueBreakdown>;
  appliedModifiers: FMAppliedModifier[];
  requirements: FMRequirementCheck[];
};

const derivedTargets = ["healthMaximum", "energyMaximum", "attention", "defense", "initiative", "movement", "techniqueDc"] as const;

export const FM_MODIFIER_TARGET_LABELS: Record<FMModifierTarget, string> = {
  strength: "Força", dexterity: "Destreza", constitution: "Constituição", intelligence: "Inteligência", wisdom: "Sabedoria", presence: "Presença",
  healthMaximum: "PV máximo", energyMaximum: "Energia máxima", attention: "Atenção", defense: "Defesa", initiative: "Iniciativa", movement: "Deslocamento", techniqueDc: "CD da técnica",
};

const source = (type: FMModifierSourceType, id: string, name: string, enabled: boolean, modifiers: FMModifierDefinition[] | undefined, requirements: FMRequirement[] | undefined = []): FMModifierSource => ({ type, id, name, enabled, modifiers: modifiers ?? [], requirements: requirements ?? [] });

function getRequirementAttributes(sheet: FMCharacterSheet): FMAttributes {
  return Object.fromEntries(fmAttributeKeys.map(attribute => [attribute, sheet.attributes.base[attribute] + sheet.attributes.permanentBonuses[attribute] + (sheet.origin.attributeBonuses[attribute] ?? 0)])) as FMAttributes;
}

export function formatRequirement(requirement: FMRequirement) {
  if (requirement.type === "attribute-min") return `Requer ${FM_MODIFIER_TARGET_LABELS[requirement.attribute]} ${requirement.minimum}.`;
  if (requirement.type === "level-min") return `Requer nível ${requirement.minimum}.`;
  if (requirement.type === "aptitude") return `Requer a Aptidão ${requirement.aptitudeId}.`;
  if (requirement.type === "training") return `Requer o Treinamento ${requirement.trainingId}.`;
  if (requirement.type === "race") return `Requer a Raça ${requirement.raceId}.`;
  return `Requer a Origem ${requirement.originId}.`;
}

export function requirementIsMet(sheet: FMCharacterSheet, requirement: FMRequirement, attributes = getRequirementAttributes(sheet)) {
  if (requirement.type === "attribute-min") return attributes[requirement.attribute] >= requirement.minimum;
  if (requirement.type === "level-min") return sheet.progression.level >= requirement.minimum;
  if (requirement.type === "aptitude") return sheet.aptitudes.some(aptitude => aptitude.catalogId === requirement.aptitudeId || aptitude.homebrewId === requirement.aptitudeId || aptitude.name === requirement.aptitudeId);
  if (requirement.type === "training") return sheet.training.some(training => training.trackId === requirement.trainingId || training.homebrewId === requirement.trainingId || training.label === requirement.trainingId);
  if (requirement.type === "race") return sheet.mechanics.race?.id === requirement.raceId || sheet.mechanics.race?.sourceId === requirement.raceId || sheet.mechanics.race?.name === requirement.raceId;
  return sheet.origin.catalogId === requirement.originId || sheet.origin.clanId === requirement.originId || sheet.origin.name === requirement.originId || sheet.origin.clan === requirement.originId;
}

export function getCharacterModifierSources(sheet: FMCharacterSheet): FMModifierSource[] {
  const sources: FMModifierSource[] = [];
  fmAttributeKeys.forEach(attribute => sources.push(source("permanent", `permanent:${attribute}`, "Bônus permanente", true, [{ id: `permanent:${attribute}`, target: attribute, operation: "add", value: sheet.attributes.permanentBonuses[attribute], note: "Bônus permanente declarado na ficha." }])));
  const originName = sheet.origin.clan || sheet.origin.name || "Origem";
  fmAttributeKeys.forEach(attribute => sources.push(source("origin", `origin:${attribute}`, originName, true, [{ id: `origin:${attribute}`, target: attribute, operation: "add", value: sheet.origin.attributeBonuses[attribute] ?? 0, note: "Bônus de atributo da origem." }])));
  const race = sheet.mechanics.race;
  if (race) {
    const evolution = race.evolutions.find(item => item.id === race.selectedEvolutionId);
    if (!evolution || evolution.replacesBaseModifiers === false) sources.push(source("race", race.id, race.name, race.active, race.modifiers, race.requirements));
    if (evolution) sources.push(source("evolution", evolution.id, evolution.name, race.active, evolution.modifiers, [...race.requirements, ...evolution.requirements]));
  }
  sheet.training.forEach(training => sources.push(source("training", training.homebrewId ?? training.trackId, training.label ?? training.trackId, training.stage > 0, training.modifiers, training.requirements)));
  sheet.aptitudes.forEach(aptitude => sources.push(source("aptitude", aptitude.homebrewId ?? aptitude.catalogId, aptitude.name, aptitude.approved, aptitude.modifiers, aptitude.requirements)));
  sheet.equipment.forEach(item => sources.push(source("equipment", item.id, item.name, item.equipped, item.modifiers, item.requirements)));
  sheet.cursedTools.forEach(tool => sources.push(source("cursed-tool", tool.id, tool.name, Boolean(tool.approved && tool.equipped), tool.modifiers, tool.mechanicalRequirements)));
  const vow = sheet.houseRules.birthVow;
  sources.push(source("vow", `birth-vow:${vow.type}`, "Voto de nascimento", Boolean(vow.type !== "none" && vow.approved && vow.active !== false), vow.modifiers, vow.requirements));
  sources.push(source("technique", sheet.techniqueLibraryId ?? "sheet-technique", sheet.technique.name || "Técnica", Boolean(sheet.technique.name.trim()), sheet.technique.modifiers, sheet.technique.requirements));
  if (sheet.domainExpansion) sources.push(source("domain", "domain-expansion", sheet.domainExpansion.name || "Expansão de Domínio", Boolean(sheet.domainExpansion.approved && sheet.domainExpansion.active), sheet.domainExpansion.modifiers, sheet.domainExpansion.requirements));
  sheet.invocations.forEach(invocation => sources.push(source("invocation", invocation.id, invocation.name, invocation.active, invocation.modifiers, invocation.requirements)));
  return sources;
}

export function calculateCharacterState(sheet: FMCharacterSheet): FMCharacterState {
  const attributes = Object.fromEntries(fmAttributeKeys.map(attribute => [attribute, sheet.attributes.base[attribute]])) as FMAttributes;
  const attributeBreakdown = Object.fromEntries(fmAttributeKeys.map(attribute => [attribute, { base: sheet.attributes.base[attribute], entries: [], final: sheet.attributes.base[attribute] }])) as unknown as Record<FMAttributeKey, FMValueBreakdown>;
  const derivedModifiers = Object.fromEntries(derivedTargets.map(target => [target, 0])) as FMCharacterState["derivedModifiers"];
  const derivedBreakdown = Object.fromEntries(derivedTargets.map(target => [target, { base: 0, entries: [], final: 0 }])) as unknown as FMCharacterState["derivedBreakdown"];
  const appliedModifiers: FMAppliedModifier[] = [];
  const sources = getCharacterModifierSources(sheet);
  const requirementAttributes = getRequirementAttributes(sheet);
  const requirements = sources.flatMap(item => item.requirements.map(requirement => ({ sourceId: item.id, sourceName: item.name, requirement, met: requirementIsMet(sheet, requirement, requirementAttributes), message: formatRequirement(requirement) })));
  const sourceMet = new Map(sources.map(item => [item.id, item.enabled && requirements.filter(result => result.sourceId === item.id).every(result => result.met)]));
  for (const item of sources) {
    if (!sourceMet.get(item.id)) continue;
    for (const modifier of item.modifiers) {
      if (modifier.active === false || !modifier.value || (modifier.conditions && !modifier.conditions.every(condition => requirementIsMet(sheet, condition, requirementAttributes)))) continue;
      const applied: FMAppliedModifier = { id: modifier.id, sourceId: item.id, sourceName: item.name, sourceType: item.type, target: modifier.target, value: modifier.value, note: modifier.note ?? "" };
      appliedModifiers.push(applied);
      if (fmAttributeKeys.includes(modifier.target as FMAttributeKey)) {
        const attribute = modifier.target as FMAttributeKey;
        attributes[attribute] += modifier.value;
        attributeBreakdown[attribute].entries.push(applied);
        attributeBreakdown[attribute].final = attributes[attribute];
      } else {
        const target = modifier.target as keyof typeof derivedModifiers;
        derivedModifiers[target] += modifier.value;
        derivedBreakdown[target].entries.push(applied);
        derivedBreakdown[target].final = derivedModifiers[target];
      }
    }
  }
  return { attributes, attributeBreakdown, derivedModifiers, derivedBreakdown, appliedModifiers, requirements };
}
