export type FMContentVersionTarget = "character" | "homebrew" | "technique";
export type FMContentChange = { path: string; previous: unknown; next: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function diffContent(previous: unknown, next: unknown, path = ""): FMContentChange[] {
  if (Object.is(previous, next)) return [];
  if (isRecord(previous) && isRecord(next)) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    return Array.from(keys).flatMap(key => diffContent(previous[key], next[key], path ? `${path}.${key}` : key));
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    const length = Math.max(previous.length, next.length);
    return Array.from({ length }, (_, index) => diffContent(previous[index], next[index], `${path}[${index}]`)).flat();
  }
  return [{ path: path || "content", previous: previous ?? null, next: next ?? null }];
}

export function versionChangeSummary(previous: unknown, next: unknown): Record<string, unknown> {
  const changes = diffContent(previous, next);
  return {
    changed: changes.length > 0,
    count: changes.length,
    paths: changes.slice(0, 120).map(change => change.path),
    changes: changes.slice(0, 80),
  };
}

export function versionReason(previous: unknown, next: unknown, fallback = "Atualização deliberada do conteúdo"): string {
  const changes = diffContent(previous, next);
  return changes.length ? fallback : "Sem alterações mecânicas detectadas";
}
