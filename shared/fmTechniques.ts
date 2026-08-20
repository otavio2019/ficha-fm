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
        limitations: "Limitações do estilo",
        attributes: "Atributos do estilo",
      }
    : {
        singular: "Técnica amaldiçoada",
        basicFunction: "Funcionamento básico",
        basicFunctionHint: "Descreva o conceito, a dinâmica, os efeitos mecânicos e os limites que guiam os feitiços.",
        benefits: "Benefícios intrínsecos",
        limitations: "Limitações ou malefícios",
        attributes: "Atributos da técnica",
      };
}

export function validateTechnique(technique: Partial<FMTechnique> | undefined, specialization: FMSpecializationKey | string | undefined): FMTechniqueValidationIssue[] {
  const issues: FMTechniqueValidationIssue[] = [];
  if (!technique) return issues;

  const expectedKind = getTechniqueKindForSpecialization(specialization);
  if (technique.kind !== expectedKind) {
    issues.push({ field: "kind", message: expectedKind === "martial" ? "Personagens restringidos usam Estilo Marcial, não Técnica Amaldiçoada." : "Apenas personagens restringidos usam Estilo Marcial." });
  }

  const name = typeof technique.name === "string" ? technique.name.trim() : "";
  const basicFunction = typeof technique.basicFunction === "string" ? technique.basicFunction.trim() : "";
  if (name && name.length > FM_TECHNIQUE_LIMITS.name) issues.push({ field: "name", message: `O nome deve ter no máximo ${FM_TECHNIQUE_LIMITS.name} caracteres.` });
  if (basicFunction && basicFunction.length > FM_TECHNIQUE_LIMITS.longText) issues.push({ field: "basicFunction", message: "O funcionamento básico excede o limite seguro de caracteres." });

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

  return issues;
}

export function isTechniqueReady(technique: Pick<FMTechnique, "name" | "basicFunction" | "attributeKeys">) {
  return Boolean(technique.name.trim() && technique.basicFunction.trim() && technique.attributeKeys.length);
}

export function getPrimaryTechniqueAttribute(technique: Pick<FMTechnique, "attributeKeys">, fallback: FMAttributeKey): FMAttributeKey {
  return technique.attributeKeys.find(attribute => fmAttributeKeys.includes(attribute)) ?? fallback;
}
