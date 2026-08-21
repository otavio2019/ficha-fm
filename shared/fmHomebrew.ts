export const FM_HOMEBREW_KINDS = ["technique", "vow", "aptitude", "race", "domain", "training", "item", "rule", "other"] as const;
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
  currentValue: string;
  suggestedValue: string;
  reason: string;
};

export const FM_HOMEBREW_KIND_META: Record<FMHomebrewKind, { label: string; summary: string; fieldLabels: Array<[string, string]> }> = {
  technique: { label: "Técnica", summary: "Técnica Amaldiçoada ou Estilo Marcial personalizado.", fieldLabels: [["attribute", "Atributo principal"], ["counterplay", "Contrajogo"]] },
  vow: { label: "Voto", summary: "Voto ou pacto com benefício e sacrifício declarados.", fieldLabels: [["benefit", "Benefício"], ["sacrifice", "Sacrifício ou restrição"]] },
  aptitude: { label: "Aptidão", summary: "Aptidão com nível, custo, requisito e efeito estruturados.", fieldLabels: [["group", "Grupo"], ["approval", "Aprovação do mestre"]] },
  race: { label: "Raça", summary: "Origem, raça ou linhagem personalizada.", fieldLabels: [["attributeBonus", "Bônus de atributo"], ["restriction", "Restrição"]] },
  domain: { label: "Expansão de Domínio", summary: "Domínio com barreira, custo, efeito e contrajogo.", fieldLabels: [["barrier", "Barreira"], ["counterplay", "Contrajogo"]] },
  training: { label: "Treinamento", summary: "Treinamento com foco, etapas, custos e efeitos rastreáveis.", fieldLabels: [["focus", "Foco ou Interlúdios"], ["stages", "Etapas"]] },
  item: { label: "Item", summary: "Item, ferramenta ou encantamento homebrew.", fieldLabels: [["spaces", "Espaços de carga"], ["approval", "Aprovação do mestre"]] },
  rule: { label: "Regra", summary: "Regra opcional ou ajuste de campanha.", fieldLabels: [["scope", "Escopo"], ["counterplay", "Limite ou contrapartida"]] },
  other: { label: "Outro", summary: "Conteúdo personalizado que não se encaixa nas demais categorias.", fieldLabels: [["category", "Categoria sugerida"], ["approval", "Aprovação do mestre"]] },
};

export function createEmptyHomebrew(kind: FMHomebrewKind = "other"): FMHomebrewDraft {
  const meta = FM_HOMEBREW_KIND_META[kind];
  return { id: crypto.randomUUID(), kind, name: "", summary: meta.summary, content: { description: "", requirements: "", effects: "", cost: "", level: "", notes: "", fields: Object.fromEntries(meta.fieldLabels.map(([key]) => [key, ""])) } };
}

export function normalizeHomebrewContent(raw: Record<string, unknown> | undefined): FMHomebrewContent {
  const fallback = createEmptyHomebrew().content;
  const source = raw ?? {};
  const fields: Record<string, string> = {};
  if (source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)) Object.entries(source.fields as Record<string, unknown>).forEach(([key, value]) => { if (typeof value === "string") fields[key] = value; });
  return { description: typeof source.description === "string" ? source.description : fallback.description, requirements: typeof source.requirements === "string" ? source.requirements : fallback.requirements, effects: typeof source.effects === "string" ? source.effects : fallback.effects, cost: typeof source.cost === "string" ? source.cost : fallback.cost, level: typeof source.level === "string" ? source.level : fallback.level, notes: typeof source.notes === "string" ? source.notes : fallback.notes, fields };
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
  if (!input.reason?.trim()) issues.push("Explique o motivo da avaliação ou sugestão.");
  return issues;
}
