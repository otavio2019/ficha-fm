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
export type FMInvocationActionKind = "simple" | "complex" | "trait";

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
  powers: FMTechniquePower[];
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

export type FMHouseAttributeGeneration = {
  values: number[];
  total: number;
  attempts: number;
  generatedAt: number;
};

export type FMHouseRules = {
  attributeGeneration: FMHouseAttributeGeneration | null;
  birthVow: { type: FMBirthVowType; description: string; approved: boolean; locked: boolean };
  actionDeclaration: { attribute: FMAttributeKey | null; detail: string; locked: boolean };
  rest: { exhaustion: number; missionCount: number; lastMissionAt: number | null; lastShortRestAt: number | null; lastLongRestAt: number | null; longRestMissionCount: number | null };
  downtime: { interludes: number; craftingFocus: string; professionChecksRequired: boolean; itemReviewRequired: boolean; freeBuildOptions: Array<{ id: string; name: string; sourceSpecialization: FMSpecializationKey; prerequisites: string; interludeCost: 1 }> };
  dedicationRewarding: boolean;
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
  grade: FMInvocationGrade;
  attributes: FMAttributes;
  movement: number;
  trainedAttack: "melee" | "ranged";
  trainedSavingThrow: Exclude<FMSavingThrowKey, "integridade">;
  trainedSkills: string[];
  actions: FMInvocationAction[];
  notes: string;
  active: boolean;
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
};

export type FMSpecializationTrack = {
  specialization: FMSpecializationKey;
  level: number;
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
  name: string;
  group: FMAptitudeGroup;
  requiredLevel: number;
  cost: number;
  prerequisite: string;
  effect: string;
  approved: boolean;
};

export type FMTrainingProgress = {
  trackId: FMTrainingTrackKey;
  stage: 0 | 1 | 2 | 3 | 4;
  notes: string;
};

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
  progression: {
    level: number;
    experience: number;
    specialization: FMSpecializationKey;
    specializationLevels: number;
    primarySpecialization: FMSpecializationKey | null;
    primarySpecializationLocked: boolean;
    specializationTracks: FMSpecializationTrack[];
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
  };
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
  diary: FMDiaryEntry[];
  missionRewards: FMMissionRewardRecord[];
  aptitudes: FMAptitude[];
  training: FMTrainingProgress[];
  allies: FMAlly[];
  cursedTools: FMCursedTool[];
  domainExpansion: FMDomainExpansion | null;
};

export const createEmptyFMSheet = (): FMCharacterSheet => ({
  version: 1,
  identity: { name: "Novo personagem", player: "", grade: "", portraitUrl: null },
  personal: { traits: "", ideals: "", bonds: "", complications: "", innateDomain: "" },
  progression: {
    level: 1,
    experience: 0,
    specialization: "fighter",
    specializationLevels: 1,
    primarySpecialization: null,
    primarySpecializationLocked: false,
    specializationTracks: [],
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
  },
  origin: { catalogId: "custom", clanId: "custom", name: "", clan: "", attributeBonuses: {}, description: "" },
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
  diary: [],
  missionRewards: [],
  aptitudes: [],
  training: [],
  allies: [],
  cursedTools: [],
  domainExpansion: null,
});
