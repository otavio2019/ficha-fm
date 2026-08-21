import { describe, expect, it } from "vitest";
import { calculateCharacterState } from "./fmCharacterState";
import { createEmptyFMSheet } from "./fmTypes";

describe("motor de estado do personagem", () => {
  it("separa o valor base e soma modificadores ativos de raça, treinamento, aptidão e equipamento", () => {
    const sheet = createEmptyFMSheet();
    sheet.attributes.base.strength = 12;
    sheet.mechanics.race = { id: "rajang", sourceKind: "custom", name: "Rajang", description: "", active: true, requirements: [], modifiers: [{ id: "rajang-for", target: "strength", operation: "add", value: 4 }], characteristics: [], abilities: [], evolutions: [], selectedEvolutionId: null };
    sheet.training = [{ trackId: "combat", label: "Treino de Luta", stage: 1, notes: "", modifiers: [{ id: "treino-for", target: "strength", operation: "add", value: 2 }] }];
    sheet.aptitudes = [{ id: "aptidao", catalogId: "aptidao", name: "Aptidão de força", group: "special", requiredLevel: 1, cost: 0, prerequisite: "—", effect: "", approved: true, modifiers: [{ id: "aptidao-for", target: "strength", operation: "add", value: 3 }] }];
    sheet.equipment = [{ id: "manopla", name: "Manopla", category: "weapon", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 0, equipped: true, notes: "", modifiers: [{ id: "manopla-for", target: "strength", operation: "add", value: 1 }] }];

    const state = calculateCharacterState(sheet);
    expect(state.attributeBreakdown.strength.base).toBe(12);
    expect(state.attributes.strength).toBe(22);
    expect(state.attributeBreakdown.strength.entries.map(entry => entry.sourceName)).toEqual(["Rajang", "Treino de Luta", "Aptidão de força", "Manopla"]);
  });

  it("substitui os modificadores da forma anterior ao evoluir, sem alterar o valor base", () => {
    const sheet = createEmptyFMSheet();
    sheet.attributes.base.strength = 12;
    sheet.mechanics.race = { id: "rajang", sourceKind: "custom", name: "Rajang", description: "", active: true, requirements: [], modifiers: [{ id: "rajang-for", target: "strength", operation: "add", value: 4 }], characteristics: [], abilities: [], evolutions: [{ id: "adulto", name: "Rajang Adulto", description: "", requirements: [], modifiers: [{ id: "adulto-for", target: "strength", operation: "add", value: 6 }], characteristics: [], abilities: [] }], selectedEvolutionId: "adulto" };

    const state = calculateCharacterState(sheet);
    expect(state.attributes.strength).toBe(18);
    expect(state.attributeBreakdown.strength.base).toBe(12);
    expect(state.attributeBreakdown.strength.entries).toHaveLength(1);
  });

  it("remove modificadores ao desequipar e não aplica fontes com requisito não atendido", () => {
    const sheet = createEmptyFMSheet();
    sheet.attributes.base.strength = 12;
    sheet.equipment = [{ id: "manopla", name: "Manopla", category: "weapon", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 0, equipped: false, notes: "", modifiers: [{ id: "manopla-for", target: "strength", operation: "add", value: 2 }] }];
    sheet.aptitudes = [{ id: "pesada", catalogId: "pesada", name: "Aptidão pesada", group: "special", requiredLevel: 1, cost: 0, prerequisite: "—", effect: "", approved: true, requirements: [{ type: "attribute-min", attribute: "strength", minimum: 14 }], modifiers: [{ id: "pesada-for", target: "strength", operation: "add", value: 3 }] }];

    const state = calculateCharacterState(sheet);
    expect(state.attributes.strength).toBe(12);
    expect(state.requirements).toMatchObject([{ sourceName: "Aptidão pesada", met: false }]);
  });
});
