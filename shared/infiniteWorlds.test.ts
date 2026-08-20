import { describe, expect, it } from "vitest";
import { applyInfiniteWorldMission, getExperienceToNextLevel, getInfiniteWorldGrade, getInfiniteWorldLevel, getMissionExperienceReward, getMissionInterludeReward, getMissionMoneyReward } from "./infiniteWorlds";
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
});
