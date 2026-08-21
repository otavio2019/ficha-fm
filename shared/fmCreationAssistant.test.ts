import { describe, expect, it } from "vitest";
import { applyAutomatedSpellType, createAutomatedSpell, createTechniqueFromPreset, getAutomatedSpellDefaults, getTechniqueCreationPresets } from "./fmCreationAssistant";
import { validateTechnique } from "./fmTechniques";

describe("assistente de criação", () => {
  it("oferece modelos separados para técnicas amaldiçoadas e estilos marciais", () => {
    expect(getTechniqueCreationPresets("cursed")).toHaveLength(3);
    expect(getTechniqueCreationPresets("martial")).toHaveLength(3);
    const martial = createTechniqueFromPreset("martial-guard");
    expect(martial).toMatchObject({ kind: "martial", attributeKeys: ["constitution", "wisdom"] });
    expect(martial.powers[0]).toMatchObject({ type: "auxiliary" });
  });

  it("preenche limitações e contrajogo válidos nos modelos de técnica", () => {
    const technique = { ...createTechniqueFromPreset("cursed-control"), name: "Laço Carmesim" };
    expect(technique.limitations).toContain("resistir");
    expect(validateTechnique(technique, "fighter", { requireCounterplay: true })).toEqual([]);
  });

  it("cria feitiços automatizados com contrajogo e resolução coerentes", () => {
    expect(getAutomatedSpellDefaults("damage")).toMatchObject({ resolution: "attack", counterplay: expect.stringContaining("Defesa") });
    expect(createAutomatedSpell("auxiliary")).toMatchObject({ level: 1, resolution: "saving-throw", savingThrow: "Vontade ou Reflexos", counterplay: expect.any(String) });
    expect(applyAutomatedSpellType(createAutomatedSpell("damage"), "passive")).toMatchObject({ type: "passive", casting: "free", reach: "Pessoal", resolution: "none" });
  });
});
