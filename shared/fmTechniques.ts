import { fmAttributeKeys, type FMAttributeKey, type FMTechnique, type FMTechniqueKind, type FMSpecializationKey } from "./fmTypes";

export const FM_TECHNIQUE_CREATION_CITATION = "Livro-base, pp. 196–198; Estilo Marcial, p. 123";

export const FM_TECHNIQUE_LIMITS = {
  name: 120,
  longText: 4000,
} as const;

export type FMTechniqueValidationIssue = {
  field: keyof FMTechnique | "kind";
  message: string;
};

const attributeKeySet = new Set<string>(fmAttributeKeys);

export function getTechniqueKindForSpecialization(specialization: FMSpecializationKey | string | undefined): FMTechniqueKind {
  return specialization === "restricted" ? "martial" : "cursed";
}

export function getTechniqueCopy(kind: FMTechniqueKind) {
  return kind === "martial"
    ? {
        singular: "Estilo marcial",
        basicFunction: "Fundamento do estilo",
        basicFunctionHint: "Descreva o fundamento do estilo, a abordagem de combate e o que permite fazer.",
        benefits: "Recursos intrínsecos",
        limitations: "Limitações e contrajogo do estilo",
        attributes: "Atributos do estilo",
      }
    : {
        singular: "Técnica amaldiçoada",
        basicFunction: "Funcionamento básico",
        basicFunctionHint: "Descreva o conceito, a dinâmica, os efeitos mecânicos e os limites que guiam os feitiços.",
        benefits: "Benefícios intrínsecos",
        limitations: "Limitações, malefícios e contrajogo",
        attributes: "Atributos da técnica",
      };
}

export function validateTechnique(technique: Partial<FMTechnique> | undefined, specialization: FMSpecializationKey | string | undefined, options: { requireCounterplay?: boolean } = {}): FMTechniqueValidationIssue[] {
  const issues: FMTechniqueValidationIssue[] = [];
  if (!technique) return issues;

  const expectedKind = getTechniqueKindForSpecialization(specialization);
  if (technique.kind !== expectedKind) {
    issues.push({ field: "kind", message: expectedKind === "martial" ? "Personagens restringidos usam Estilo Marcial, não Técnica Amaldiçoada." : "Apenas personagens restringidos usam Estilo Marcial." });
  }

  const name = typeof technique.name === "string" ? technique.name.trim() : "";
  const basicFunction = typeof technique.basicFunction === "string" ? technique.basicFunction.trim() : "";
  const counterplay = typeof technique.counterplay === "string" ? technique.counterplay.trim() : "";
  if (name && name.length > FM_TECHNIQUE_LIMITS.name) issues.push({ field: "name", message: `O nome deve ter no máximo ${FM_TECHNIQUE_LIMITS.name} caracteres.` });
  if (basicFunction && basicFunction.length > FM_TECHNIQUE_LIMITS.longText) issues.push({ field: "basicFunction", message: "O funcionamento básico excede o limite seguro de caracteres." });
  if (options.requireCounterplay && !counterplay && !(typeof technique.limitations === "string" && technique.limitations.trim())) issues.push({ field: "counterplay", message: "A técnica precisa declarar uma resistência, reação ou outro contrajogo no campo de limitações." });
  if (counterplay.length > FM_TECHNIQUE_LIMITS.longText) issues.push({ field: "counterplay", message: "O contrajogo excede o limite seguro de caracteres." });

  const attributes = technique.attributeKeys;
  if (!Array.isArray(attributes) || attributes.length < 1 || attributes.length > fmAttributeKeys.length || attributes.some(attribute => typeof attribute !== "string" || !attributeKeySet.has(attribute))) {
    issues.push({ field: "attributeKeys", message: "Escolha de um a seis atributos válidos para a técnica." });
  } else if (new Set(attributes).size !== attributes.length) {
    issues.push({ field: "attributeKeys", message: "Não repita atributos na técnica." });
  }

  const longFields: Array<keyof Pick<FMTechnique, "intrinsicBenefits" | "limitations" | "requiredItems" | "reviewNotes">> = ["intrinsicBenefits", "limitations", "requiredItems", "reviewNotes"];
  longFields.forEach(field => {
    const value = technique[field];
    if (typeof value !== "string" || value.length > FM_TECHNIQUE_LIMITS.longText) {
      issues.push({ field, message: "Este campo excede o limite seguro de caracteres." });
    }
  });

  const powers = technique.powers;
  if (powers !== undefined) {
    if (!Array.isArray(powers)) issues.push({ field: "reviewNotes", message: "O catálogo de poderes da técnica é inválido." });
    else if (powers.some(power => !power.id || !power.name.trim() || !Number.isInteger(power.requiredCharacterLevel) || power.requiredCharacterLevel < 1 || power.requiredCharacterLevel > 20 || !Number.isInteger(power.spellLevel) || power.spellLevel < 0 || power.spellLevel > 5 || typeof power.summary !== "string" || power.summary.length > FM_TECHNIQUE_LIMITS.longText || typeof power.requirement !== "string" || power.requirement.length > FM_TECHNIQUE_LIMITS.longText)) issues.push({ field: "reviewNotes", message: "Cada poder precisa de nome, nível de personagem, nível de poder e descrição válidos." });
    else if (new Set(powers.map(power => power.id)).size !== powers.length) issues.push({ field: "reviewNotes", message: "Não repita identificadores no catálogo de poderes." });
  }

  return issues;
}

export function isTechniqueReady(technique: Pick<FMTechnique, "name" | "basicFunction" | "attributeKeys">) {
  return Boolean(technique.name.trim() && technique.basicFunction.trim() && technique.attributeKeys.length);
}

export function getPrimaryTechniqueAttribute(technique: Pick<FMTechnique, "attributeKeys">, fallback: FMAttributeKey): FMAttributeKey {
  return technique.attributeKeys.find(attribute => fmAttributeKeys.includes(attribute)) ?? fallback;
}
