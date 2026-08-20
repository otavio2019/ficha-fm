export const FM_RULE_CITATIONS = {
  coreValues: "Livro-base, pp. 19–21",
  training: "Livro-base, p. 281",
  skills: "Livro-base, p. 278",
  savingThrows: "Livro-base, p. 280",
  attacks: "Livro-base, pp. 279–281",
  initiative: "Livro-base, p. 291",
  spells: "Livro-base, pp. 198–203",
  combat: "Livro-base, pp. 291–300",
  dice: "Livro-base, pp. 276 e 282",
  optionalRules: "Regras Opcionais, pp. 1–2",
} as const;

export type FMRuleCitationKey = keyof typeof FM_RULE_CITATIONS;
