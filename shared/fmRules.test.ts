import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "./fmTypes";
import { canAddMulticlass, getAttackBonus, getAttributeModifier, getDerivedValues, getInventoryLoad, getOfficialTrainingBonus, getResourceLabel, getSavingThrowBonus, getSkillBonus, getSpecializationTracks, getSpellCost, getSustainCost, getTechniquePowerProgression, rollD20 } from "./fmRules";

describe("regras de F&M", () => {
  it("calcula modificadores de atributo conforme a tabela oficial", () => {
    expect(getAttributeModifier(8)).toBe(-1);
    expect(getAttributeModifier(10)).toBe(0);
    expect(getAttributeModifier(15)).toBe(2);
    expect(getAttributeModifier(30)).toBe(10);
  });

  it("calcula recursos de um lutador de primeiro nível", () => {
    const sheet = createEmptyFMSheet();
    sheet.attributes.base.constitution = 14;
    const derived = getDerivedValues(sheet);
    expect(derived.healthMaximum).toBe(14);
    expect(derived.energyMaximum).toBe(4);
    expect(derived.trainingBonus).toBe(2);
  });

  it("calcula recursos de um especialista em técnica com modificador de técnica", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.level = 5;
    sheet.progression.specialization = "technique-specialist";
    sheet.progression.specializationLevels = 5;
    sheet.attributes.base.constitution = 14;
    sheet.attributes.base.intelligence = 16;
    const derived = getDerivedValues(sheet);
    expect(derived.healthMaximum).toBe(40);
    expect(derived.energyMaximum).toBe(33);
    expect(derived.trainingBonus).toBe(3);
  });

  it("aplica somente modificadores declarados por feitiços ativos à cena", () => {
    const sheet = createEmptyFMSheet();
    sheet.spells.push({ id: "barreira", name: "Barreira", type: "auxiliary", level: 1, casting: "bonus", reach: "Pessoal", targetOrArea: "Você", durationType: "lasting", durationDetail: "", effect: "", requirement: "", damage: "", damageType: "", resolution: "none", savingThrow: "", costAdjustment: 0, combatModifierTarget: "defense", combatModifier: 2, notes: "", active: true });
    expect(getDerivedValues(sheet)).toMatchObject({ defense: 12, activeCombatModifiers: { defense: 2 } });
  });

  it("usa Estamina para restringido e aplica o ganho médio de vida", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.level = 3;
    sheet.progression.specialization = "restricted";
    sheet.progression.specializationLevels = 3;
    sheet.attributes.base.constitution = 16;
    const derived = getDerivedValues(sheet);
    expect(derived.healthMaximum).toBe(39);
    expect(derived.energyMaximum).toBe(12);
  });

  it("aplica as opções de nível 0 e não-feiticeiro", () => {
    const levelZero = createEmptyFMSheet();
    levelZero.progression.optionalLevelZero = true;
    levelZero.progression.level = 0;
    levelZero.attributes.base.constitution = 14;
    expect(getDerivedValues(levelZero)).toMatchObject({ healthMaximum: 8, energyMaximum: 0, trainingBonus: 1 });

    const nonSorcerer = createEmptyFMSheet();
    nonSorcerer.progression.nonSorcerer = true;
    nonSorcerer.progression.level = 7;
    expect(getDerivedValues(nonSorcerer).energyMaximum).toBe(10);
    expect(getResourceLabel(nonSorcerer.progression.specialization, true)).toBe("Estamina");
  });

  it("aplica treinamento e mestria nas perícias", () => {
    expect(getOfficialTrainingBonus(9)).toBe(4);
    expect(getSkillBonus(9, { strength: 10, dexterity: 10, constitution: 10, intelligence: 16, wisdom: 10, presence: 10 }, "intelligence", "master")).toBe(13);
  });

  it("calcula Resistências/TRs pelo atributo-chave e treinamento", () => {
    const attributes = { strength: 10, dexterity: 14, constitution: 16, intelligence: 18, wisdom: 12, presence: 10 };
    expect(getSavingThrowBonus(5, attributes, "astucia", true)).toBe(9);
    expect(getSavingThrowBonus(5, attributes, "fortitude", true)).toBe(8);
    expect(getSavingThrowBonus(5, attributes, "reflexos", false)).toBe(4);
  });

  it("calcula ataques de corpo a corpo, à distância e amaldiçoados", () => {
    const attributes = { strength: 16, dexterity: 14, constitution: 10, intelligence: 18, wisdom: 10, presence: 10 };
    expect(getAttackBonus({ level: 5, attributes, mode: "melee", trained: true })).toBe(8);
    expect(getAttackBonus({ level: 5, attributes, mode: "ranged", trained: true })).toBe(7);
    expect(getAttackBonus({ level: 5, attributes, mode: "cursed", techniqueAttribute: "intelligence" })).toBe(9);
  });

  it("preserva custo zero e mínimo de um PE nos feitiços", () => {
    expect(getSpellCost(0)).toBe(0);
    expect(getSpellCost(1)).toBe(2);
    expect(getSpellCost(1, -8)).toBe(1);
    expect(getSustainCost(2)).toBe(1);
    expect(getSustainCost(3)).toBe(2);
  });

  it("libera poderes por nível para Especialista em Técnica e por níveis pares para Lutador", () => {
    expect(getTechniquePowerProgression("technique-specialist", 4)).toMatchObject({ unlockLevels: [1, 2, 3, 4], availableSlots: 4, nextUnlockLevel: 5, cadenceLabel: "1 novo poder por nível" });
    expect(getTechniquePowerProgression("fighter", 5)).toMatchObject({ unlockLevels: [2, 4], availableSlots: 2, nextUnlockLevel: 6, cadenceLabel: "1 novo poder em níveis pares" });
  });

  it("valida Multiclasse por atributo e bloqueia combinações com Restringido", () => {
    const attributes = { strength: 16, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, presence: 10 };
    expect(canAddMulticlass(attributes, "fighter", "combat-specialist")).toMatchObject({ allowed: true });
    expect(canAddMulticlass(attributes, "fighter", "technique-specialist")).toMatchObject({ allowed: false, reason: "Requer Inteligência ou Sabedoria 16." });
    expect(canAddMulticlass(attributes, "restricted", "fighter")).toMatchObject({ allowed: false });
  });

  it("preserva a distribuição de níveis de especialização e mede a carga por espaços", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.specializationTracks = [{ specialization: "fighter", level: 2 }, { specialization: "combat-specialist", level: 1 }];
    sheet.equipment = [{ id: "arco", name: "Arco Curto", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "24/48 m", defenseBonus: 0, weight: 2, spaces: 2, quantity: 2, equipped: false, notes: "" }];
    expect(getSpecializationTracks(sheet)).toEqual([{ specialization: "fighter", level: 2 }, { specialization: "combat-specialist", level: 1 }]);
    expect(getInventoryLoad(sheet)).toMatchObject({ spaces: 4, capacity: 8, maximum: 16, overloaded: false });
  });

  it("resolve vantagem e desvantagem com os resultados corretos", () => {
    const sequence = [0, 0.9];
    const random = () => sequence.shift() ?? 0;
    expect(rollD20(3, "advantage", random)).toMatchObject({ dice: [1, 19], kept: 19, total: 22 });
    const sequence2 = [0, 0.9];
    const random2 = () => sequence2.shift() ?? 0;
    expect(rollD20(3, "disadvantage", random2)).toMatchObject({ dice: [1, 19], kept: 1, total: 4 });
  });
});
