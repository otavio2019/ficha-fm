import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "./fmTypes";
import { getDedicationRewardGrade, getHouseMinimumHealth, getHouseRestAvailability, getMassiveDamageOutcome, rollHouseAttributeGeneration, validateHouseRules } from "./fmHouseRules";

describe("Regras da Casa Infinite Worlds", () => {
  it("repete 6#4d6dl1 até obter pelo menos 72 pontos", () => {
    let calls = 0;
    const generation = rollHouseAttributeGeneration(() => ++calls <= 24 ? 0 : 0.999);
    expect(generation.values).toHaveLength(6);
    expect(generation.total).toBeGreaterThanOrEqual(72);
    expect(generation.attempts).toBeGreaterThan(1);
  });

  it("reconhece descanso curto, descanso longo único por missão e exaustão", () => {
    const sheet = createEmptyFMSheet();
    sheet.houseRules.rest = { ...sheet.houseRules.rest, missionCount: 2, exhaustion: 1, lastMissionAt: 1_000, longRestMissionCount: 1 };
    expect(getHouseRestAvailability(sheet.houseRules.rest, 1_000 + 2 * 60 * 60 * 1000).shortRestReady).toBe(true);
    expect(getHouseRestAvailability(sheet.houseRules.rest, 1_000 + 4 * 60 * 60 * 1000).longRestReady).toBe(true);
    sheet.houseRules.rest.longRestMissionCount = 2;
    expect(getHouseRestAvailability(sheet.houseRules.rest, 1_000 + 4 * 60 * 60 * 1000).longRestReady).toBe(false);
  });

  it("identifica morte instantânea apenas quando uma fonte reduz PV a menos do negativo máximo", () => {
    expect(getMassiveDamageOutcome(10, 30, 39)).toMatchObject({ nextHealth: -29, instantDeath: false });
    expect(getMassiveDamageOutcome(10, 30, 40)).toMatchObject({ nextHealth: -30, instantDeath: true });
  });

  it("separa Vida Mínima dos aumentos adicionais de PV", () => {
    expect(getHouseMinimumHealth(38, 8)).toBe(30);
    expect(getHouseMinimumHealth(1, 8)).toBe(1);
  });

  it("usa o grau imediatamente superior para Dedicação Recompensadora, limitado ao Especial", () => {
    expect(getDedicationRewardGrade("fourth", true)).toBe("third");
    expect(getDedicationRewardGrade("special", true)).toBe("special");
    expect(getDedicationRewardGrade("first", false)).toBe("first");
  });

  it("valida geração, voto bloqueado, declaração e Free Build", () => {
    expect(validateHouseRules({ attributeGeneration: { values: [3, 3, 3, 3, 3, 3], total: 18 }, birthVow: { type: "none", locked: true }, actionDeclaration: { locked: true, attribute: null }, downtime: { freeBuildOptions: [{ name: "", prerequisites: "", interludeCost: 2 }] } }).length).toBeGreaterThan(0);
  });

  it("aceita fichas legadas que ainda não possuem o bloco de Regras da Casa", () => {
    expect(validateHouseRules(undefined)).toEqual([]);
  });
});
