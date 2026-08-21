import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "./fmTypes";
import { createMutantCoreState, FM_MUTANT_CURSED_CORPSE_ORIGIN, getEffectiveMutantSheet, getMutantResourceAfterCoreSwap, normalizeMutantCoreState, updateActiveMutantCore } from "./fmMutantCores";

describe("Corpo Amaldiçoado Mutante", () => {
  function createMutantSheet() {
    const sheet = createEmptyFMSheet();
    sheet.origin.catalogId = FM_MUTANT_CURSED_CORPSE_ORIGIN;
    sheet.attributes.base = { strength: 12, dexterity: 11, constitution: 10, intelligence: 10, wisdom: 9, presence: 8 };
    sheet.resources.health.current = 12;
    sheet.resources.energy.current = 4;
    sheet.mutantCores = createMutantCoreState(sheet);
    return sheet;
  }

  it("cria exatamente três núcleos persistentes, com Técnica e feitiços apenas no núcleo primário", () => {
    const sheet = createMutantSheet();
    expect(sheet.mutantCores?.cores).toHaveLength(3);
    expect(sheet.mutantCores?.primaryCoreId).toBe("mutant-core-primary");
    expect(sheet.mutantCores?.activeCoreId).toBe("mutant-core-primary");
    expect(sheet.mutantCores?.cores.map(core => core.spells)).toEqual([[], [], []]);
    expect(sheet.mutantCores?.cores.map(core => core.resources.health.current)).toEqual([12, 12, 12]);
    expect(sheet.mutantCores?.cores.map(core => core.resources.energy.current)).toEqual([4, 4, 4]);
  });

  it("usa atributos e recursos do núcleo ativo sem alterar os dados compartilhados", () => {
    const sheet = createMutantSheet();
    const second = sheet.mutantCores!.cores[1];
    second.attributes = { strength: 8, dexterity: 15, constitution: 10, intelligence: 10, wisdom: 9, presence: 8 };
    second.resources.health.current = 4;
    sheet.mutantCores!.activeCoreId = second.id;

    const effective = getEffectiveMutantSheet(sheet);
    expect(effective.attributes.base).toEqual(second.attributes);
    expect(effective.resources.health.current).toBe(4);
    expect(sheet.attributes.base.strength).toBe(12);
  });

  it("ajusta recursos pela diferença entre máximos e respeita os limites do núcleo de destino", () => {
    expect(getMutantResourceAfterCoreSwap(10, 20, 15)).toBe(5);
    expect(getMutantResourceAfterCoreSwap(10, 20, 25)).toBe(15);
    expect(getMutantResourceAfterCoreSwap(2, 20, 10)).toBe(0);
    expect(getMutantResourceAfterCoreSwap(30, 20, 12)).toBe(12);
  });

  it("normaliza repetidamente sem duplicar núcleos e atualiza apenas o núcleo ativo", () => {
    const sheet = createMutantSheet();
    const once = normalizeMutantCoreState(sheet.mutantCores, sheet);
    const twice = normalizeMutantCoreState(once, sheet);
    const updated = updateActiveMutantCore({ ...sheet, mutantCores: twice }, core => ({ ...core, notes: "Núcleo em combate" }));

    expect(twice.cores).toHaveLength(3);
    expect(new Set(twice.cores.map(core => core.id)).size).toBe(3);
    expect(updated.mutantCores?.cores.filter(core => core.notes === "Núcleo em combate")).toHaveLength(1);
  });
});
