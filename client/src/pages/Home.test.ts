import { describe, expect, it } from "vitest";
import { hydrateSheet } from "./Home";

describe("hidratação de fichas legadas", () => {
  it("adiciona valores seguros das Regras da Casa a uma ficha salva sem esse bloco", () => {
    const sheet = hydrateSheet({ identity: { name: "Ficha antiga" }, progression: { level: 1, specialization: "fighter" } });
    expect(sheet.houseRules).toMatchObject({
      attributeGeneration: null,
      birthVow: { type: "none", approved: false, locked: false },
      actionDeclaration: { attribute: null, locked: false },
      rest: { exhaustion: 0, missionCount: 0 },
      dedicationRewarding: false,
    });
  });

  it("preserva identidade, características, técnica, equipamento e diário após recarregar a ficha reorganizada", () => {
    const sheet = hydrateSheet({
      identity: { name: "Maki", player: "Jogadora", grade: "2º Grau" },
      attributes: { base: { strength: 14 }, permanentBonuses: { strength: 1 } },
      techniqueLibraryId: "tecnica-001",
      technique: { name: "Matriz de Aço", basicFunction: "Cria armas amaldiçoadas.", attributeKeys: ["strength"], limitations: "Exige metal disponível." },
      equipment: [{ id: "item-1", name: "Lança", quantity: 1 }],
      diary: [{ id: "nota-1", at: 100, category: "note", title: "Entrada", detail: "Registro preservado." }],
    });
    expect(sheet.identity).toMatchObject({ name: "Maki", player: "Jogadora", grade: "2º Grau" });
    expect(sheet.attributes.base.strength).toBe(14);
    expect(sheet.attributes.permanentBonuses.strength).toBe(1);
    expect(sheet.techniqueLibraryId).toBe("tecnica-001");
    expect(sheet.technique).toMatchObject({ name: "Matriz de Aço", attributeKeys: ["strength"] });
    expect(sheet.equipment).toHaveLength(1);
    expect(sheet.diary).toHaveLength(1);
  });
});
