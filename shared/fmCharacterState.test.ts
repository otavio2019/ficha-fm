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

  it("aplica efeitos de Aptidão em Perícia e desbloqueios, substituindo a forma anterior ao evoluir", () => {
    const sheet = createEmptyFMSheet();
    sheet.attributes.base.strength = 10;
    sheet.skills = [{ id: "combate", name: "Combate Corpo a Corpo", attribute: "strength", proficiency: "trained", otherBonus: 0, notes: "" }];
    sheet.aptitudes = [{
      id: "forca-sobrenatural", catalogId: "forca-sobrenatural", name: "Força Sobrenatural", group: "special", requiredLevel: 1, cost: 1, prerequisite: "—", effect: "", approved: true,
      modifiers: [{ id: "forca-base", target: "strength", operation: "add", value: 2 }],
      effects: [{ id: "combate-base", type: "skill-modifier", skillId: "combate", value: 1 }, { id: "desbloqueio-base", type: "unlock", target: "ability", referenceId: "golpe-pesado", label: "Golpe pesado" }],
      evolutions: [{ id: "nivel-2", name: "Nível 2", description: "", level: 2, requirements: [], modifiers: [{ id: "forca-nivel-2", target: "strength", operation: "add", value: 3 }], effects: [{ id: "combate-nivel-2", type: "skill-modifier", skillId: "combate", value: 2 }, { id: "traco-nivel-2", type: "feature", label: "Corpo reforçado", description: "Descrição" }], limitations: "", replacesBaseEffects: true }],
      selectedEvolutionId: "nivel-2",
    }];

    const state = calculateCharacterState(sheet);
    expect(state.attributes.strength).toBe(13);
    expect(state.skillModifiers.combate).toBe(2);
    expect(state.appliedSkillEffects).toHaveLength(1);
    expect(state.unlocks).toHaveLength(0);
    expect(state.features).toMatchObject([{ label: "Corpo reforçado" }]);
  });

  it("reavalia requisitos de Aptidão ao trocar a Raça e remove o efeito quando a condição deixa de existir", () => {
    const sheet = createEmptyFMSheet();
    sheet.attributes.base.strength = 10;
    sheet.aptitudes = [{ id: "linhagem", catalogId: "linhagem", name: "Força da Linhagem", group: "special", requiredLevel: 1, cost: 0, prerequisite: "—", effect: "", approved: true, requirements: [{ type: "race", raceId: "rajang" }], modifiers: [{ id: "linhagem-for", target: "strength", operation: "add", value: 2 }] }];
    expect(calculateCharacterState(sheet).attributes.strength).toBe(10);
    sheet.mechanics.race = { id: "rajang", sourceKind: "custom", name: "Rajang", description: "", active: true, requirements: [], modifiers: [], characteristics: [], abilities: [], evolutions: [], selectedEvolutionId: null };
    expect(calculateCharacterState(sheet).attributes.strength).toBe(12);
    sheet.mechanics.race = null;
    expect(calculateCharacterState(sheet).attributes.strength).toBe(10);
  });
});
