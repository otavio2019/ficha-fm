import type { FMAptitudeDefinition, FMAptitudeEffect, FMModifierDefinition, FMRequirement, FMRaceChoice, FMRaceEvolution } from "./fmTypes";
export const FM_HOMEBREW_KINDS = ["technique", "vow", "aptitude", "specialization", "race", "domain", "training", "item", "ability", "rule", "other"] as const;
export type FMHomebrewKind = typeof FM_HOMEBREW_KINDS[number];
export const FM_REVIEW_STATUSES = ["pending", "accepted", "rejected", "implemented"] as const;
export type FMReviewStatus = typeof FM_REVIEW_STATUSES[number];
export const FM_REVIEW_KINDS = ["general", "suggestion", "comment"] as const;
export type FMReviewKind = typeof FM_REVIEW_KINDS[number];
export type FMReviewTargetType = "character" | "homebrew";

export type FMHomebrewContent = {
  description: string;
  requirements: string;
  effects: string;
  cost: string;
  level: string;
  notes: string;
  fields: Record<string, string>;
  mechanics: {
    modifiers: FMModifierDefinition[];
    requirements: FMRequirement[];
    evolutions: FMRaceEvolution[];
    raceChoices: FMRaceChoice[];
    aptitude: FMAptitudeDefinition;
    specialization: {
      enabled: boolean;
      type: string;
      effects: FMAptitudeEffect[];
      conditions: string;
      parameters: Record<string, string>;
    };
  };
};

export type FMHomebrewDraft = {
  id: string;
  kind: FMHomebrewKind;
  name: string;
  summary: string;
  content: FMHomebrewContent;
};

export type FMReviewDraft = {
  id: string;
  targetType: FMReviewTargetType;
  targetId: string;
  reviewerName: string;
  kind: FMReviewKind;
  section: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
};

export type FMHomebrewFieldSpec = { key: string; label: string; placeholder?: string; multiline?: boolean };
export type FMHomebrewKindMeta = { label: string; summary: string; fieldSpecs: FMHomebrewFieldSpec[]; fieldLabels: Array<[string, string]> };

function homebrewKind(label: string, summary: string, fieldSpecs: FMHomebrewFieldSpec[]): FMHomebrewKindMeta {
  return { label, summary, fieldSpecs, fieldLabels: fieldSpecs.map(({ key, label: fieldLabel }) => [key, fieldLabel]) };
}

export const FM_HOMEBREW_KIND_META: Record<FMHomebrewKind, FMHomebrewKindMeta> = {
  technique: homebrewKind("Técnica", "Técnica Amaldiçoada ou Estilo Marcial personalizado.", [{ key: "type", label: "Tipo" }, { key: "range", label: "Alcance" }, { key: "damage", label: "Dano" }, { key: "counterplay", label: "Contrajogo", multiline: true }, { key: "limitations", label: "Limitações", multiline: true }]),
  vow: homebrewKind("Voto", "Voto ou pacto com benefício e sacrifício declarados.", [{ key: "condition", label: "Condição", multiline: true }, { key: "benefit", label: "Benefício", multiline: true }, { key: "restriction", label: "Restrição", multiline: true }, { key: "consequence", label: "Consequência", multiline: true }]),
  aptitude: homebrewKind("Aptidão", "Aptidão com nível, custo, requisito e efeito estruturados.", [{ key: "group", label: "Grupo" }, { key: "limitations", label: "Limitações", multiline: true }, { key: "approval", label: "Aprovação do mestre" }]),
  specialization: homebrewKind("Especialização", "Especialização Homebrew opcional, selecionada manualmente e aplicada apenas quando sua mecânica for definida.", [{ key: "source", label: "Fonte", placeholder: "Homebrew" }, { key: "author", label: "Autor" }, { key: "version", label: "Versão" }, { key: "status", label: "Status" }, { key: "mechanicType", label: "Tipo de mecânica" }, { key: "conditions", label: "Condições de uso", multiline: true }]),
  race: homebrewKind("Raça", "Origem, raça ou linhagem personalizada.", [{ key: "characteristics", label: "Características", multiline: true }, { key: "modifiers", label: "Modificadores", multiline: true }, { key: "abilities", label: "Habilidades", multiline: true }, { key: "restrictions", label: "Restrições", multiline: true }]),
  domain: homebrewKind("Expansão de Domínio", "Domínio com barreira, custo, efeito e contrajogo.", [{ key: "conditions", label: "Condições", multiline: true }, { key: "area", label: "Área ou alcance" }, { key: "barrier", label: "Barreira", multiline: true }, { key: "characteristics", label: "Características", multiline: true }, { key: "counterplay", label: "Contrajogo", multiline: true }]),
  training: homebrewKind("Treinamento", "Treinamento com foco, etapas, custos e efeitos rastreáveis.", [{ key: "benefits", label: "Benefícios", multiline: true }, { key: "limitations", label: "Limitações", multiline: true }, { key: "focus", label: "Foco ou Interlúdios" }, { key: "stages", label: "Etapas" }]),
  item: homebrewKind("Item", "Item, ferramenta ou encantamento Homebrew.", [{ key: "category", label: "Categoria" }, { key: "weight", label: "Peso" }, { key: "characteristics", label: "Características", multiline: true }, { key: "limitations", label: "Limitações", multiline: true }]),
  ability: homebrewKind("Habilidade", "Habilidade personalizada sem regra automática presumida.", [{ key: "type", label: "Tipo" }, { key: "activation", label: "Ativação" }, { key: "limitations", label: "Limitações", multiline: true }, { key: "counterplay", label: "Contrajogo", multiline: true }]),
  rule: homebrewKind("Regra", "Regra opcional ou ajuste de campanha.", [{ key: "scope", label: "Escopo" }, { key: "adjustment", label: "Ajuste proposto", multiline: true }, { key: "limitations", label: "Limite ou contrapartida", multiline: true }]),
  other: homebrewKind("Outro", "Conteúdo personalizado que não se encaixa nas demais categorias.", [{ key: "category", label: "Categoria sugerida" }, { key: "approval", label: "Aprovação do mestre" }]),
};

export function createEmptyHomebrew(kind: FMHomebrewKind = "other"): FMHomebrewDraft {
  const meta = FM_HOMEBREW_KIND_META[kind];
  return { id: crypto.randomUUID(), kind, name: "", summary: meta.summary, content: { description: "", requirements: "", effects: "", cost: "", level: "", notes: "", fields: Object.fromEntries(meta.fieldSpecs.map(({ key }) => [key, ""])), mechanics: { modifiers: [], requirements: [], evolutions: [], raceChoices: [], aptitude: { description: "", requirements: [], modifiers: [], effects: [], limitations: "", evolutions: [] }, specialization: { enabled: false, type: "", effects: [], conditions: "", parameters: {} } } } };
}

export function normalizeHomebrewContent(raw: Record<string, unknown> | undefined): FMHomebrewContent {
  const fallback = createEmptyHomebrew().content;
  const source = raw ?? {};
  const fields: Record<string, string> = {};
  if (source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)) Object.entries(source.fields as Record<string, unknown>).forEach(([key, value]) => { if (typeof value === "string") fields[key] = value; });
  const rawMechanics = source.mechanics && typeof source.mechanics === "object" && !Array.isArray(source.mechanics) ? source.mechanics as Record<string, unknown> : {};
  const rawAptitude = rawMechanics.aptitude && typeof rawMechanics.aptitude === "object" && !Array.isArray(rawMechanics.aptitude) ? rawMechanics.aptitude as Record<string, unknown> : {};
  const rawSpecialization = rawMechanics.specialization && typeof rawMechanics.specialization === "object" && !Array.isArray(rawMechanics.specialization) ? rawMechanics.specialization as Record<string, unknown> : {};
  const aptitude = fallback.mechanics.aptitude;
  const specialization = fallback.mechanics.specialization;
  const parameters: Record<string, string> = {};
  if (rawSpecialization.parameters && typeof rawSpecialization.parameters === "object" && !Array.isArray(rawSpecialization.parameters)) Object.entries(rawSpecialization.parameters as Record<string, unknown>).forEach(([key, value]) => { if (typeof value === "string") parameters[key] = value; });
  return { description: typeof source.description === "string" ? source.description : fallback.description, requirements: typeof source.requirements === "string" ? source.requirements : fallback.requirements, effects: typeof source.effects === "string" ? source.effects : fallback.effects, cost: typeof source.cost === "string" ? source.cost : fallback.cost, level: typeof source.level === "string" ? source.level : fallback.level, notes: typeof source.notes === "string" ? source.notes : fallback.notes, fields, mechanics: { modifiers: Array.isArray(rawMechanics.modifiers) ? rawMechanics.modifiers as FMModifierDefinition[] : [], requirements: Array.isArray(rawMechanics.requirements) ? rawMechanics.requirements as FMRequirement[] : [], evolutions: Array.isArray(rawMechanics.evolutions) ? rawMechanics.evolutions as FMRaceEvolution[] : [], raceChoices: Array.isArray(rawMechanics.raceChoices) ? rawMechanics.raceChoices as FMRaceChoice[] : [], aptitude: { description: typeof rawAptitude.description === "string" ? rawAptitude.description : aptitude.description, requirements: Array.isArray(rawAptitude.requirements) ? rawAptitude.requirements as FMRequirement[] : aptitude.requirements, modifiers: Array.isArray(rawAptitude.modifiers) ? rawAptitude.modifiers as FMModifierDefinition[] : aptitude.modifiers, effects: Array.isArray(rawAptitude.effects) ? rawAptitude.effects as FMAptitudeDefinition["effects"] : aptitude.effects, limitations: typeof rawAptitude.limitations === "string" ? rawAptitude.limitations : aptitude.limitations, evolutions: Array.isArray(rawAptitude.evolutions) ? rawAptitude.evolutions as FMAptitudeDefinition["evolutions"] : aptitude.evolutions }, specialization: { enabled: rawSpecialization.enabled === true, type: typeof rawSpecialization.type === "string" ? rawSpecialization.type : specialization.type, effects: Array.isArray(rawSpecialization.effects) ? rawSpecialization.effects as FMAptitudeEffect[] : specialization.effects, conditions: typeof rawSpecialization.conditions === "string" ? rawSpecialization.conditions : specialization.conditions, parameters } } };
}

export function validateHomebrew(input: Partial<FMHomebrewDraft>) {
  const issues: string[] = [];
  if (!FM_HOMEBREW_KINDS.includes(input.kind as FMHomebrewKind)) issues.push("Escolha uma categoria de Homebrew válida.");
  if (typeof input.name !== "string" || !input.name.trim()) issues.push("Informe o nome do conteúdo.");
  else if (input.name.trim().length > 160) issues.push("O nome pode ter no máximo 160 caracteres.");
  if (typeof input.summary !== "string" || !input.summary.trim()) issues.push("Informe um resumo do conteúdo.");
  else if (input.summary.trim().length > 1000) issues.push("O resumo pode ter no máximo 1000 caracteres.");
  const content = input.content;
  if (!content || typeof content !== "object") issues.push("Informe os detalhes estruturados do conteúdo.");
  else if (typeof content.description !== "string" || !content.description.trim()) issues.push("Descreva o funcionamento do conteúdo.");
  return issues;
}

export function validateReview(input: Partial<FMReviewDraft>) {
  const issues: string[] = [];
  if (!input.targetId) issues.push("O conteúdo avaliado não foi encontrado.");
  if (!input.reviewerName?.trim()) issues.push("Informe seu nome para enviar a avaliação.");
  if (!FM_REVIEW_KINDS.includes(input.kind as FMReviewKind)) issues.push("Escolha o tipo de avaliação.");
  if (!input.section?.trim()) issues.push("Informe a seção ou campo avaliado.");
  if (input.kind === "suggestion" && !input.field?.trim()) issues.push("Informe o campo específico da sugestão.");
  if (!input.reason?.trim()) issues.push("Explique o motivo da avaliação ou sugestão.");
  return issues;
}
