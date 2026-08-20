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
    expect(sheet.origin).toMatchObject({ catalogId: "custom", clanId: "custom", clan: "" });
    expect(sheet.invocations).toEqual([]);
    expect(sheet.images).toEqual([]);
  });

  it("reconhece um nome de clã legado sem perder a linhagem textual", () => {
    const sheet = hydrateSheet({ origin: { catalogId: "inherited", clan: "Clã Zenin" } });
    expect(sheet.origin).toMatchObject({ catalogId: "inherited", clanId: "zenin", clan: "Clã Zenin" });
  });

  it("preserva identidade, características, técnica, equipamento e diário após recarregar a ficha reorganizada", () => {
    const sheet = hydrateSheet({
      identity: { name: "Maki", player: "Jogadora", grade: "2º Grau" },
      attributes: { base: { strength: 14 }, permanentBonuses: { strength: 1 } },
      techniqueLibraryId: "tecnica-001",
      technique: { name: "Matriz de Aço", basicFunction: "Cria armas amaldiçoadas.", attributeKeys: ["strength"], limitations: "Exige metal disponível.", powers: [{ id: "poder-aco", name: "Lâmina Moldada", requiredCharacterLevel: 2, spellLevel: 1, type: "damage", summary: "Molda uma lâmina de aço.", requirement: "Exige metal disponível." }] },
      spells: [{ id: "spell-aco", sourcePowerId: "poder-aco", name: "Lâmina Moldada", type: "damage", level: 1, casting: "common", reach: "Toque", targetOrArea: "Uma criatura", durationType: "immediate", durationDetail: "", effect: "Molda uma lâmina de aço.", counterplay: "Defesa", requirement: "Exige metal disponível.", damage: "", damageType: "", resolution: "attack", savingThrow: "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false }],
      equipment: [{ id: "item-1", name: "Lança", quantity: 1 }],
      images: [{ id: "img-1", key: "fichas/maki.png", url: "/manus-storage/fichas/maki.png", name: "maki.png", caption: "Retrato", createdAt: 100 }],
      diary: [{ id: "nota-1", at: 100, category: "note", title: "Entrada", detail: "Registro preservado." }],
    });
    expect(sheet.identity).toMatchObject({ name: "Maki", player: "Jogadora", grade: "2º Grau" });
    expect(sheet.attributes.base.strength).toBe(14);
    expect(sheet.attributes.permanentBonuses.strength).toBe(1);
    expect(sheet.techniqueLibraryId).toBe("tecnica-001");
    expect(sheet.technique).toMatchObject({ name: "Matriz de Aço", attributeKeys: ["strength"] });
    expect(sheet.technique.powers).toMatchObject([{ id: "poder-aco", requiredCharacterLevel: 2 }]);
    expect(sheet.spells).toMatchObject([{ sourcePowerId: "poder-aco", name: "Lâmina Moldada" }]);
    expect(sheet.equipment).toHaveLength(1);
    expect(sheet.images).toMatchObject([{ name: "maki.png", caption: "Retrato" }]);
    expect(sheet.diary).toHaveLength(1);
  });
});
