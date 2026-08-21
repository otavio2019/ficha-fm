import { FM_SPECIALIZATION_ABILITY_SEED } from "../shared/fmSpecializationAbilities";
import { listFMSpecializationAbilities, upsertFMSpecializationAbilities } from "./db";

const asJsonArray = (value: unknown) => value as Record<string, unknown>[];

export async function ensureFMSpecializationAbilityCatalog() {
  await upsertFMSpecializationAbilities(FM_SPECIALIZATION_ABILITY_SEED.map(ability => ({
    id: ability.id,
    specialization: ability.specialization,
    name: ability.name,
    description: ability.description,
    abilityType: ability.kind,
    unlockLevel: ability.requiredLevel,
    requirements: asJsonArray(ability.requirements),
    modifiers: asJsonArray(ability.modifiers),
    effects: asJsonArray(ability.effects),
    status: ability.status,
    isAutomatic: ability.isAutomatic,
    requiresChoice: ability.requiresChoice,
    evolutionOf: ability.evolutionOf,
    displayOrder: ability.displayOrder,
    rulesVersion: ability.rulesVersion,
    source: ability.source,
  })));
}

export async function listSeededFMSpecializationAbilities(specialization?: string) {
  await ensureFMSpecializationAbilityCatalog();
  return listFMSpecializationAbilities(specialization);
}
