import { describe, expect, it } from "vitest";
import { createEmptyFMSheet, type FMAptitude } from "./fmTypes";
import { getAptitudeIncreaseEligibility, getAptitudeLevel, increaseAptitude } from "./fmAptitudeProgression";
import { diffContent, versionChangeSummary } from "./fmVersioning";

function makeSheet() {
  const sheet = createEmptyFMSheet();
  sheet.progression.level = 4;
  sheet.progression.experience = 44;
  const aptitude: FMAptitude = {
    id: "aptitude-1",
    catalogId: "barriers",
    name: "Barreiras",
    group: "domain",
    requiredLevel: 3,
    cost: 1,
    prerequisite: "—",
    effect: "Estrutura barreiras declaradas.",
    description: "Estrutura barreiras declaradas.",
    approved: true,
    modifiers: [],
    requirements: [],
    limitations: "",
    effects: [],
    evolutions: [],
    selectedEvolutionId: null,
  };
  sheet.aptitudes = [aptitude];
  return sheet;
}

describe("progressão de Aptidões", () => {
  it("aumenta uma Aptidão adquirida e registra o histórico", () => {
    const first = increaseAptitude(makeSheet(), "barriers");
    expect("error" in first).toBe(false);
    if ("error" in first) return;
    expect(getAptitudeLevel(first.sheet, "barriers")).toBe(2);
    expect(first.record.previousLevel).toBe(1);
    expect(first.record.newLevel).toBe(2);
    expect(first.sheet.aptitudeProgression?.history).toHaveLength(1);
  });

  it("bloqueia progressão acima do nível 5", () => {
    const sheet = makeSheet();
    sheet.aptitudeProgression = { levels: { barriers: 5 }, history: [] };
    const eligibility = getAptitudeIncreaseEligibility(sheet, "barriers");
    expect(eligibility.allowed).toBe(false);
    expect(eligibility.reasons.join(" ")).toContain("nível máximo");
  });
});

describe("versionamento de conteúdo", () => {
  it("produz caminhos alterados e não acusa mudança para conteúdo igual", () => {
    expect(diffContent({ effect: "a" }, { effect: "b" })).toEqual([{ path: "effect", previous: "a", next: "b" }]);
    expect(versionChangeSummary({ effect: "a" }, { effect: "a" })).toMatchObject({ changed: false, count: 0 });
  });
});
