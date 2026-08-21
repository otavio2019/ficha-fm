export const FM_AUDIT_CATEGORY_META = [
  { id: "identity", label: "Identidade", tab: "overview" },
  { id: "origin", label: "Origem e Raça", tab: "overview" },
  { id: "clan", label: "Clã", tab: "overview" },
  { id: "attributes", label: "Atributos", tab: "attributes" },
  { id: "skills", label: "Perícias", tab: "skills" },
  { id: "aptitudes", label: "Aptidões", tab: "aptitudes" },
  { id: "training", label: "Treinamentos", tab: "aptitudes" },
  { id: "technique", label: "Técnica", tab: "technique" },
  { id: "powers", label: "Poderes", tab: "spells" },
  { id: "vows", label: "Votos", tab: "house" },
  { id: "equipment", label: "Equipamentos", tab: "equipment" },
  { id: "progression", label: "Progressão", tab: "missions" },
  { id: "points", label: "Pontos", tab: "aptitudes" },
  { id: "requirements", label: "Requisitos", tab: "attributes" },
  { id: "guild-rules", label: "Regras da Guilda", tab: "house" },
] as const;

export type FMAuditCategory = (typeof FM_AUDIT_CATEGORY_META)[number]["id"];
export type FMAuditSeverity = "passed" | "warning" | "error";
export type FMAuditOverallStatus = "valid" | "valid-with-warnings" | "needs-correction";
export type FMAuditTab = (typeof FM_AUDIT_CATEGORY_META)[number]["tab"];
export type FMAuditNavigation = { tab: FMAuditTab; focus?: string };

export type FMAuditFinding = {
  id: string;
  category: FMAuditCategory;
  severity: FMAuditSeverity;
  title: string;
  description: string;
  currentValue?: string;
  expectedValue?: string;
  detail?: string;
  navigation?: FMAuditNavigation;
};

export type FMAuditCategoryResult = {
  category: FMAuditCategory;
  available: boolean;
  findings: FMAuditFinding[];
};

export type FMAuditSummary = {
  passed: number;
  warnings: number;
  errors: number;
  status: FMAuditOverallStatus;
};

export type FMAuditResult = {
  summary: FMAuditSummary;
  categories: FMAuditCategoryResult[];
  findings: FMAuditFinding[];
};

export function summarizeAudit(findings: FMAuditFinding[]): FMAuditSummary {
  const passed = findings.filter(item => item.severity === "passed").length;
  const warnings = findings.filter(item => item.severity === "warning").length;
  const errors = findings.filter(item => item.severity === "error").length;
  return { passed, warnings, errors, status: errors ? "needs-correction" : warnings ? "valid-with-warnings" : "valid" };
}

export function auditMeta(category: FMAuditCategory) {
  return FM_AUDIT_CATEGORY_META.find(item => item.id === category)!;
}
