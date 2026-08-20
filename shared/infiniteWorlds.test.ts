import { describe, expect, it } from "vitest";
import { getExperienceToNextLevel, getInfiniteWorldGrade, getInfiniteWorldLevel, getMissionExperienceReward, getMissionMoneyReward } from "./infiniteWorlds";

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
  });
});
