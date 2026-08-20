import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "./fmTypes";
import { getPrimaryTechniqueAttribute, getTechniqueKindForSpecialization, isTechniqueReady, validateTechnique } from "./fmTechniques";

describe("criação de técnicas F&M", () => {
  it("usa Estilo Marcial como equivalente da técnica para restringidos", () => {
    expect(getTechniqueKindForSpecialization("restricted")).toBe("martial");
    expect(getTechniqueKindForSpecialization("fighter")).toBe("cursed");
  });

  it("aceita uma técnica com funcionamento e atributos distintos quando compatível", () => {
    const sheet = createEmptyFMSheet();
    sheet.technique.name = "Fios da Aurora";
    sheet.technique.basicFunction = "Manipula fios de energia para conectar e mover objetos.";
    sheet.technique.limitations = "Exige linha de visão e pode ser interrompida por barreiras físicas.";
    sheet.technique.attributeKeys = ["dexterity", "intelligence"];
    expect(validateTechnique(sheet.technique, "fighter")).toEqual([]);
    expect(getPrimaryTechniqueAttribute(sheet.technique, "strength")).toBe("dexterity");
  });

  it("permite salvar rascunho legado sem contrajogo, mas o exige ao publicar na biblioteca", () => {
    const sheet = createEmptyFMSheet();
    sheet.technique.name = "Técnica em revisão";
    sheet.technique.basicFunction = "Ainda está sendo descrita pela mesa.";
    sheet.technique.limitations = "";
    sheet.technique.counterplay = "";
    expect(validateTechnique(sheet.technique, "fighter")).toEqual([]);
    expect(validateTechnique(sheet.technique, "fighter", { requireCounterplay: true }).map(issue => issue.field)).toContain("counterplay");
  });

  it("impede tipo incompatível, atributo repetido e criação incompleta", () => {
    const sheet = createEmptyFMSheet();
    sheet.technique.kind = "martial";
    sheet.technique.name = "";
    sheet.technique.limitations = "Exige um foco físico.";
    sheet.technique.attributeKeys = ["strength", "strength"];
    const issues = validateTechnique(sheet.technique, "fighter");
    expect(issues.map(issue => issue.field)).toEqual(expect.arrayContaining(["kind", "attributeKeys"]));
    expect(isTechniqueReady(sheet.technique)).toBe(false);
  });
});
