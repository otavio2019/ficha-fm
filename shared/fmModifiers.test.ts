import { describe, expect, it } from "vitest";
import { FM_DECLARED_MODIFIER_RULES, isDeclaredModifierInRange } from "./fmModifiers";

describe("contrato de modificadores declarados", () => {
  it("documenta um contexto e a referência oficial para cada tipo de modificador permitido", () => {
    expect(FM_DECLARED_MODIFIER_RULES.skill.citation).toContain("p. 278");
    expect(FM_DECLARED_MODIFIER_RULES.attack.citation).toContain("279");
    expect(FM_DECLARED_MODIFIER_RULES.spellCost.sourceField).toBe("effect-or-notes");
    expect(FM_DECLARED_MODIFIER_RULES.spellCombat.sourceField).toBe("effect-or-notes");
  });

  it("aceita apenas valores finitos dentro da faixa declarada", () => {
    expect(isDeclaredModifierInRange(20, "skill")).toBe(true);
    expect(isDeclaredModifierInRange(-20, "attack")).toBe(true);
    expect(isDeclaredModifierInRange(21, "spellCost")).toBe(false);
    expect(isDeclaredModifierInRange(Number.NaN, "sheet")).toBe(false);
  });
});
