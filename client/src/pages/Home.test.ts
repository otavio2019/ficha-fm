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
});
