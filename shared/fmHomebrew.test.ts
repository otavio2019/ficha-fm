import { describe, expect, it } from "vitest";
import { createEmptyHomebrew, FM_HOMEBREW_KIND_META, normalizeHomebrewContent, validateHomebrew, validateReview } from "./fmHomebrew";

describe("Homebrew genérico", () => {
  it("cria conteúdo estruturado por categoria com campos extensíveis", () => {
    const draft = createEmptyHomebrew("training");
    expect(draft).toMatchObject({ kind: "training", content: { fields: { focus: "", stages: "" } } });
  });

  it("normaliza dados legados e exige o núcleo necessário para salvar", () => {
    expect(normalizeHomebrewContent({ description: "Treino", fields: { focus: "Interlúdios", ignored: 2 } })).toMatchObject({ description: "Treino", fields: { focus: "Interlúdios" } });
    expect(validateHomebrew({ kind: "aptitude", name: "", summary: "", content: createEmptyHomebrew().content })).toEqual(expect.arrayContaining(["Informe o nome do conteúdo.", "Informe um resumo do conteúdo.", "Descreva o funcionamento do conteúdo."]));
  });

  it("preserva mecânicas estruturadas e fornece valores seguros para conteúdo legado", () => {
    expect(normalizeHomebrewContent({ description: "Legado" }).mechanics).toEqual({ modifiers: [], requirements: [], evolutions: [], raceChoices: [], aptitude: { description: "", requirements: [], modifiers: [], effects: [], limitations: "", evolutions: [] } });
    expect(normalizeHomebrewContent({ mechanics: { modifiers: [{ id: "forca", target: "strength", operation: "add", value: 4 }], requirements: [{ type: "level-min", minimum: 3 }] } }).mechanics).toMatchObject({ modifiers: [{ target: "strength", value: 4 }], requirements: [{ type: "level-min", minimum: 3 }], evolutions: [] });
  });

  it("exige autoria, seção e motivo para avaliações", () => {
    expect(validateReview({ targetId: "homebrew-1", reviewerName: "", kind: "suggestion", section: "Custo", reason: "" })).toEqual(expect.arrayContaining(["Informe seu nome para enviar a avaliação.", "Explique o motivo da avaliação ou sugestão."]));
  });

  it("exige campo específico apenas em sugestões de alteração", () => {
    expect(validateReview({ targetId: "homebrew-1", reviewerName: "Avaliador", kind: "suggestion", section: "Técnica", field: "", reason: "Ajustar o custo." })).toContain("Informe o campo específico da sugestão.");
    expect(validateReview({ targetId: "homebrew-1", reviewerName: "Avaliador", kind: "general", section: "Avaliação geral", field: "", reason: "Conteúdo claro." })).not.toContain("Informe o campo específico da sugestão.");
  });

  it("expõe campos específicos extensíveis para Habilidade sem pressupor regra automática", () => {
    const draft = createEmptyHomebrew("ability");
    expect(FM_HOMEBREW_KIND_META.ability.fieldSpecs.map(field => field.key)).toEqual(["type", "activation", "limitations", "counterplay"]);
    expect(draft.content.fields).toMatchObject({ type: "", activation: "", limitations: "", counterplay: "" });
  });
});
