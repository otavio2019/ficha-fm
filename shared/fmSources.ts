import type { FMContentSource, FMSourceKind, FMSourceStatus } from "./fmTypes";

export const FM_SOURCE_KIND_LABELS: Record<FMSourceKind, string> = {
  official: "Oficial",
  book: "Livro",
  homebrew: "Homebrew",
  community: "Comunidade",
  adapted: "Adaptado",
  own: "Próprio",
};

export const FM_SOURCE_STATUS_LABELS: Record<FMSourceStatus, string> = {
  verified: "Verificada",
  unverified: "Regra não verificada",
  pending: "Pendente de confirmação",
};

export const FM_RULE_VERSION_LABELS = {
  "2.5.2": "Feiticeiros & Maldições 2.5.2",
  "3.0": "Feiticeiros & Maldições 3.0",
  homebrew: "Homebrew / versão própria",
} as const;

export const createOfficialBookSource = (reference = "Livro-base") : FMContentSource => ({
  kind: "book",
  name: "Feiticeiros & Maldições",
  author: "Livro-base",
  reference,
  url: "",
  rulesVersion: "2.5.2",
  status: "verified",
});

export const createUnverifiedSource = (kind: FMSourceKind = "own"): FMContentSource => ({
  kind,
  name: "Fonte não informada",
  author: "",
  reference: "",
  url: "",
  rulesVersion: "2.5.2",
  status: "unverified",
});

export function normalizeContentSource(source: unknown, fallback?: FMContentSource): FMContentSource {
  const base = fallback ?? createUnverifiedSource();
  if (!source || typeof source !== "object" || Array.isArray(source)) return base;
  const value = source as Record<string, unknown>;
  const kind = typeof value.kind === "string" && value.kind in FM_SOURCE_KIND_LABELS ? value.kind as FMSourceKind : base.kind;
  const status = typeof value.status === "string" && value.status in FM_SOURCE_STATUS_LABELS ? value.status as FMSourceStatus : base.status;
  return {
    kind,
    name: typeof value.name === "string" ? value.name.slice(0, 160) : base.name,
    author: typeof value.author === "string" ? value.author.slice(0, 160) : base.author,
    reference: typeof value.reference === "string" ? value.reference.slice(0, 240) : base.reference,
    url: typeof value.url === "string" ? value.url.slice(0, 500) : base.url,
    rulesVersion: typeof value.rulesVersion === "string" && value.rulesVersion.trim() ? value.rulesVersion.slice(0, 32) : base.rulesVersion,
    status,
  };
}

export function sourceLabel(source: FMContentSource | undefined): string {
  if (!source) return "Fonte não informada · regra não verificada";
  return `${FM_SOURCE_KIND_LABELS[source.kind]} · ${source.name || "Fonte sem nome"}${source.status === "unverified" ? " · regra não verificada" : ""}`;
}
