import { fmAttributeKeys, type FMAttributeKey, type FMAttributes, type FMAptitudeEffect, type FMCharacterSheet, type FMModifierDefinition, type FMModifierTarget, type FMRequirement, type FMSkill } from "./fmTypes";

export type FMModifierSourceType = "permanent" | "origin" | "race" | "evolution" | "training" | "aptitude" | "equipment" | "cursed-tool" | "vow" | "technique" | "domain" | "invocation";
export type FMModifierSource = { type: FMModifierSourceType; id: string; name: string; enabled: boolean; requirements: FMRequirement[]; modifiers: FMModifierDefinition[]; effects: FMAptitudeEffect[] };
export type FMAppliedModifier = { id: string; sourceId: string; sourceName: string; sourceType: FMModifierSourceType; target: FMModifierTarget; value: number; note: string };
export type FMAppliedSkillEffect = { id: string; sourceId: string; sourceName: string; sourceType: FMModifierSourceType; skillId: string; value: number; note: string };
export type FMRequirementCheck = { sourceId: string; sourceName: string; requirement: FMRequirement; met: boolean; message: string };
export type FMValueBreakdown = { base: number; entries: FMAppliedModifier[] | FMAppliedSkillEffect[]; final: number };
export type FMCharacterUnlock = { id: string; sourceId: string; sourceName: string; target: "technique" | "ability" | "training" | "vow" | "item"; referenceId: string; label: string; description: string };
export type FMCharacterFeature = { id: string; sourceId: string; sourceName: string; label: string; description: string };
export type FMCharacterState = {
  attributes: FMAttributes;
  attributeBreakdown: Record<FMAttributeKey, FMValueBreakdown>;
  derivedModifiers: Record<Exclude<FMModifierTarget, FMAttributeKey>, number>;
  derivedBreakdown: Record<Exclude<FMModifierTarget, FMAttributeKey>, FMValueBreakdown>;
  skillModifiers: Record<string, number>;
  skillBreakdown: Record<string, FMValueBreakdown>;
  appliedModifiers: FMAppliedModifier[];
  appliedSkillEffects: FMAppliedSkillEffect[];
  unlocks: FMCharacterUnlock[];
  features: FMCharacterFeature[];
  requirements: FMRequirementCheck[];
};

const derivedTargets = ["healthMaximum", "energyMaximum", "attention", "defense", "initiative", "movement", "techniqueDc"] as const;

export const FM_MODIFIER_TARGET_LABELS: Record<FMModifierTarget, string> = {
  strength: "Força", dexterity: "Destreza", constitution: "Constituição", intelligence: "Inteligência", wisdom: "Sabedoria", presence: "Presença",
  healthMaximum: "PV máximo", energyMaximum: "Energia máxima", attention: "Atenção", defense: "Defesa", initiative: "Iniciativa", movement: "Deslocamento", techniqueDc: "CD da técnica",
};

const source = (type: FMModifierSourceType, id: string, name: string, enabled: boolean, modifiers: FMModifierDefinition[] | undefined, requirements: FMRequirement[] | undefined = [], effects: FMAptitudeEffect[] | undefined = []): FMModifierSource => ({ type, id, name, enabled, modifiers: modifiers ?? [], requirements: requirements ?? [], effects: effects ?? [] });
const matchesSkill = (skill: Pick<FMSkill, "id" | "catalogId" | "name">, reference: string) => skill.id === reference || skill.catalogId === reference || skill.name === reference;

function addAttributeModifiers(attributes: FMAttributes, modifiers: FMModifierDefinition[] | undefined) {
  modifiers?.forEach(modifier => { if (modifier.active !== false && fmAttributeKeys.includes(modifier.target as FMAttributeKey)) attributes[modifier.target as FMAttributeKey] += modifier.value; });
}
function getRequirementAttributes(sheet: FMCharacterSheet): FMAttributes {
  const attributes = Object.fromEntries(fmAttributeKeys.map(attribute => [attribute, sheet.attributes.base[attribute] + sheet.attributes.permanentBonuses[attribute] + (sheet.origin.attributeBonuses[attribute] ?? 0)])) as FMAttributes;
  const race = sheet.mechanics.race;
  if (race?.active) {
    const evolution = race.evolutions.find(item => item.id === race.selectedEvolutionId);
    if (!evolution || evolution.replacesBaseModifiers === false) addAttributeModifiers(attributes, race.modifiers);
    if (evolution) addAttributeModifiers(attributes, evolution.modifiers);
  }
  sheet.training.filter(item => item.stage > 0).forEach(item => addAttributeModifiers(attributes, item.modifiers));
  return attributes;
}

export function formatRequirement(requirement: FMRequirement): string {
  if (requirement.type === "attribute-min") return `Requer ${FM_MODIFIER_TARGET_LABELS[requirement.attribute]} ${requirement.minimum}.`;
  if (requirement.type === "level-min") return `Requer nível ${requirement.minimum}.`;
  if (requirement.type === "aptitude") return `Requer a Aptidão ${requirement.aptitudeId}.`;
  if (requirement.type === "training") return `Requer o Treinamento ${requirement.trainingId}.`;
  if (requirement.type === "race") return `Requer a Raça ${requirement.raceId}.`;
  if (requirement.type === "origin") return `Requer a Origem ${requirement.originId}.`;
  if (requirement.type === "skill-min") return `Requer a Perícia ${requirement.skillId} ${requirement.minimum}.`;
  if (requirement.type === "grade") return `Requer o Grau ${requirement.grade}.`;
  if (requirement.type === "technique") return `Requer a Técnica ${requirement.techniqueId}.`;
  if (requirement.type === "vow") return `Requer o Voto ${requirement.vowType}.`;
  if (requirement.type === "item") return `Requer o Item ${requirement.itemId}.`;
  return `Requer ${requirement.requirements.map(formatRequirement).join(requirement.type === "all" ? " e " : " ou ")}`;
}

export function requirementIsMet(sheet: FMCharacterSheet, requirement: FMRequirement, attributes = getRequirementAttributes(sheet)): boolean {
  if (requirement.type === "attribute-min") return attributes[requirement.attribute] >= requirement.minimum;
  if (requirement.type === "level-min") return sheet.progression.level >= requirement.minimum;
  if (requirement.type === "aptitude") return sheet.aptitudes.some(aptitude => aptitude.catalogId === requirement.aptitudeId || aptitude.homebrewId === requirement.aptitudeId || aptitude.name === requirement.aptitudeId);
  if (requirement.type === "training") return sheet.training.some(training => training.trackId === requirement.trainingId || training.homebrewId === requirement.trainingId || training.label === requirement.trainingId);
  if (requirement.type === "race") return sheet.mechanics.race?.id === requirement.raceId || sheet.mechanics.race?.sourceId === requirement.raceId || sheet.mechanics.race?.name === requirement.raceId;
  if (requirement.type === "origin") return sheet.origin.catalogId === requirement.originId || sheet.origin.clanId === requirement.originId || sheet.origin.name === requirement.originId || sheet.origin.clan === requirement.originId;
  if (requirement.type === "skill-min") { const skill = sheet.skills.find(item => matchesSkill(item, requirement.skillId)); return Boolean(skill && attributes[skill.attribute] + skill.otherBonus >= requirement.minimum); }
  if (requirement.type === "grade") return sheet.identity.grade === requirement.grade;
  if (requirement.type === "technique") return sheet.techniqueLibraryId === requirement.techniqueId || sheet.technique.name === requirement.techniqueId;
  if (requirement.type === "vow") return sheet.houseRules.birthVow.type === requirement.vowType && sheet.houseRules.birthVow.approved && sheet.houseRules.birthVow.active !== false;
  if (requirement.type === "item") return sheet.equipment.some(item => item.id === requirement.itemId || item.catalogId === requirement.itemId || item.name === requirement.itemId) || sheet.cursedTools.some(item => item.id === requirement.itemId || item.name === requirement.itemId);
  return requirement.type === "all" ? requirement.requirements.every(item => requirementIsMet(sheet, item, attributes)) : requirement.requirements.some(item => requirementIsMet(sheet, item, attributes));
}

export function getCharacterModifierSources(sheet: FMCharacterSheet): FMModifierSource[] {
  const sources: FMModifierSource[] = [];
  fmAttributeKeys.forEach(attribute => sources.push(source("permanent", `permanent:${attribute}`, "Bônus permanente", true, [{ id: `permanent:${attribute}`, target: attribute, operation: "add", value: sheet.attributes.permanentBonuses[attribute], note: "Bônus permanente declarado na ficha." }])));
  const originName = sheet.origin.clan || sheet.origin.name || "Origem";
  fmAttributeKeys.forEach(attribute => sources.push(source("origin", `origin:${attribute}`, originName, true, [{ id: `origin:${attribute}`, target: attribute, operation: "add", value: sheet.origin.attributeBonuses[attribute] ?? 0, note: "Bônus de atributo da origem." }])));
  const race = sheet.mechanics.race;
  if (race) { const evolution = race.evolutions.find(item => item.id === race.selectedEvolutionId); if (!evolution || evolution.replacesBaseModifiers === false) sources.push(source("race", race.id, race.name, race.active, race.modifiers, race.requirements)); if (evolution) sources.push(source("evolution", evolution.id, evolution.name, race.active, evolution.modifiers, [...race.requirements, ...evolution.requirements])); }
  sheet.training.forEach(training => sources.push(source("training", training.homebrewId ?? training.trackId, training.label ?? training.trackId, training.stage > 0, training.modifiers, training.requirements)));
  sheet.aptitudes.forEach(aptitude => {
    const evolution = aptitude.evolutions?.find(item => item.id === aptitude.selectedEvolutionId);
    const enabled = aptitude.approved || !aptitude.homebrewId;
    if (!evolution || evolution.replacesBaseEffects === false) sources.push(source("aptitude", aptitude.id, aptitude.name, enabled, aptitude.modifiers, aptitude.requirements, aptitude.effects));
    if (evolution) sources.push(source("aptitude", `${aptitude.id}:${evolution.id}`, `${aptitude.name} · ${evolution.name}`, enabled, evolution.modifiers, [...(aptitude.requirements ?? []), ...evolution.requirements], evolution.effects));
  });
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
  const skillModifiers: Record<string, number> = {};
  const skillBreakdown: Record<string, FMValueBreakdown> = {};
  const appliedModifiers: FMAppliedModifier[] = [];
  const appliedSkillEffects: FMAppliedSkillEffect[] = [];
  const unlocks: FMCharacterUnlock[] = [];
  const features: FMCharacterFeature[] = [];
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
      if (fmAttributeKeys.includes(modifier.target as FMAttributeKey)) { const attribute = modifier.target as FMAttributeKey; attributes[attribute] += modifier.value; (attributeBreakdown[attribute].entries as FMAppliedModifier[]).push(applied); attributeBreakdown[attribute].final = attributes[attribute]; }
      else { const target = modifier.target as keyof typeof derivedModifiers; derivedModifiers[target] += modifier.value; (derivedBreakdown[target].entries as FMAppliedModifier[]).push(applied); derivedBreakdown[target].final = derivedModifiers[target]; }
    }
    for (const effect of item.effects) {
      if (effect.type === "skill-modifier") sheet.skills.filter(skill => matchesSkill(skill, effect.skillId)).forEach(skill => { const applied: FMAppliedSkillEffect = { id: effect.id, sourceId: item.id, sourceName: item.name, sourceType: item.type, skillId: skill.id, value: effect.value, note: effect.note ?? "" }; appliedSkillEffects.push(applied); skillModifiers[skill.id] = (skillModifiers[skill.id] ?? 0) + effect.value; const breakdown = skillBreakdown[skill.id] ?? { base: 0, entries: [], final: 0 }; (breakdown.entries as FMAppliedSkillEffect[]).push(applied); breakdown.final = skillModifiers[skill.id]; skillBreakdown[skill.id] = breakdown; });
      if (effect.type === "unlock") unlocks.push({ id: effect.id, sourceId: item.id, sourceName: item.name, target: effect.target, referenceId: effect.referenceId, label: effect.label, description: effect.description ?? "" });
      if (effect.type === "feature") features.push({ id: effect.id, sourceId: item.id, sourceName: item.name, label: effect.label, description: effect.description });
    }
  }
  return { attributes, attributeBreakdown, derivedModifiers, derivedBreakdown, skillModifiers, skillBreakdown, appliedModifiers, appliedSkillEffects, unlocks, features, requirements };
}

export function getSkillModifierFromState(state: FMCharacterState, skill: Pick<FMSkill, "id">) { return state.skillModifiers[skill.id] ?? 0; }
