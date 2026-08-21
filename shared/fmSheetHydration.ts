import { getExperienceForLevel } from "./infiniteWorlds";
import { FM_MUTANT_CURSED_CORPSE_ORIGIN, normalizeMutantCoreState } from "./fmMutantCores";
import { resolveClanId } from "./fmOrigins";
import { getTechniqueKindForSpecialization } from "./fmTechniques";
import { createEmptyFMSheet, type FMCharacterSheet } from "./fmTypes";

/**
 * Normaliza o JSON persistido para o formato atual sem alterar o registro de origem.
 * Fichas antigas podem não possuir blocos adicionados em versões mais recentes.
 */
export function hydrateSheet(raw: Record<string, unknown> | null | undefined): FMCharacterSheet {
  const empty = createEmptyFMSheet();
  const source = raw as Partial<FMCharacterSheet> | undefined;
  if (!source) return empty;
  return {
    ...empty,
    ...source,
    identity: { ...empty.identity, ...(source.identity ?? {}) },
    personal: { ...empty.personal, ...(source.personal ?? {}) },
    progression: {
      ...empty.progression,
      ...(source.progression ?? {}),
      primarySpecialization: source.progression && Object.prototype.hasOwnProperty.call(source.progression, "primarySpecialization") ? source.progression.primarySpecialization : source.progression?.specialization ?? empty.progression.primarySpecialization,
      primarySpecializationLocked: source.progression && Object.prototype.hasOwnProperty.call(source.progression, "primarySpecializationLocked") ? Boolean(source.progression.primarySpecializationLocked) : Boolean(source.progression?.specialization),
      specializationTracks: Array.isArray(source.progression?.specializationTracks) ? source.progression.specializationTracks : [{ specialization: source.progression?.specialization ?? empty.progression.specialization, level: Math.max(1, source.progression?.specializationLevels ?? source.progression?.level ?? 1) }],
      specializationAbilityChoices: Array.isArray(source.progression?.specializationAbilityChoices) ? source.progression.specializationAbilityChoices : [],
      specializationAbilityUnlocks: Array.isArray(source.progression?.specializationAbilityUnlocks) ? source.progression.specializationAbilityUnlocks : [],
      experience: typeof source.progression?.experience === "number" ? source.progression.experience : getExperienceForLevel(typeof source.progression?.level === "number" ? source.progression.level : 1),
    },
    houseRules: {
      ...empty.houseRules,
      ...(source.houseRules ?? {}),
      birthVow: { ...empty.houseRules.birthVow, ...(source.houseRules?.birthVow ?? {}) },
      actionDeclaration: { ...empty.houseRules.actionDeclaration, ...(source.houseRules?.actionDeclaration ?? {}) },
      rest: { ...empty.houseRules.rest, ...(source.houseRules?.rest ?? {}) },
      downtime: { ...empty.houseRules.downtime, ...(source.houseRules?.downtime ?? {}), freeBuildOptions: Array.isArray(source.houseRules?.downtime?.freeBuildOptions) ? source.houseRules.downtime.freeBuildOptions : [] },
      customVows: Array.isArray(source.houseRules?.customVows) ? source.houseRules.customVows : [],
    },
    origin: { ...empty.origin, ...(source.origin ?? {}), clanId: resolveClanId(source.origin?.clanId, source.origin?.clan) },
    mechanics: {
      ...empty.mechanics,
      ...(source.mechanics ?? {}),
      race: source.mechanics?.race ? {
        ...source.mechanics.race,
        modifiers: Array.isArray(source.mechanics.race.modifiers) ? source.mechanics.race.modifiers : [],
        requirements: Array.isArray(source.mechanics.race.requirements) ? source.mechanics.race.requirements : [],
        characteristics: Array.isArray(source.mechanics.race.characteristics) ? source.mechanics.race.characteristics : [],
        abilities: Array.isArray(source.mechanics.race.abilities) ? source.mechanics.race.abilities : [],
        choices: Array.isArray(source.mechanics.race.choices) ? source.mechanics.race.choices : [],
        selectedChoices: Array.isArray(source.mechanics.race.selectedChoices) ? source.mechanics.race.selectedChoices : [],
        evolutions: Array.isArray(source.mechanics.race.evolutions) ? source.mechanics.race.evolutions.map(evolution => ({ ...evolution, requirements: Array.isArray(evolution.requirements) ? evolution.requirements : [], modifiers: Array.isArray(evolution.modifiers) ? evolution.modifiers : [], characteristics: Array.isArray(evolution.characteristics) ? evolution.characteristics : [], abilities: Array.isArray(evolution.abilities) ? evolution.abilities : [], choices: Array.isArray(evolution.choices) ? evolution.choices : [] })) : [],
      } : null,
    },
    technique: { ...empty.technique, ...(source.technique ?? {}), kind: getTechniqueKindForSpecialization(source.progression?.specialization ?? empty.progression.specialization), powers: Array.isArray(source.technique?.powers) ? source.technique.powers : [] },
    attributes: {
      base: { ...empty.attributes.base, ...(source.attributes?.base ?? {}) },
      permanentBonuses: { ...empty.attributes.permanentBonuses, ...(source.attributes?.permanentBonuses ?? {}) },
    },
    bonuses: { ...empty.bonuses, ...(source.bonuses ?? {}) },
    resources: {
      health: { ...empty.resources.health, ...(source.resources?.health ?? {}) },
      energy: { ...empty.resources.energy, ...(source.resources?.energy ?? {}) },
    },
    skills: Array.isArray(source.skills) ? source.skills : [],
    spells: Array.isArray(source.spells) ? source.spells : [],
    invocations: Array.isArray(source.invocations) ? source.invocations : [],
    images: Array.isArray(source.images) ? source.images : [],
    equipment: Array.isArray(source.equipment) ? source.equipment : [],
    attacks: Array.isArray(source.attacks) ? source.attacks : [],
    defenses: Array.isArray(source.defenses) ? source.defenses : [],
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    combatants: Array.isArray(source.combatants) ? source.combatants : [],
    diary: Array.isArray(source.diary) ? source.diary : [],
    missionRewards: Array.isArray(source.missionRewards) ? source.missionRewards : [],
    aptitudes: Array.isArray(source.aptitudes) ? source.aptitudes : [],
    training: Array.isArray(source.training) ? source.training : [],
    customResources: Array.isArray(source.customResources) ? source.customResources : [],
    transformations: Array.isArray(source.transformations) ? source.transformations : [],
    mutantCores: source.mutantCores || source.origin?.catalogId === FM_MUTANT_CURSED_CORPSE_ORIGIN ? normalizeMutantCoreState(source.mutantCores, {
      progression: { ...empty.progression, ...(source.progression ?? {}), specializationAbilityChoices: Array.isArray(source.progression?.specializationAbilityChoices) ? source.progression.specializationAbilityChoices : [], specializationAbilityUnlocks: Array.isArray(source.progression?.specializationAbilityUnlocks) ? source.progression.specializationAbilityUnlocks : [] },
      attributes: { base: { ...empty.attributes.base, ...(source.attributes?.base ?? {}) }, permanentBonuses: { ...empty.attributes.permanentBonuses, ...(source.attributes?.permanentBonuses ?? {}) } },
      resources: { health: { ...empty.resources.health, ...(source.resources?.health ?? {}) }, energy: { ...empty.resources.energy, ...(source.resources?.energy ?? {}) } },
      spells: Array.isArray(source.spells) ? source.spells : [],
    }) : undefined,
    allies: Array.isArray(source.allies) ? source.allies : [],
    cursedTools: Array.isArray(source.cursedTools) ? source.cursedTools : [],
    domainExpansion: source.domainExpansion ?? null,
  };
}
