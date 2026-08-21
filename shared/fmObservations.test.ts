import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "./fmTypes";
import { applyCharacterObservationSuggestion, observationReviewField, parseObservationReviewField } from "./fmObservations";

describe("observações compartilhadas", () => {
  it("codifica e valida apenas caminhos conhecidos de revisão", () => {
    expect(observationReviewField("ally", "ally_1")).toBe("observation:ally:ally_1");
    expect(parseObservationReviewField("observation:ally:ally_1")).toEqual({ entityType: "ally", entityId: "ally_1" });
    expect(parseObservationReviewField("observation:__proto__:x")).toBeNull();
  });

  it("altera somente a observação da entidade indicada", () => {
    const sheet = createEmptyFMSheet();
    sheet.allies = [{ id: "ally_1", name: "Maki", role: "Apoio", bond: "Guilda", healthCurrent: 10, healthMaximum: 10, defense: 12, actions: [], notes: "Anterior" }];
    const next = applyCharacterObservationSuggestion(sheet, observationReviewField("ally", "ally_1"), "Versão sugerida");
    expect(next?.allies[0].notes).toBe("Versão sugerida");
    expect(sheet.allies[0].notes).toBe("Anterior");
  });
});
