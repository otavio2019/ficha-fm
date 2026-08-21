import { fmAttributeKeys, type FMAttributes, type FMCharacterSheet, type FMMutantCore, type FMMutantCoreState, type FMResourceState, type FMSpecializationKey } from "./fmTypes";

export const FM_MUTANT_CURSED_CORPSE_ORIGIN = "mutant-cursed-corpse" as const;
export const FM_MUTANT_CORE_COUNT = 3;

const cloneAttributes = (attributes: FMAttributes): FMAttributes => Object.fromEntries(fmAttributeKeys.map(attribute => [attribute, Number.isFinite(attributes[attribute]) ? attributes[attribute] : 10])) as FMAttributes;
const cloneResource = (resource: FMResourceState | undefined): FMResourceState => ({ current: Number.isFinite(resource?.current) ? Math.max(0, resource!.current) : 0, bonusMaximum: Number.isFinite(resource?.bonusMaximum) ? resource!.bonusMaximum : 0 });
const emptyResource = (): FMResourceState => ({ current: 0, bonusMaximum: 0 });

export function isMutantCursedCorpse(sheet: Pick<FMCharacterSheet, "origin">) {
  return sheet.origin.catalogId === FM_MUTANT_CURSED_CORPSE_ORIGIN;
}

export function getMutantCoreSize(level: number): FMMutantCore["size"] {
  if (level >= 6) return "medium";
  return "small";
}

function createCore(input: { id: string; name: string; sheet: Pick<FMCharacterSheet, "attributes" | "resources" | "spells" | "progression">; primary: boolean }): FMMutantCore {
  const specialization = (input.sheet.progression.primarySpecialization ?? input.sheet.progression.specialization) as FMSpecializationKey;
  return {
    id: input.id,
    name: input.name,
    description: "",
    specialization,
    attributes: cloneAttributes(input.sheet.attributes.base),
    resources: {
      health: cloneResource(input.sheet.resources.health),
      energy: cloneResource(input.sheet.resources.energy),
    },
    spells: input.primary ? [...input.sheet.spells] : [],
    abilities: [],
    characteristics: [],
    specializationAbilityChoices: input.primary ? [...(input.sheet.progression.specializationAbilityChoices ?? [])] : [],
    size: getMutantCoreSize(input.sheet.progression.level),
    damaged: false,
    destroyed: false,
    deathSaveFailures: 0,
    notes: "",
  };
}

export function createMutantCoreState(sheet: Pick<FMCharacterSheet, "attributes" | "resources" | "spells" | "progression">): FMMutantCoreState {
  const primary = createCore({ id: "mutant-core-primary", name: "Núcleo Primário", sheet, primary: true });
  const secondaryOne = createCore({ id: "mutant-core-secondary-1", name: "Núcleo Secundário I", sheet, primary: false });
  const secondaryTwo = createCore({ id: "mutant-core-secondary-2", name: "Núcleo Secundário II", sheet, primary: false });
  return { cores: [primary, secondaryOne, secondaryTwo], primaryCoreId: primary.id, activeCoreId: primary.id, soulIntegrityCurrent: null };
}

function normalizeCore(value: Partial<FMMutantCore>, sheet: Pick<FMCharacterSheet, "attributes" | "progression">, index: number): FMMutantCore {
  const fallback = createCore({ id: `mutant-core-${index + 1}`, name: index === 0 ? "Núcleo Primário" : `Núcleo Secundário ${index}`, sheet: { ...sheet, resources: { health: emptyResource(), energy: emptyResource() }, spells: [] }, primary: false });
  return {
    ...fallback,
    ...value,
    id: typeof value.id === "string" && value.id.trim() ? value.id : fallback.id,
    name: typeof value.name === "string" ? value.name : fallback.name,
    attributes: cloneAttributes(value.attributes ?? fallback.attributes),
    resources: { health: cloneResource(value.resources?.health), energy: cloneResource(value.resources?.energy) },
    spells: Array.isArray(value.spells) ? value.spells : [],
    abilities: Array.isArray(value.abilities) ? value.abilities.filter((entry): entry is string => typeof entry === "string") : [],
    characteristics: Array.isArray(value.characteristics) ? value.characteristics.filter((entry): entry is string => typeof entry === "string") : [],
    specializationAbilityChoices: Array.isArray(value.specializationAbilityChoices) ? value.specializationAbilityChoices : [],
    size: sheet.progression.level >= 15 && value.size === "large" ? "large" : getMutantCoreSize(sheet.progression.level),
    damaged: Boolean(value.damaged),
    destroyed: Boolean(value.destroyed),
    deathSaveFailures: Number.isInteger(value.deathSaveFailures) ? Math.max(0, Math.min(3, value.deathSaveFailures as number)) : 0,
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

export function normalizeMutantCoreState(value: unknown, sheet: Pick<FMCharacterSheet, "attributes" | "resources" | "spells" | "progression">): FMMutantCoreState {
  if (!value || typeof value !== "object" || !Array.isArray((value as FMMutantCoreState).cores)) return createMutantCoreState(sheet);
  const raw = value as Partial<FMMutantCoreState>;
  const cores = raw.cores!.slice(0, FM_MUTANT_CORE_COUNT).map((core, index) => normalizeCore(core, sheet, index));
  while (cores.length < FM_MUTANT_CORE_COUNT) cores.push(createCore({ id: `mutant-core-${cores.length + 1}`, name: cores.length === 0 ? "Núcleo Primário" : `Núcleo Secundário ${cores.length}`, sheet, primary: false }));
  const uniqueCores = cores.map((core, index) => cores.findIndex(candidate => candidate.id === core.id) === index ? core : { ...core, id: `${core.id}-${index + 1}` });
  const primaryCoreId = uniqueCores.some(core => core.id === raw.primaryCoreId) ? raw.primaryCoreId! : uniqueCores[0].id;
  const activeCoreId = uniqueCores.some(core => core.id === raw.activeCoreId && !core.destroyed && !core.damaged) ? raw.activeCoreId! : primaryCoreId;
  return { cores: uniqueCores, primaryCoreId, activeCoreId, soulIntegrityCurrent: typeof raw.soulIntegrityCurrent === "number" ? Math.max(0, raw.soulIntegrityCurrent) : null };
}

export function getMutantPrimaryCore(state: FMMutantCoreState | undefined) {
  return state?.cores.find(core => core.id === state.primaryCoreId) ?? null;
}

export function getMutantActiveCore(state: FMMutantCoreState | undefined) {
  return state?.cores.find(core => core.id === state.activeCoreId) ?? getMutantPrimaryCore(state);
}

export function getEffectiveMutantSheet(sheet: FMCharacterSheet): FMCharacterSheet {
  if (!isMutantCursedCorpse(sheet) || !sheet.mutantCores) return sheet;
  const active = getMutantActiveCore(sheet.mutantCores);
  if (!active) return sheet;
  return {
    ...sheet,
    progression: {
      ...sheet.progression,
      specialization: active.specialization,
      specializationLevels: sheet.progression.level,
      primarySpecialization: active.specialization,
      primarySpecializationLocked: true,
      specializationTracks: [{ specialization: active.specialization, level: sheet.progression.level }],
      specializationAbilityChoices: active.specializationAbilityChoices,
    },
    attributes: { ...sheet.attributes, base: cloneAttributes(active.attributes) },
    resources: { health: cloneResource(active.resources.health), energy: cloneResource(active.resources.energy) },
    spells: [...active.spells],
  };
}

export function updateActiveMutantCore(sheet: FMCharacterSheet, updater: (core: FMMutantCore) => FMMutantCore): FMCharacterSheet {
  if (!isMutantCursedCorpse(sheet) || !sheet.mutantCores) return sheet;
  const active = getMutantActiveCore(sheet.mutantCores);
  if (!active) return sheet;
  return { ...sheet, mutantCores: { ...sheet.mutantCores, cores: sheet.mutantCores.cores.map(core => core.id === active.id ? updater(core) : core) } };
}

export function getAttributeTotal(attributes: FMAttributes) {
  return fmAttributeKeys.reduce((total, attribute) => total + attributes[attribute], 0);
}

/** Ajusta um recurso pela diferença entre os máximos anterior e posterior da troca de núcleo. */
export function getMutantResourceAfterCoreSwap(current: number, previousMaximum: number, nextMaximum: number) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePreviousMaximum = Math.max(0, Number.isFinite(previousMaximum) ? previousMaximum : 0);
  const safeNextMaximum = Math.max(0, Number.isFinite(nextMaximum) ? nextMaximum : 0);
  return Math.min(safeNextMaximum, Math.max(0, safeCurrent - (safePreviousMaximum - safeNextMaximum)));
}
