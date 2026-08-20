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

export const fmSavingThrowKeys = ["astucia", "fortitude", "integridade", "reflexos", "vontade"] as const;
export type FMSavingThrowKey = (typeof fmSavingThrowKeys)[number];

export type FMSkill = {
  id: string;
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

export type FMTechnique = {
  kind: FMTechniqueKind;
  name: string;
  basicFunction: string;
  attributeKeys: FMAttributeKey[];
  intrinsicBenefits: string;
  limitations: string;
  requiredItems: string;
  reviewNotes: string;
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
};

export type FMEquipmentItem = {
  id: string;
  name: string;
  category: "weapon" | "shield" | "uniform" | "tool" | "special" | "other";
  damage: string;
  damageType: string;
  range: string;
  defenseBonus: number;
  weight: number;
  equipped: boolean;
  notes: string;
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
  origin: {
    name: string;
    attributeBonuses: Partial<FMAttributes>;
    description: string;
  };
  technique: FMTechnique;
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
  equipment: FMEquipmentItem[];
  attacks: FMAttack[];
  defenses: FMDefenseEntry[];
  conditions: FMCondition[];
  combatants: FMCombatant[];
  diary: FMDiaryEntry[];
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
    healthMode: "average",
    rolledHealthGains: [],
    techniqueAttribute: "intelligence",
    specializationCdAttribute: "strength",
    savingThrowTraining: { astucia: false, fortitude: false, integridade: false, reflexos: false, vontade: false },
    optionalLevelZero: false,
    nonSorcerer: false,
  },
  guild: { currency: 0 },
  origin: { name: "", attributeBonuses: {}, description: "" },
  technique: {
    kind: "cursed",
    name: "",
    basicFunction: "",
    attributeKeys: ["intelligence"],
    intrinsicBenefits: "",
    limitations: "",
    requiredItems: "",
    reviewNotes: "",
  },
  attributes: {
    base: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, presence: 10 },
    permanentBonuses: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, presence: 0 },
  },
  bonuses: { attention: 0, defense: 0, initiative: 0, movement: 0, healthMaximum: 0, energyMaximum: 0, techniqueDc: 0 },
  resources: { health: { current: 0, bonusMaximum: 0 }, energy: { current: 0, bonusMaximum: 0 } },
  skills: [],
  spells: [],
  equipment: [],
  attacks: [],
  defenses: [],
  conditions: [],
  combatants: [],
  diary: [],
});
