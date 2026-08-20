import { describe, expect, it } from "vitest";
import { canAdvanceTraining, canLearnAptitude, getAptitudeCatalogEntry, getAptitudePointSummary, getTrainingFocusSummary } from "./fmCampaignCapabilities";
import { createEmptyFMSheet } from "./fmTypes";

describe("capacidades de campanha", () => {
  it("expõe aptidões catalogadas com grupo, nível e custo", () => {
    expect(getAptitudeCatalogEntry("complete-domain")).toMatchObject({ group: "domain", requiredLevel: 12, cost: 3 });
  });

  it("limita a seleção de aptidões ao nível e ao orçamento disponível", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.level = 4;
    expect(canLearnAptitude(sheet, "controlled-aura")).toBe(false);
    sheet.aptitudes = [{ id: "apt-1", catalogId: "expanded-affinity", name: "Afinidade Ampliada", group: "aura", requiredLevel: 1, cost: 1, prerequisite: "—", effect: "", approved: false }];
    expect(getAptitudePointSummary(sheet)).toEqual({ total: 2, spent: 1, available: 1 });
    expect(canLearnAptitude(sheet, "controlled-aura")).toBe(true);
    expect(canLearnAptitude(sheet, "complete-domain")).toBe(false);
  });

  it("converte Interlúdios em dois focos e limita cada trilha a quatro etapas", () => {
    const sheet = createEmptyFMSheet();
    sheet.houseRules.downtime.interludes = 2;
    sheet.training = [{ trackId: "agility", stage: 3, notes: "" }];
    expect(getTrainingFocusSummary(sheet)).toEqual({ total: 4, spent: 3, available: 1 });
    expect(canAdvanceTraining(sheet, "agility")).toBe(true);
    sheet.training = [{ trackId: "agility", stage: 4, notes: "" }];
    expect(canAdvanceTraining(sheet, "agility")).toBe(false);
  });
});
