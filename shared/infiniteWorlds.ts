import type { FMCharacterSheet } from "./fmTypes";

export const INFINITE_WORLDS_XP_BY_LEVEL = {
  1: 0, 2: 20, 3: 45, 4: 75, 5: 100, 6: 145, 7: 200, 8: 265, 9: 300, 10: 375,
  11: 460, 12: 555, 13: 665, 14: 800, 15: 960, 16: 1130, 17: 1300, 18: 1530,
  19: 1780, 20: 2050, 21: 2340, 22: 2650, 23: 2980, 24: 3330, 25: 3700,
  26: 4090, 27: 4500, 28: 4930, 29: 5380, 30: 6499,
} as const;

export type InfiniteWorldGradeId = "fourth" | "third" | "second" | "first" | "special";
export type InfiniteWorldMissionDifficulty = "easy" | "medium" | "hard" | "hard-plus";
export type InfiniteWorldMoneyDifficulty = "easy" | "normal" | "hard";

type GradeDefinition = {
  id: InfiniteWorldGradeId;
  label: string;
  minLevel: number;
  maxLevel: number;
  minExperience: number;
  maxExperience: number;
  missionXp: Record<InfiniteWorldMissionDifficulty, number>;
  missionMoney: Record<InfiniteWorldMoneyDifficulty, number>;
};

export const INFINITE_WORLDS_GRADES: GradeDefinition[] = [
  { id: "fourth", label: "4º Grau", minLevel: 1, maxLevel: 4, minExperience: 0, maxExperience: 75, missionXp: { easy: 3, medium: 5, hard: 8, "hard-plus": 12 }, missionMoney: { easy: 3000, normal: 5000, hard: 7500 } },
  { id: "third", label: "3º Grau", minLevel: 5, maxLevel: 8, minExperience: 76, maxExperience: 265, missionXp: { easy: 5, medium: 8, hard: 12, "hard-plus": 18 }, missionMoney: { easy: 6000, normal: 10000, hard: 15000 } },
  { id: "second", label: "2º Grau", minLevel: 9, maxLevel: 13, minExperience: 300, maxExperience: 665, missionXp: { easy: 8, medium: 12, hard: 18, "hard-plus": 27 }, missionMoney: { easy: 12000, normal: 20000, hard: 30000 } },
  { id: "first", label: "1º Grau", minLevel: 14, maxLevel: 16, minExperience: 800, maxExperience: 1130, missionXp: { easy: 12, medium: 18, hard: 27, "hard-plus": 40 }, missionMoney: { easy: 24000, normal: 40000, hard: 60000 } },
  { id: "special", label: "Grau Especial", minLevel: 17, maxLevel: 30, minExperience: 1300, maxExperience: 6499, missionXp: { easy: 18, medium: 27, hard: 40, "hard-plus": 60 }, missionMoney: { easy: 48000, normal: 80000, hard: 120000 } },
];

export function getInfiniteWorldLevel(experience: number) {
  const safeExperience = Math.max(0, Math.floor(experience));
  const levels = Object.entries(INFINITE_WORLDS_XP_BY_LEVEL).map(([level, required]) => ({ level: Number(level), required }));
  return levels.reduce((current, entry) => safeExperience >= entry.required ? entry.level : current, 1);
}

export function getInfiniteWorldGrade(level: number) {
  const safeLevel = Math.min(30, Math.max(1, Math.floor(level)));
  return INFINITE_WORLDS_GRADES.find(grade => safeLevel >= grade.minLevel && safeLevel <= grade.maxLevel) ?? INFINITE_WORLDS_GRADES[0];
}

export function getExperienceForLevel(level: number) {
  const safeLevel = Math.min(30, Math.max(1, Math.floor(level))) as keyof typeof INFINITE_WORLDS_XP_BY_LEVEL;
  return INFINITE_WORLDS_XP_BY_LEVEL[safeLevel];
}

export function getExperienceToNextLevel(experience: number) {
  const level = getInfiniteWorldLevel(experience);
  if (level >= 30) return null;
  const nextLevelExperience = getExperienceForLevel(level + 1);
  return Math.max(0, nextLevelExperience - Math.max(0, Math.floor(experience)));
}

export function getInfiniteWorldProgress(experience: number) {
  const level = getInfiniteWorldLevel(experience);
  const grade = getInfiniteWorldGrade(level);
  return { experience: Math.max(0, Math.floor(experience)), level, grade, nextLevelExperience: level < 30 ? getExperienceForLevel(level + 1) : null, experienceToNextLevel: getExperienceToNextLevel(experience) };
}

export function getMissionExperienceReward(grade: InfiniteWorldGradeId, difficulty: InfiniteWorldMissionDifficulty) {
  return INFINITE_WORLDS_GRADES.find(item => item.id === grade)?.missionXp[difficulty] ?? 0;
}

export function getMissionMoneyReward(grade: InfiniteWorldGradeId, difficulty: InfiniteWorldMoneyDifficulty, dedicationRewarding = false) {
  const grades: InfiniteWorldGradeId[] = ["fourth", "third", "second", "first", "special"];
  const rewardGrade = dedicationRewarding ? grades[Math.min(grades.length - 1, Math.max(0, grades.indexOf(grade)) + 1)] ?? grade : grade;
  return INFINITE_WORLDS_GRADES.find(item => item.id === rewardGrade)?.missionMoney[difficulty] ?? 0;
}

export function getMissionInterludeReward(difficulty: InfiniteWorldMissionDifficulty) {
  return difficulty === "hard" ? 1 : difficulty === "hard-plus" ? 1.5 : 0;
}

export function applyInfiniteWorldMission(sheet: FMCharacterSheet, difficulty: InfiniteWorldMissionDifficulty, moneyDifficulty: InfiniteWorldMoneyDifficulty, at = Date.now()) {
  const currentProgress = getInfiniteWorldProgress(sheet.progression.experience ?? 0);
  const experience = getMissionExperienceReward(currentProgress.grade.id, difficulty);
  const money = getMissionMoneyReward(currentProgress.grade.id, moneyDifficulty, sheet.houseRules.dedicationRewarding);
  const interludes = getMissionInterludeReward(difficulty);
  const nextProgress = getInfiniteWorldProgress(currentProgress.experience + experience);
  return {
    rewards: { experience, money, interludes, grade: currentProgress.grade.label },
    sheet: {
      ...sheet,
      progression: { ...sheet.progression, experience: nextProgress.experience, level: nextProgress.level, specializationLevels: nextProgress.level },
      identity: { ...sheet.identity, grade: nextProgress.grade.label },
      guild: { ...(sheet.guild ?? { currency: 0 }), currency: (sheet.guild?.currency ?? 0) + money },
      houseRules: { ...sheet.houseRules, rest: { ...sheet.houseRules.rest, exhaustion: sheet.houseRules.rest.exhaustion + 1, missionCount: sheet.houseRules.rest.missionCount + 1, lastMissionAt: at, longRestMissionCount: null }, downtime: { ...sheet.houseRules.downtime, interludes: sheet.houseRules.downtime.interludes + interludes } },
    },
  };
}
