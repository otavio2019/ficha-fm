import { describe, expect, it } from "vitest";
import { auditCharacter } from "./fmAuditEngine";
import { getExperienceForLevel } from "./infiniteWorlds";
import { createEmptyFMSheet, type FMCharacterSheet } from "./fmTypes";

function validTechnique(sheet: FMCharacterSheet) {
  sheet.technique = {
    ...sheet.technique,
    name: "Fios da Aurora",
    basicFunction: "Manipula fios de energia para conectar alvos.",
    attributeKeys: ["intelligence"],
    intrinsicBenefits: "Carretel essencial.",
    limitations: "Exige linha de visão.",
    counterplay: "Barreiras ou ruptura dos fios.",
  };
}

describe("auditCharacter", () => {
  it("mantém uma ficha com campos opcionais vazios sem erros", () => {
    const result = auditCharacter(createEmptyFMSheet());
    expect(result.summary.errors).toBe(0);
    expect(result.findings.some(item => item.category === "identity" && item.severity === "passed")).toBe(true);
  });

  it("explica um poder acima do nível de especialização", () => {
    const sheet = createEmptyFMSheet();
    validTechnique(sheet);
    sheet.technique.powers = [{ id: "supremo", name: "Golpe Supremo", requiredCharacterLevel: 10, spellLevel: 1, type: "damage", summary: "Poder de teste.", requirement: "Nível 10." }];
    sheet.spells = [{ id: "spell-1", name: "Golpe Supremo", type: "damage", level: 1, casting: "common", reach: "Curto", targetOrArea: "Um alvo", durationType: "immediate", durationDetail: "", effect: "Dano", counterplay: "Defesa", requirement: "", damage: "1d6", damageType: "Energia", resolution: "attack", savingThrow: "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false, sourcePowerId: "supremo" }];
    const result = auditCharacter(sheet);
    expect(result.findings.some(item => item.title.includes("Poder bloqueado") && item.severity === "error")).toBe(true);
  });

  it("detecta distribuição de bônus de origem fora dos limites", () => {
    const sheet = createEmptyFMSheet();
    sheet.origin = { ...sheet.origin, catalogId: "innate", name: "Inato", attributeBonuses: { strength: 3, dexterity: 1 } };
    const result = auditCharacter(sheet);
    expect(result.findings.some(item => item.title === "Bônus de origem inconsistentes" && item.severity === "error")).toBe(true);
  });

  it("detecta pontos de Aptidão acima do orçamento", () => {
    const sheet = createEmptyFMSheet();
    sheet.aptitudes = [{ id: "apt-1", catalogId: "controlled-aura", name: "Aura Controlada", group: "aura", requiredLevel: 2, cost: 1, prerequisite: "Afinidade Ampliada", effect: "Teste", approved: true }];
    const result = auditCharacter(sheet);
    expect(result.findings.some(item => item.title === "Pontos de Aptidão excedidos" && item.severity === "error")).toBe(true);
  });

  it("trata Homebrew pendente como aviso, não como erro automático", () => {
    const sheet = createEmptyFMSheet();
    sheet.aptitudes = [{ id: "apt-homebrew", catalogId: "homebrew:apt-pendente", homebrewId: "apt-pendente", name: "Aptidão da Mesa", group: "special", requiredLevel: 1, cost: 0, prerequisite: "—", effect: "Teste", approved: false }];
    const result = auditCharacter(sheet);
    expect(result.findings.some(item => item.title.includes("aguardando aprovação") && item.severity === "warning")).toBe(true);
  });

  it("detecta evolução de Raça com requisito de nível não atendido", () => {
    const sheet = createEmptyFMSheet();
    sheet.mechanics.race = { id: "raca-teste", sourceKind: "custom", name: "Raça de Teste", description: "", active: true, requirements: [], modifiers: [], characteristics: [], abilities: [], selectedEvolutionId: "evo-1", evolutions: [{ id: "evo-1", name: "Forma Elevada", description: "", requirements: [{ type: "level-min", minimum: 10 }], modifiers: [], characteristics: [], abilities: [] }] };
    const result = auditCharacter(sheet);
    expect(result.findings.some(item => item.category === "requirements" && item.severity === "error")).toBe(true);
  });

  it("reconhece uma Técnica preenchida e válida", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.level = 3;
    sheet.progression.experience = getExperienceForLevel(3);
    sheet.progression.specializationLevels = 3;
    sheet.progression.specializationTracks = [{ specialization: "fighter", level: 3 }];
    validTechnique(sheet);
    const result = auditCharacter(sheet);
    expect(result.findings.some(item => item.category === "technique" && item.severity === "passed")).toBe(true);
  });
});
