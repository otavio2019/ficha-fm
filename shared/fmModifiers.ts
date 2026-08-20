export const FM_DECLARED_MODIFIER_RULES = {
  skill: {
    label: "Bônus declarado de perícia",
    minimum: -20,
    maximum: 20,
    citation: "Livro-base, p. 278",
    sourceField: "notes",
  },
  attack: {
    label: "Bônus ou penalidade declarada de ataque",
    minimum: -20,
    maximum: 20,
    citation: "Livro-base, pp. 279–281",
    sourceField: "notes",
  },
  spellCost: {
    label: "Ajuste declarado de custo de feitiço",
    minimum: -20,
    maximum: 20,
    citation: "Livro-base, pp. 198–203",
    sourceField: "effect-or-notes",
  },
  spellCombat: {
    label: "Efeito declarado de feitiço na cena",
    minimum: -20,
    maximum: 20,
    citation: "Livro-base, pp. 291–300",
    sourceField: "effect-or-notes",
  },
  sheet: {
    label: "Modificador declarado da ficha",
    minimum: -20,
    maximum: 20,
    citation: "Livro-base, pp. 19–21",
    sourceField: "sheet-notes",
  },
} as const;

export type FMDeclaredModifierRule = keyof typeof FM_DECLARED_MODIFIER_RULES;

export function isDeclaredModifierInRange(value: unknown, rule: FMDeclaredModifierRule) {
  const { minimum, maximum } = FM_DECLARED_MODIFIER_RULES[rule];
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}
