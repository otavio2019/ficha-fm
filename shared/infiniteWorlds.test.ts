import { describe, expect, it } from "vitest";
import { applyInfiniteWorldMission, getExperienceToNextLevel, getInfiniteWorldGrade, getInfiniteWorldLevel, getMissionExperienceReward, getMissionInterludeReward, getMissionMoneyReward, getMissionRewardPreview } from "./infiniteWorlds";
import { createEmptyFMSheet } from "./fmTypes";

describe("progressão Infinite Worlds", () => {
  it("respeita os limiares oficiais de XP e as transições de grau", () => {
    expect(getInfiniteWorldLevel(0)).toBe(1);
    expect(getInfiniteWorldLevel(75)).toBe(4);
    expect(getInfiniteWorldLevel(100)).toBe(5);
    expect(getInfiniteWorldGrade(5).label).toBe("3º Grau");
    expect(getInfiniteWorldLevel(6499)).toBe(30);
    expect(getExperienceToNextLevel(6499)).toBeNull();
  });

  it("consulta as recompensas exatas de missão por grau", () => {
    expect(getMissionExperienceReward("second", "hard-plus")).toBe(27);
    expect(getMissionMoneyReward("first", "normal")).toBe(40000);
    expect(getMissionMoneyReward("special", "hard")).toBe(120000);
    expect(getMissionMoneyReward("fourth", "normal", true)).toBe(10000);
    expect(getMissionMoneyReward("special", "hard", true)).toBe(120000);
  });

  it("concede Interlúdios somente nas dificuldades previstas", () => {
    expect(getMissionInterludeReward("easy")).toBe(0);
    expect(getMissionInterludeReward("medium")).toBe(0);
    expect(getMissionInterludeReward("hard")).toBe(1);
    expect(getMissionInterludeReward("hard-plus")).toBe(1.5);
  });

  it("aplica e preserva recompensa de missão com XP, grau, descanso e Interlúdios", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.experience = 75;
    sheet.progression.level = 4;
    sheet.progression.specializationLevels = 4;
    sheet.identity.grade = "4º Grau";
    const result = applyInfiniteWorldMission(sheet, "hard-plus", "normal", 1000);

    expect(result.rewards).toMatchObject({ experience: 12, money: 5000, interludes: 1.5, grade: "4º Grau" });
    expect(result.sheet).toMatchObject({ progression: { experience: 87, level: 4 }, identity: { grade: "4º Grau" }, guild: { currency: 5000 }, houseRules: { rest: { exhaustion: 1, missionCount: 1, lastMissionAt: 1000 }, downtime: { interludes: 1.5 } } });
  });

  it("mantém a recompensa-base e soma extras autorizados em uma prévia separada", () => {
    const sheet = createEmptyFMSheet();
    const preview = getMissionRewardPreview(sheet, "hard", "normal", { experience: 4.8, money: 1250.9, interludes: 0.7, description: "Ferramenta amaldiçoada recuperada." });

    expect(preview.base).toMatchObject({ experience: 8, money: 5000, interludes: 1 });
    expect(preview.extra).toMatchObject({ experience: 4, money: 1250, interludes: 0.5, description: "Ferramenta amaldiçoada recuperada." });
    expect(preview.total).toMatchObject({ experience: 12, money: 6250, interludes: 1.5 });
  });

  it("arquiva base, extras e total ao aplicar uma missão", () => {
    const sheet = createEmptyFMSheet();
    const result = applyInfiniteWorldMission(sheet, "medium", "normal", 2_000, { title: "Ecos do Templo", experience: 3, money: 700, interludes: 0.5, description: "Recebeu um talismã." });

    expect(result.sheet).toMatchObject({ progression: { experience: 8 }, guild: { currency: 5700 }, houseRules: { downtime: { interludes: 0.5 } }, missionRewards: [{ id: "mission-2000-1", title: "Ecos do Templo", at: 2_000, base: { experience: 5, money: 5000, interludes: 0 }, extra: { experience: 3, money: 700, interludes: 0.5, description: "Recebeu um talismã." }, total: { experience: 8, money: 5700, interludes: 0.5 } }] });
  });
});
