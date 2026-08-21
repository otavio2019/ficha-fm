import { describe, expect, it } from "vitest";
import { getSpecializationAbilityEffects, getSpecializationAbilityProgress, mergeSpecializationAbilityUnlockHistory, updateSpecializationAbilityChoice, validateSpecializationAbilityChoices } from "./fmSpecializationAbilities";
import { createEmptyFMSheet } from "./fmTypes";

describe("habilidades de Especialização", () => {
  it("deriva marcos automáticos e escolhas confirmadas pelo nível do núcleo", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.level = 12;
    sheet.progression.specialization = "technique-specialist";
    sheet.progression.specializationLevels = 12;
    sheet.progression.primarySpecialization = "technique-specialist";
    sheet.progression.specializationTracks = [{ specialization: "technique-specialist", level: 12 }];
    sheet.progression.specializationAbilityChoices = [
      { specialization: "technique-specialist", slotId: "technique-foundation-1a", abilityId: "technique-cruel-spell" },
      { specialization: "technique-specialist", slotId: "technique-foundation-1b", abilityId: "technique-distant-spell" },
      { specialization: "technique-specialist", slotId: "technique-focus-10", abilityId: "technique-focus-economy" },
    ];

    const [progress] = getSpecializationAbilityProgress(sheet);
    expect(progress.automatic.map(ability => ability.name)).toEqual(expect.arrayContaining(["Domínio dos Fundamentos", "Foco Amaldiçoado"]));
    expect(progress.choiceSlots.find(slot => slot.id === "technique-focus-10")?.selectedAbility?.name).toBe("Economia");
    expect(getSpecializationAbilityEffects(sheet).map(effect => effect.label)).toEqual(expect.arrayContaining(["Conjuração Aprimorada", "Economia"]));
    expect(validateSpecializationAbilityChoices(sheet.progression)).toEqual([]);
  });

  it("bloqueia duplicação, slot inexistente e nível insuficiente", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.specializationTracks = [{ specialization: "fighter", level: 1 }];
    sheet.progression.specializationAbilityChoices = [
      { specialization: "fighter", slotId: "fighter-excitement-1a", abilityId: "fighter-adjustment" },
      { specialization: "fighter", slotId: "fighter-excitement-1b", abilityId: "fighter-adjustment" },
      { specialization: "fighter", slotId: "fighter-excitement-6", abilityId: "fighter-command" },
    ];

    expect(validateSpecializationAbilityChoices(sheet.progression)).toEqual(expect.arrayContaining([
      "Uma habilidade de Especialização não pode ser selecionada duas vezes no mesmo personagem.",
      "Manobra de Empolgação III exige nível 6 em fighter.",
    ]));
    expect(updateSpecializationAbilityChoice(sheet.progression.specializationAbilityChoices, "fighter", "fighter-excitement-1a", null)).toHaveLength(2);
  });

  it("produz o marco de nível 3 e preserva o histórico de habilidades desbloqueadas", () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.level = 3;
    sheet.progression.specialization = "support";
    sheet.progression.specializationLevels = 3;
    sheet.progression.specializationTracks = [{ specialization: "support", level: 3 }];

    const [progress] = getSpecializationAbilityProgress(sheet);
    expect(progress.automatic.map(ability => ability.id)).toContain("support-inspiring-presence");
    expect(progress.choiceSlots).toHaveLength(0);
    expect(progress.catalogPendingLevels).toEqual([]);
    const history = mergeSpecializationAbilityUnlockHistory([{ abilityId: "support-combat", specialization: "support", coreId: null, unlockedAt: 100, status: "unlocked", selected: false }], [{ abilityId: "support-inspiring-presence", specialization: "support", coreId: null, unlockedAt: null, status: "unlocked", selected: false }], 200);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ abilityId: "support-combat", unlockedAt: 100 }),
      expect.objectContaining({ abilityId: "support-inspiring-presence", unlockedAt: 200 }),
    ]));
  });
});
