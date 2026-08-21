export const fmAttributeKeys = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "presence",
] as const;

export type FMAttributeKey = (typeof fmAttributeKeys)[number];

export type FMAttributes = Record<FMAttributeKey, number>;

export type FMModifierTarget = FMAttributeKey | "healthMaximum" | "energyMaximum" | "attention" | "defense" | "initiative" | "movement" | "techniqueDc" | `extra:${string}`;
export type FMRequirement =
  | { type: "attribute-min"; attribute: FMAttributeKey; minimum: number }
  | { type: "level-min"; minimum: number }
  | { type: "aptitude"; aptitudeId: string }
  | { type: "training"; trainingId: string }
  | { type: "race"; raceId: string }
  | { type: "origin"; originId: string }
  | { type: "skill-min"; skillId: string; minimum: number }
  | { type: "grade"; grade: string }
  | { type: "technique"; techniqueId: string }
  | { type: "vow"; vowType: FMBirthVowType }
  | { type: "item"; itemId: string }
  | { type: "all"; requirements: FMRequirement[] }
  | { type: "any"; requirements: FMRequirement[] };
export type FMModifierDefinition = { id: string; target: FMModifierTarget; operation: "add"; value: number; active?: boolean; conditions?: FMRequirement[]; note?: string; timing?: "permanent" | "temporary"; durationRounds?: number | null; elapsedRounds?: number };
export type FMGrantedAbility = { id: string; name: string; description: string; type: string; requirements: FMRequirement[]; modifiers: FMModifierDefinition[] };
export type FMGrantBundle = { abilities: FMGrantedAbility[]; techniques: Array<{ id: string; name: string; description: string }>; skills: Array<{ id: string; name: string; attribute: FMAttributeKey; proficiency: FMProficiency }>; aptitudes: string[]; trainings: string[]; equipment: Array<{ id: string; name: string; category: FMEquipmentItem["category"] }>; modifiers: FMModifierDefinition[]; limitations: string[] };
export type FMRaceChoiceOption = { id: string; name: string; description: string; modifiers: FMModifierDefinition[]; grants?: FMGrantBundle };
export type FMRaceChoice = { id: string; label: string; description: string; requirements: FMRequirement[]; options: FMRaceChoiceOption[] };
export type FMRaceChoiceSelection = { choiceId: string; optionId: string };
export type FMRaceEvolution = { id: string; name: string; description: string; replacesBaseModifiers?: boolean; requirements: FMRequirement[]; modifiers: FMModifierDefinition[]; characteristics: string[]; abilities: string[]; grants?: FMGrantBundle; choices?: FMRaceChoice[] };
export type FMCharacterRace = { id: string; sourceId?: string; sourceKind: "homebrew" | "custom"; name: string; description: string; active: boolean; requirements: FMRequirement[]; modifiers: FMModifierDefinition[]; characteristics: string[]; abilities: string[]; grants?: FMGrantBundle; choices?: FMRaceChoice[]; selectedChoices?: FMRaceChoiceSelection[]; evolutions: FMRaceEvolution[]; selectedEvolutionId: string | null };
export type FMCharacterMechanics = { race: FMCharacterRace | null; originGrants?: FMGrantBundle };
export type FMMutantCoreSize = "small" | "medium" | "large";
export type FMMutantCore = {
  id: string;
  name: string;
  description: string;
  specialization: FMSpecializationKey;
  attributes: FMAttributes;
  resources: { health: FMResourceState; energy: FMResourceState };
  spells: FMSpell[];
  abilities: string[];
  characteristics: string[];
  specializationAbilityChoices: FMSpecializationAbilityChoice[];
  specializationAbilityUnlocks?: FMSpecializationAbilityUnlock[];
  size: FMMutantCoreSize;
  damaged: boolean;
  destroyed: boolean;
  deathSaveFailures: number;
  notes: string;
};
export type FMMutantCoreState = {
  cores: FMMutantCore[];
  primaryCoreId: string | null;
  activeCoreId: string | null;
  soulIntegrityCurrent: number | null;
};
export type FMAptitudeSkillEffect = { id: string; type: "skill-modifier"; skillId: string; value: number; note?: string };
export type FMAptitudeUnlockEffect = { id: string; type: "unlock"; target: "technique" | "ability" | "training" | "vow" | "item"; referenceId: string; label: string; description?: string };
export type FMAptitudeFeatureEffect = { id: string; type: "feature"; label: string; description: string };
export type FMAptitudeEffect = FMAptitudeSkillEffect | FMAptitudeUnlockEffect | FMAptitudeFeatureEffect;
export type FMAptitudeEvolution = { id: string; name: string; description: string; level: number; requirements: FMRequirement[]; modifiers: FMModifierDefinition[]; effects: FMAptitudeEffect[]; limitations: string; replacesBaseEffects?: boolean };
export type FMAptitudeDefinition = { description: string; requirements: FMRequirement[]; modifiers: FMModifierDefinition[]; effects: FMAptitudeEffect[]; limitations: string; evolutions: FMAptitudeEvolution[] };

export type FMSpecializationKey =
  | "fighter"
  | "combat-specialist"
  | "technique-specialist"
  | "controller"
  | "support"
  | "restricted";

export type FMProficiency = "untrained" | "trained" | "master";
export type FMSkillTrainingAttribute = "intelligence" | "wisdom";

export const fmSavingThrowKeys = ["astucia", "fortitude", "integridade", "reflexos", "vontade"] as const;
export type FMSavingThrowKey = (typeof fmSavingThrowKeys)[number];

export type FMSkill = {
  id: string;
  catalogId?: string;
  name: string;
  attribute: FMAttributeKey;
  proficiency: FMProficiency;
  otherBonus: number;
  notes: string;
};

export type FMSpellLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type FMSpellType = "level-zero" | "damage" | "auxiliary" | "healing" | "special" | "passive";
export type FMDurationType = "immediate" | "lasting" | "sustained" | "concentrated" | "variable";
export type FMActionType = "common" | "bonus" | "reaction" | "movement" | "free" | "complete";
export type FMAttackMode = "melee" | "ranged" | "cursed";
export type FMTechniqueKind = "cursed" | "martial";
export type FMOriginKey = "innate" | "inherited" | "derived" | "restricted" | "cursed-womb" | "technique-less" | "mutant-cursed-corpse" | "custom";
export type FMClanKey = "gojo" | "inumaki" | "kamo" | "zenin" | "custom";
export type FMInvocationGrade = "fourth" | "third" | "second" | "first" | "special";
export type FMInvocationType = "puppet" | "tamed-curse" | "shikigami";
export type FMInvocationActionKind = "simple" | "complex" | "trait";
export type FMObservationEntityType = "character" | "history" | "domain" | "aptitude" | "technique" | "training" | "invocation" | "equipment" | "advantage" | "disadvantage" | "ally" | "homebrew";

export type FMTechnique = {
  kind: FMTechniqueKind;
  name: string;
  basicFunction: string;
  counterplay?: string;
  attributeKeys: FMAttributeKey[];
  intrinsicBenefits: string;
  limitations: string;
  requiredItems: string;
  reviewNotes: string;
  notes?: string;
  powers: FMTechniquePower[];
  modifiers?: FMModifierDefinition[];
  requirements?: FMRequirement[];
  customFields?: Array<{ id: string; label: string; value: string }>;
};

export type FMTechniquePower = {
  id: string;
  name: string;
  requiredCharacterLevel: number;
  spellLevel: FMSpellLevel;
  type: FMSpellType;
  summary: string;
  requirement: string;
};

export type FMBirthVowType = "none" | "congenital-restriction" | "celestial-restriction";

export type FMVow = { id: string; name: string; description: string; conditions: string; benefits: FMModifierDefinition[]; drawbacks: FMModifierDefinition[]; requirements: FMRequirement[]; limitations: string; notes: string; approved: boolean; active: boolean };
export type FMBirthVow = { type: FMBirthVowType; description: string; approved: boolean; locked: boolean; active?: boolean; modifiers?: FMModifierDefinition[]; requirements?: FMRequirement[] };

export type FMHouseAttributeGeneration = {
  values: number[];
  total: number;
  attempts: number;
  generatedAt: number;
};

export type FMHouseRules = {
  attributeGeneration: FMHouseAttributeGeneration | null;
  birthVow: FMBirthVow;
  actionDeclaration: { attribute: FMAttributeKey | null; detail: string; locked: boolean };
  rest: { exhaustion: number; missionCount: number; lastMissionAt: number | null; lastShortRestAt: number | null; lastLongRestAt: number | null; longRestMissionCount: number | null };
  downtime: { interludes: number; craftingFocus: string; professionChecksRequired: boolean; itemReviewRequired: boolean; freeBuildOptions: Array<{ id: string; name: string; sourceSpecialization: FMSpecializationKey; prerequisites: string; interludeCost: 1 }> };
  dedicationRewarding: boolean;
  customVows?: FMVow[];
};

export type FMSpell = {
  id: string;
  name: string;
  type: FMSpellType;
  level: FMSpellLevel;
  casting: FMActionType;
  reach: string;
  targetOrArea: string;
  durationType: FMDurationType;
  durationDetail: string;
  effect: string;
  counterplay: string;
  requirement: string;
  damage: string;
  damageType: string;
  resolution: "attack" | "saving-throw" | "none";
  savingThrow: string;
  costAdjustment: number;
  combatModifierTarget: "none" | "attack" | "defense" | "initiative";
  combatModifier: number;
  notes: string;
  active: boolean;
  sourcePowerId?: string;
};

export type FMInvocationAction = {
  id: string;
  name: string;
  kind: FMInvocationActionKind;
  effect: string;
  counterplay: string;
};

export type FMInvocation = {
  id: string;
  name: string;
  concept: string;
  /** Tipo oficial do livro; ausente apenas em fichas legadas. */
  type?: FMInvocationType;
  grade: FMInvocationGrade;
  attributes: FMAttributes;
  movement: number;
  trainedAttack: "melee" | "ranged";
  trainedSavingThrow: Exclude<FMSavingThrowKey, "integridade">;
  trainedSkills: string[];
  actions: FMInvocationAction[];
  notes: string;
  active: boolean;
  modifiers?: FMModifierDefinition[];
  requirements?: FMRequirement[];
};

export type FMImageAttachment = {
  id: string;
  key: string;
  url: string;
  name: string;
  caption: string;
  createdAt: number;
};

export type FMEquipmentItem = {
  id: string;
  catalogId?: string;
  name: string;
  category: "weapon" | "shield" | "uniform" | "tool" | "special" | "other";
  damage: string;
  damageType: string;
  range: string;
  defenseBonus: number;
  weight: number;
  quantity?: number;
  spaces?: number;
  cost?: number;
  properties?: string;
  equipped: boolean;
  notes: string;
  modifiers?: FMModifierDefinition[];
  requirements?: FMRequirement[];
};

export type FMSpecializationTrack = {
  specialization: FMSpecializationKey;
  level: number;
};

export type FMSpecializationAbilityChoice = {
  specialization: FMSpecializationKey;
  slotId: string;
  abilityId: string;
};

export type FMSpecializationAbilityKind = "passive" | "active" | "choice" | "evolution" | "modifier" | "unlock" | "special";
export type FMSpecializationAbilityStatus = "unlocked" | "selected" | "pending" | "inactive";
export type FMSpecializationAbilityUnlock = {
  abilityId: string;
  specialization: FMSpecializationKey;
  coreId?: string | null;
  unlockedAt: number | null;
  status: FMSpecializationAbilityStatus;
  selected: boolean;
};

export type FMAttack = {
  id: string;
  name: string;
  mode: FMAttackMode;
  finesse: boolean;
  trained: boolean;
  attributeOverride?: FMAttributeKey;
  otherBonus: number;
  penalties: number;
  damage: string;
  damageType: string;
  reach: string;
  notes: string;
};

export type FMDefenseEntry = {
  id: string;
  name: string;
  trigger: string;
  action: "reaction" | "bonus" | "free";
  effect: string;
  cost: number;
  notes: string;
};

export type FMCondition = {
  id: string;
  name: string;
  severity: string;
  duration: string;
  source: string;
};

export type FMDeathSaves = { successes: number; failures: number; stabilized: boolean; notes: string };
export type FMDamageReduction = { id: string; damageType: string; amount: number; notes: string };

export type FMDiaryEntry = {
  id: string;
  at: number;
  category: "roll" | "resource" | "combat" | "spell" | "note";
  title: string;
  detail: string;
};

export type FMMissionReward = {
  experience: number;
  money: number;
  interludes: number;
  description: string;
};

export type FMMissionRewardRecord = {
  id: string;
  at: number;
  title: string;
  grade: string;
  difficulty: "easy" | "medium" | "hard" | "hard-plus";
  moneyDifficulty: "easy" | "normal" | "hard";
  base: FMMissionReward;
  extra: FMMissionReward;
  total: FMMissionReward;
};

export type FMAptitudeGroup = "aura" | "control-reading" | "domain" | "curse-anatomy" | "special";
export type FMTrainingTrackKey = "agility" | "barriers" | "comprehension" | "energy-control" | "domains" | "reverse-energy" | "combat" | "weapon-mastery" | "skill" | "saving-throw" | "physical-potential";

export type FMAptitude = {
  id: string;
  catalogId: string;
  homebrewId?: string;
  name: string;
  group: FMAptitudeGroup;
  requiredLevel: number;
  cost: number;
  prerequisite: string;
  effect: string;
  approved: boolean;
  modifiers?: FMModifierDefinition[];
  requirements?: FMRequirement[];
  description?: string;
  limitations?: string;
  effects?: FMAptitudeEffect[];
  evolutions?: FMAptitudeEvolution[];
  selectedEvolutionId?: string | null;
  notes?: string;
};

export type FMTrainingProgress = {
  trackId: FMTrainingTrackKey | string;
  homebrewId?: string;
  label?: string;
  effect?: string;
  stage: 0 | 1 | 2 | 3 | 4;
  notes: string;
  modifiers?: FMModifierDefinition[];
  requirements?: FMRequirement[];
  stageEffects?: Partial<Record<1 | 2 | 3 | 4, { description: string; modifiers: FMModifierDefinition[]; unlocks: FMAptitudeUnlockEffect[]; limitations: string }>>;
};

export type FMCustomResource = { id: string; name: string; description: string; current: number; baseMaximum: number; minimum: number; unit: string; notes: string; modifiers?: FMModifierDefinition[] };
export type FMTransformation = { id: string; name: string; description: string; requirements: FMRequirement[]; benefits: FMModifierDefinition[]; drawbacks: FMModifierDefinition[]; durationRounds: number | null; elapsedRounds: number; conditions: string; notes: string; active: boolean };

export type FMAlly = {
  id: string;
  name: string;
  role: string;
  bond: string;
  healthCurrent: number;
  healthMaximum: number;
  defense: number;
  actions: Array<{ id: string; name: string; effect: string }>;
  notes: string;
};

export type FMCursedToolGrade = "fourth" | "third" | "second" | "first" | "special";
export type FMCursedToolCategory = "weapon" | "uniform" | "shield" | "implement" | "other";

export type FMCursedEnchantment = {
  id: string;
  name: string;
  effect: string;
  approved: boolean;
};

export type FMCursedTool = {
  id: string;
  name: string;
  category: FMCursedToolCategory;
  grade: FMCursedToolGrade;
  costTier: 1 | 2 | 3 | 4;
  spaces: number;
  requirements: string;
  effect: string;
  approved: boolean;
  enchantments: FMCursedEnchantment[];
  notes: string;
  equipped?: boolean;
  modifiers?: FMModifierDefinition[];
  mechanicalRequirements?: FMRequirement[];
};

export type FMDomainExpansion = {
  name: string;
  type: "simple" | "incomplete" | "complete" | "barrierless";
  requiredLevel: number;
  energyCost: number;
  barrierHealth: number;
  barrierResilience: number;
  guaranteedHit: boolean;
  maximumTechnique: string;
  effect: string;
  counterplay: string;
  approved: boolean;
  notes?: string;
  active?: boolean;
  modifiers?: FMModifierDefinition[];
  requirements?: FMRequirement[];
};

export type FMCombatant = {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
};

export type FMResourceState = {
  current: number;
  bonusMaximum: number;
};

export type FMCharacterSheet = {
  version: 1;
  identity: {
    name: string;
    player: string;
    grade: string;
    portraitUrl: string | null;
  };
  personal: {
    traits: string;
    ideals: string;
    bonds: string;
    complications: string;
    innateDomain: string;
  };
  /** História narrativa independente do Domínio inato; opcional para fichas legadas. */
  characterHistory?: string;
  progression: {
    level: number;
    experience: number;
    specialization: FMSpecializationKey;
    specializationLevels: number;
    primarySpecialization: FMSpecializationKey | null;
    primarySpecializationLocked: boolean;
    specializationTracks: FMSpecializationTrack[];
    specializationAbilityChoices?: FMSpecializationAbilityChoice[];
    specializationAbilityUnlocks?: FMSpecializationAbilityUnlock[];
    skillTrainingAttribute: FMSkillTrainingAttribute | null;
    skillTrainingAttributeLocked: boolean;
    healthMode: "average" | "rolled";
    rolledHealthGains: number[];
    techniqueAttribute: FMAttributeKey;
    specializationCdAttribute: FMAttributeKey;
    savingThrowTraining: Record<FMSavingThrowKey, boolean>;
    optionalLevelZero: boolean;
    nonSorcerer: boolean;
  };
  guild: {
    currency: number;
  };
  houseRules: FMHouseRules;
  origin: {
    catalogId: FMOriginKey;
    clanId: FMClanKey;
    name: string;
    clan: string;
    attributeBonuses: Partial<FMAttributes>;
    description: string;
    grants?: FMGrantBundle;
  };
  mechanics: FMCharacterMechanics;
  technique: FMTechnique;
  techniqueLibraryId: string | null;
  attributes: {
    base: FMAttributes;
    permanentBonuses: FMAttributes;
  };
  bonuses: {
    attention: number;
    defense: number;
    initiative: number;
    movement: number;
    healthMaximum: number;
    energyMaximum: number;
    techniqueDc: number;
  };
  resources: {
    health: FMResourceState;
    energy: FMResourceState;
  };
  skills: FMSkill[];
  spells: FMSpell[];
  invocations: FMInvocation[];
  images: FMImageAttachment[];
  equipment: FMEquipmentItem[];
  attacks: FMAttack[];
  defenses: FMDefenseEntry[];
  conditions: FMCondition[];
  combatants: FMCombatant[];
  deathSaves?: FMDeathSaves;
  damageReductions?: FMDamageReduction[];
  resistances?: string[];
  vulnerabilities?: string[];
  inspiration?: number;
  energyLimit?: number;
  diary: FMDiaryEntry[];
  missionRewards: FMMissionRewardRecord[];
  aptitudes: FMAptitude[];
  training: FMTrainingProgress[];
  allies: FMAlly[];
  cursedTools: FMCursedTool[];
  domainExpansion: FMDomainExpansion | null;
  customResources?: FMCustomResource[];
  transformations?: FMTransformation[];
  mutantCores?: FMMutantCoreState;
};

export const createEmptyFMSheet = (): FMCharacterSheet => ({
  version: 1,
  identity: { name: "Novo personagem", player: "", grade: "", portraitUrl: null },
  personal: { traits: "", ideals: "", bonds: "", complications: "", innateDomain: "" },
  characterHistory: "",
  progression: {
    level: 1,
    experience: 0,
    specialization: "fighter",
    specializationLevels: 1,
    primarySpecialization: null,
    primarySpecializationLocked: false,
    specializationTracks: [],
    specializationAbilityChoices: [],
    specializationAbilityUnlocks: [],
    skillTrainingAttribute: null,
    skillTrainingAttributeLocked: false,
    healthMode: "average",
    rolledHealthGains: [],
    techniqueAttribute: "intelligence",
    specializationCdAttribute: "strength",
    savingThrowTraining: { astucia: false, fortitude: false, integridade: false, reflexos: false, vontade: false },
    optionalLevelZero: false,
    nonSorcerer: false,
  },
  guild: { currency: 0 },
  houseRules: {
    attributeGeneration: null,
    birthVow: { type: "none", description: "", approved: false, locked: false },
    actionDeclaration: { attribute: null, detail: "", locked: false },
    rest: { exhaustion: 0, missionCount: 0, lastMissionAt: null, lastShortRestAt: null, lastLongRestAt: null, longRestMissionCount: null },
    downtime: { interludes: 0, craftingFocus: "", professionChecksRequired: true, itemReviewRequired: true, freeBuildOptions: [] },
    dedicationRewarding: false,
    customVows: [],
  },
  origin: { catalogId: "custom", clanId: "custom", name: "", clan: "", attributeBonuses: {}, description: "" },
  mechanics: { race: null },
  technique: {
    kind: "cursed",
    name: "",
    basicFunction: "",
    counterplay: "",
    attributeKeys: ["intelligence"],
    intrinsicBenefits: "",
    limitations: "",
    requiredItems: "",
    reviewNotes: "",
    powers: [],
  },
  techniqueLibraryId: null,
  attributes: {
    base: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, presence: 10 },
    permanentBonuses: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, presence: 0 },
  },
  bonuses: { attention: 0, defense: 0, initiative: 0, movement: 0, healthMaximum: 0, energyMaximum: 0, techniqueDc: 0 },
  resources: { health: { current: 0, bonusMaximum: 0 }, energy: { current: 0, bonusMaximum: 0 } },
  skills: [],
  spells: [],
  invocations: [],
  images: [],
  equipment: [],
  attacks: [],
  defenses: [],
  conditions: [],
  combatants: [],
  deathSaves: { successes: 0, failures: 0, stabilized: false, notes: "" },
  damageReductions: [],
  resistances: [],
  vulnerabilities: [],
  inspiration: 1,
  energyLimit: 999999,
  diary: [],
  missionRewards: [],
  aptitudes: [],
  training: [],
  allies: [],
  cursedTools: [],
  domainExpansion: null,
  customResources: [],
  transformations: [],
  mutantCores: undefined,
});
