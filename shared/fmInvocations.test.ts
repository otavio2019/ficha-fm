import { describe, expect, it } from "vitest";
import { FM_INVOCATION_TYPE_LABELS, getInvocationDerived } from "./fmInvocations";
import { createEmptyFMSheet } from "./fmTypes";

describe("invocações", () => {
  it("expõe os três tipos oficiais de Invocação", () => {
    expect(FM_INVOCATION_TYPE_LABELS).toEqual({ puppet: "Corpo Amaldiçoado / Marionete", "tamed-curse": "Maldição Domada", shikigami: "Shikigami" });
  });

  it("calcula custo e valores de uma invocação de Quarto Grau", () => {
    const base = createEmptyFMSheet();
    const invocation = { id: "i1", name: "Cão Divino", concept: "Rastreador", grade: "fourth" as const, attributes: base.attributes.base, movement: 9, trainedAttack: "melee" as const, trainedSavingThrow: "fortitude" as const, trainedSkills: [], actions: [{ id: "a1", name: "Morder", kind: "complex" as const, effect: "Ataque", counterplay: "Defesa" }], notes: "", active: false };
    expect(getInvocationDerived(invocation, 2, 2)).toMatchObject({ health: 17, defense: 12, totalSummonCost: 4, attributeSpend: 12 });
  });
});
