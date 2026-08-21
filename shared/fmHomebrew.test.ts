import { describe, expect, it } from "vitest";
import { createEmptyHomebrew, normalizeHomebrewContent, validateHomebrew, validateReview } from "./fmHomebrew";

describe("Homebrew genérico", () => {
  it("cria conteúdo estruturado por categoria com campos extensíveis", () => {
    const draft = createEmptyHomebrew("training");
    expect(draft).toMatchObject({ kind: "training", content: { fields: { focus: "", stages: "" } } });
  });

  it("normaliza dados legados e exige o núcleo necessário para salvar", () => {
    expect(normalizeHomebrewContent({ description: "Treino", fields: { focus: "Interlúdios", ignored: 2 } })).toMatchObject({ description: "Treino", fields: { focus: "Interlúdios" } });
    expect(validateHomebrew({ kind: "aptitude", name: "", summary: "", content: createEmptyHomebrew().content })).toEqual(expect.arrayContaining(["Informe o nome do conteúdo.", "Informe um resumo do conteúdo.", "Descreva o funcionamento do conteúdo."]));
  });

  it("exige autoria, seção e motivo para avaliações", () => {
    expect(validateReview({ targetId: "homebrew-1", reviewerName: "", kind: "suggestion", section: "Custo", reason: "" })).toEqual(expect.arrayContaining(["Informe seu nome para enviar a avaliação.", "Explique o motivo da avaliação ou sugestão."]));
  });
});
