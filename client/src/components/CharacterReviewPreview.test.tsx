import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "@shared/fmTypes";
import { CharacterReviewPreview } from "./CharacterReviewPreview";

describe("CharacterReviewPreview", () => {
  it("renderiza dados auditáveis de uma ficha compartilhada para avaliação", () => {
    const sheet = createEmptyFMSheet();
    sheet.identity.name = "Rika";
    sheet.identity.grade = "Grau 2";
    sheet.deathSaves = { successes: 2, failures: 1, stabilized: false, notes: "Curada por um aliado" };
    sheet.damageReductions = [{ id: "rd-cortante", damageType: "Cortante", amount: 3, notes: "Armadura" }];
    sheet.resistances = ["Fogo"];
    sheet.invocations = [{ id: "inv-1", name: "Guardião da Névoa", concept: "Protege a retaguarda", type: "tamed-curse", grade: "third", attributes: { strength: 10, dexterity: 12, constitution: 11, intelligence: 10, wisdom: 10, presence: 10 }, movement: 9, trainedAttack: "melee", trainedSavingThrow: "fortitude", trainedSkills: [], actions: [], notes: "", active: true }];
    sheet.training = [{ trackId: "barriers", label: "Barreiras", stage: 2, notes: "Aprendeu a reforçar o véu." }];

    const markup = renderToStaticMarkup(<CharacterReviewPreview content={sheet} />);
    expect(markup).toContain("Identidade e capacidades");
    expect(markup).toContain("Rika");
    expect(markup).toContain("2 sucesso(s)");
    expect(markup).toContain("RD Cortante: 3");
    expect(markup).toContain("Guardião da Névoa");
    expect(markup).toContain("Aprendeu a reforçar o véu.");
  });
});
