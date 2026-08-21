import { fmSavingThrowKeys, type FMAttributeKey, type FMAttributes, type FMAttackMode, type FMCharacterSheet, type FMEquipmentItem, type FMProficiency, type FMSavingThrowKey, type FMSpecializationKey, type FMSpecializationTrack, type FMSpellLevel } from "./fmTypes";
import { calculateCharacterState } from "./fmCharacterState";
import { getEffectiveMutantSheet, getMutantPrimaryCore, isMutantCursedCorpse } from "./fmMutantCores";

export const FM_ATTRIBUTE_LABELS: Record<FMAttributeKey, string> = {
  strength: "Força",
  dexterity: "Destreza",
  constitution: "Constituição",
  intelligence: "Inteligência",
  wisdom: "Sabedoria",
  presence: "Presença",
};

export const FM_SPECIALIZATION_LABELS: Record<FMSpecializationKey, string> = {
  fighter: "Lutador",
  "combat-specialist": "Especialista em Combate",
  "technique-specialist": "Especialista em Técnica",
  controller: "Controlador",
  support: "Suporte",
  restricted: "Restringido",
};

export const FM_SAVING_THROW_LABELS: Record<FMSavingThrowKey, string> = {
  astucia: "Astúcia",
  fortitude: "Fortitude",
  integridade: "Integridade",
  reflexos: "Reflexos",
  vontade: "Vontade",
};

export const FM_SAVING_THROW_ATTRIBUTES: Record<FMSavingThrowKey, FMAttributeKey> = {
  astucia: "intelligence",
  fortitude: "constitution",
  integridade: "constitution",
  reflexos: "dexterity",
  vontade: "wisdom",
};

type SpecializationProfile = {
  firstLevelHealth: number;
  averageHealthGain: number;
  hitDie: 8 | 10 | 12;
  energyPerLevel: number;
  addsTechniqueModifier: boolean;
  usesStamina: boolean;
};

export const FM_SPECIALIZATION_PROFILES: Record<FMSpecializationKey, SpecializationProfile> = {
  fighter: { firstLevelHealth: 12, averageHealthGain: 6, hitDie: 10, energyPerLevel: 4, addsTechniqueModifier: false, usesStamina: false },
  "combat-specialist": { firstLevelHealth: 12, averageHealthGain: 6, hitDie: 10, energyPerLevel: 4, addsTechniqueModifier: false, usesStamina: false },
  "technique-specialist": { firstLevelHealth: 10, averageHealthGain: 5, hitDie: 8, energyPerLevel: 6, addsTechniqueModifier: true, usesStamina: false },
  controller: { firstLevelHealth: 10, averageHealthGain: 5, hitDie: 8, energyPerLevel: 5, addsTechniqueModifier: true, usesStamina: false },
  support: { firstLevelHealth: 10, averageHealthGain: 5, hitDie: 8, energyPerLevel: 5, addsTechniqueModifier: true, usesStamina: false },
  restricted: { firstLevelHealth: 16, averageHealthGain: 7, hitDie: 12, energyPerLevel: 4, addsTechniqueModifier: false, usesStamina: true },
};

export const FM_MULTICLASS_REQUIREMENTS: Record<FMSpecializationKey, { attributes: FMAttributeKey[]; minimum: number; label: string }> = {
  fighter: { attributes: ["strength", "dexterity"], minimum: 16, label: "Força ou Destreza 16" },
  "combat-specialist": { attributes: ["strength", "dexterity"], minimum: 16, label: "Força ou Destreza 16" },
  "technique-specialist": { attributes: ["intelligence", "wisdom"], minimum: 16, label: "Inteligência ou Sabedoria 16" },
  controller: { attributes: ["presence", "wisdom"], minimum: 16, label: "Presença ou Sabedoria 16" },
  support: { attributes: ["presence", "wisdom"], minimum: 16, label: "Presença ou Sabedoria 16" },
  restricted: { attributes: [], minimum: Number.POSITIVE_INFINITY, label: "Não permite multiclasse" },
};

export function getSpecializationTracks(sheet: FMCharacterSheet): FMSpecializationTrack[] {
  const tracks = sheet.progression.specializationTracks.filter(track => track && FM_SPECIALIZATION_PROFILES[track.specialization] && Number.isInteger(track.level) && track.level > 0);
  if (tracks.length) return tracks;
  return [{ specialization: sheet.progression.specialization, level: Math.max(1, sheet.progression.specializationLevels || sheet.progression.level) }];
}

export function canAddMulticlass(attributes: FMAttributes, primary: FMSpecializationKey | null, candidate: FMSpecializationKey) {
  if (!primary || candidate === primary) return { allowed: true, reason: "" };
  if (primary === "restricted" || candidate === "restricted") return { allowed: false, reason: "Restringido não pode realizar nem receber Multiclasse." };
  const requirement = FM_MULTICLASS_REQUIREMENTS[candidate];
  const allowed = requirement.attributes.some(attribute => attributes[attribute] >= requirement.minimum);
  return { allowed, reason: allowed ? "" : `Requer ${requirement.label}.` };
}

export function getEquipmentSpaces(item: FMEquipmentItem) {
  return Number.isFinite(item.spaces) ? Math.max(0, item.spaces as number) : Math.max(0, item.weight || 0);
}

export function getCarryCapacity(strengthModifier: number) {
  return Math.max(1, 8 + strengthModifier * 2);
}

export function getInventoryLoad(sheet: FMCharacterSheet) {
  const spaces = sheet.equipment.reduce((total, item) => total + getEquipmentSpaces(item) * Math.max(1, Number.isFinite(item.quantity) ? item.quantity as number : 1), 0);
  const capacity = getCarryCapacity(getAttributeModifier(getTotalAttributes(sheet).strength));
  return { spaces, capacity, maximum: capacity * 2, overloaded: spaces > capacity, impossible: spaces > capacity * 2 };
}

export const FM_SPELL_COSTS: Record<FMSpellLevel, number> = { 0: 0, 1: 2, 2: 5, 3: 8, 4: 12, 5: 20 };

export type FMPowerProgression = { unlockLevels: number[]; availableSlots: number; nextUnlockLevel: number | null; cadenceLabel: string };

export function getTechniquePowerProgression(specialization: FMSpecializationKey, level: number): FMPowerProgression {
  const safeLevel = Math.max(0, Math.min(20, Math.floor(level)));
  const unlockLevels = specialization === "technique-specialist"
    ? Array.from({ length: safeLevel }, (_, index) => index + 1)
    : Array.from({ length: Math.floor(safeLevel / 2) }, (_, index) => (index + 1) * 2);
  const cadenceLabel = specialization === "technique-specialist" ? "1 novo poder por nível" : specialization === "fighter" ? "1 novo poder em níveis pares" : "1 novo poder a cada 2 níveis";
  const nextUnlockLevel = specialization === "technique-specialist" ? (safeLevel < 20 ? safeLevel + 1 : null) : (safeLevel < 20 ? (safeLevel % 2 === 0 ? safeLevel + 2 : safeLevel + 1) : null);
  return { unlockLevels, availableSlots: unlockLevels.length, nextUnlockLevel, cadenceLabel };
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getAttributeModifier(value: number) {
  return Math.floor((clamp(value, 0, 30) - 10) / 2);
}

export function getHalfLevel(level: number) {
  return Math.floor(Math.max(level, 0) / 2);
}

export function getOfficialTrainingBonus(level: number, optionalLevelZero = false) {
  if (optionalLevelZero && level === 0) return 1;
  return 2 + Math.floor((Math.max(level, 1) - 1) / 4);
}

export function getProficiencyContribution(trainingBonus: number, proficiency: FMProficiency) {
  if (proficiency === "untrained") return 0;
  if (proficiency === "trained") return trainingBonus;
  return trainingBonus + Math.floor(trainingBonus / 2);
}

export function getTotalAttributes(sheet: FMCharacterSheet): FMAttributes {
  return calculateCharacterState(sheet).attributes;
}

export function getHealthMaximum(sheet: FMCharacterSheet) {
  const effectiveSheet = getEffectiveMutantSheet(sheet);
  const { level, specialization, healthMode, rolledHealthGains, optionalLevelZero } = effectiveSheet.progression;
  const constitutionModifier = getAttributeModifier(getTotalAttributes(sheet).constitution);
  const mechanics = calculateCharacterState(sheet);
  if (optionalLevelZero && level === 0) return Math.max(1, 6 + constitutionModifier + effectiveSheet.resources.health.bonusMaximum + mechanics.derivedModifiers.healthMaximum);
  const profile = FM_SPECIALIZATION_PROFILES[specialization];
  const safeLevel = Math.max(level, 1);
  const subsequentGain = healthMode === "rolled"
    ? rolledHealthGains.slice(0, Math.max(safeLevel - 1, 0)).reduce((sum, gain) => sum + Math.max(gain, 1) + constitutionModifier, 0)
    : Math.max(safeLevel - 1, 0) * (profile.averageHealthGain + constitutionModifier);
  return Math.max(1, profile.firstLevelHealth + constitutionModifier + subsequentGain + effectiveSheet.resources.health.bonusMaximum + mechanics.derivedModifiers.healthMaximum);
}

export function getEnergyMaximum(sheet: FMCharacterSheet) {
  const effectiveSheet = getEffectiveMutantSheet(sheet);
  const { level, specialization, techniqueAttribute, optionalLevelZero, nonSorcerer } = effectiveSheet.progression;
  const mechanics = calculateCharacterState(sheet);
  if (optionalLevelZero && level === 0) return Math.max(0, mechanics.derivedModifiers.energyMaximum);
  if (nonSorcerer) return Math.max(0, 10 + effectiveSheet.resources.energy.bonusMaximum + mechanics.derivedModifiers.energyMaximum);
  const profile = FM_SPECIALIZATION_PROFILES[specialization];
  const safeLevel = Math.max(level, 1);
  const techniqueModifier = profile.addsTechniqueModifier ? getAttributeModifier(getTotalAttributes(sheet)[techniqueAttribute]) : 0;
  return Math.max(0, profile.energyPerLevel * safeLevel + techniqueModifier + effectiveSheet.resources.energy.bonusMaximum + mechanics.derivedModifiers.energyMaximum);
}

export function getResourceLabel(specialization: FMSpecializationKey, nonSorcerer = false) {
  return nonSorcerer || FM_SPECIALIZATION_PROFILES[specialization].usesStamina ? "Estamina" : "Energia Amaldiçoada";
}

export function getSkillBonus(level: number, attributes: FMAttributes, attribute: FMAttributeKey, proficiency: FMProficiency, otherBonus = 0, trainingBonus = getOfficialTrainingBonus(level), calculatedBonus = 0) {
  return getAttributeModifier(attributes[attribute]) + getHalfLevel(level) + getProficiencyContribution(trainingBonus, proficiency) + otherBonus + calculatedBonus;
}

export function getSavingThrowBonus(level: number, attributes: FMAttributes, savingThrow: FMSavingThrowKey, trained: boolean, trainingBonus = getOfficialTrainingBonus(level)) {
  return getAttributeModifier(attributes[FM_SAVING_THROW_ATTRIBUTES[savingThrow]]) + getHalfLevel(level) + (trained ? trainingBonus : 0);
}

export function getAttackAttribute(mode: FMAttackMode, finesse: boolean, override?: FMAttributeKey): FMAttributeKey {
  if (override) return override;
  if (mode === "melee") return finesse ? "dexterity" : "strength";
  if (mode === "ranged") return "dexterity";
  return "intelligence";
}

export function getAttackBonus(input: {
  level: number;
  attributes: FMAttributes;
  mode: FMAttackMode;
  finesse?: boolean;
  trained?: boolean;
  techniqueAttribute?: FMAttributeKey;
  override?: FMAttributeKey;
  otherBonus?: number;
  penalties?: number;
  trainingBonus?: number;
}) {
  const attribute = input.mode === "cursed"
    ? input.techniqueAttribute ?? input.override ?? "intelligence"
    : getAttackAttribute(input.mode, Boolean(input.finesse), input.override);
  const training = input.mode === "cursed" || input.trained ? input.trainingBonus ?? getOfficialTrainingBonus(input.level) : 0;
  return getAttributeModifier(input.attributes[attribute]) + getHalfLevel(input.level) + training + (input.otherBonus ?? 0) - (input.penalties ?? 0);
}

export function getTechniqueDc(level: number, attributes: FMAttributes, techniqueAttribute: FMAttributeKey, otherBonus = 0, trainingBonus = getOfficialTrainingBonus(level)) {
  return 10 + getHalfLevel(level) + getAttributeModifier(attributes[techniqueAttribute]) + trainingBonus + otherBonus;
}

export function getDerivedValues(sheet: FMCharacterSheet) {
  const effectiveSheet = getEffectiveMutantSheet(sheet);
  const mechanics = calculateCharacterState(effectiveSheet);
  const attributes = mechanics.attributes;
  const level = effectiveSheet.progression.level;
  const perception = effectiveSheet.skills.find(skill => skill.name.trim().toLocaleLowerCase("pt-BR") === "percepção");
  const trainingBonus = getOfficialTrainingBonus(level, effectiveSheet.progression.optionalLevelZero);
  const perceptionBonus = perception ? getSkillBonus(level, attributes, perception.attribute, perception.proficiency, perception.otherBonus, trainingBonus) : 0;
  const rawHealthMaximum = Math.max(1, getHealthMaximum(effectiveSheet) + mechanics.derivedModifiers.healthMaximum);
  const rawEnergyMaximum = Math.max(0, getEnergyMaximum(effectiveSheet) + mechanics.derivedModifiers.energyMaximum);
  const primaryCore = isMutantCursedCorpse(sheet) ? getMutantPrimaryCore(sheet.mutantCores) : null;
  const primarySheet = primaryCore && sheet.mutantCores ? getEffectiveMutantSheet({ ...sheet, mutantCores: { ...sheet.mutantCores, activeCoreId: primaryCore.id } }) : effectiveSheet;
  const primaryHealthMaximum = primaryCore ? Math.max(1, getHealthMaximum(primarySheet)) : rawHealthMaximum;
  const primaryEnergyMaximum = primaryCore ? Math.max(0, getEnergyMaximum(primarySheet)) : rawEnergyMaximum;
  const healthMaximum = primaryCore ? Math.min(rawHealthMaximum, primaryHealthMaximum) : rawHealthMaximum;
  const energyMaximum = primaryCore ? Math.min(rawEnergyMaximum, primaryEnergyMaximum) : rawEnergyMaximum;
  const integrity = primaryCore && sheet.mutantCores ? Math.max(1, Math.floor(sheet.mutantCores.cores.reduce((sum, core) => sum + Math.min(getHealthMaximum(getEffectiveMutantSheet({ ...sheet, mutantCores: { ...sheet.mutantCores!, activeCoreId: core.id } })), primaryHealthMaximum), 0) / 2)) : healthMaximum;
  const savingThrows = Object.fromEntries(fmSavingThrowKeys.map(key => [key, getSavingThrowBonus(level, attributes, key, effectiveSheet.progression.savingThrowTraining[key], trainingBonus)])) as Record<FMSavingThrowKey, number>;
  const activeCombatModifiers = effectiveSheet.spells.reduce((totals, spell) => {
    if (!spell.active || !spell.combatModifierTarget || spell.combatModifierTarget === "none") return totals;
    totals[spell.combatModifierTarget] += Number.isFinite(spell.combatModifier) ? spell.combatModifier : 0;
    return totals;
  }, { attack: 0, defense: 0, initiative: 0 });
  return {
    attributes,
    trainingBonus,
    healthMaximum,
    energyMaximum,
    attention: 10 + perceptionBonus + effectiveSheet.bonuses.attention + mechanics.derivedModifiers.attention,
    defense: 10 + getAttributeModifier(attributes.dexterity) + getHalfLevel(level) + effectiveSheet.bonuses.defense + activeCombatModifiers.defense + mechanics.derivedModifiers.defense,
    initiative: getAttributeModifier(attributes.dexterity) + effectiveSheet.bonuses.initiative + activeCombatModifiers.initiative + mechanics.derivedModifiers.initiative,
    movement: 9 + effectiveSheet.bonuses.movement + mechanics.derivedModifiers.movement,
    integrity,
    techniqueDc: getTechniqueDc(level, attributes, effectiveSheet.progression.techniqueAttribute, effectiveSheet.bonuses.techniqueDc + mechanics.derivedModifiers.techniqueDc, trainingBonus),
    savingThrows,
    activeCombatModifiers,
  };
}

export function getSpellCost(level: FMSpellLevel, adjustment = 0) {
  const baseCost = FM_SPELL_COSTS[level];
  return level === 0 ? 0 : Math.max(1, baseCost + adjustment);
}

export function getSustainCost(level: FMSpellLevel) {
  return level <= 2 ? 1 : 2;
}

export function getHighestSpellLevel(level: number) {
  if (level >= 17) return 5 as const;
  if (level >= 13) return 4 as const;
  if (level >= 9) return 3 as const;
  if (level >= 5) return 2 as const;
  return 1 as const;
}

export type RollResult = { dice: number[]; kept: number; total: number; advantage: "normal" | "advantage" | "disadvantage" };

export function rollD20(modifier = 0, advantage: RollResult["advantage"] = "normal", random: () => number = Math.random): RollResult {
  const roll = () => Math.floor(clamp(random(), 0, 0.999999) * 20) + 1;
  const dice = advantage === "normal" ? [roll()] : [roll(), roll()];
  const kept = advantage === "advantage" ? Math.max(...dice) : advantage === "disadvantage" ? Math.min(...dice) : dice[0] ?? 1;
  return { dice, kept, total: kept + modifier, advantage };
}
