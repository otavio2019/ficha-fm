import type { FMCharacterSheet, FMObservationEntityType } from "./fmTypes";

export const observationReviewField = (entityType: FMObservationEntityType, entityId: string) => `observation:${entityType}:${entityId}`;

export function parseObservationReviewField(value: string) {
  const match = /^observation:(character|history|domain|aptitude|technique|training|invocation|equipment|advantage|disadvantage|ally|homebrew):([A-Za-z0-9_-]{1,80})$/.exec(value);
  return match ? { entityType: match[1] as FMObservationEntityType, entityId: match[2] } : null;
}

export function applyCharacterObservationSuggestion(sheet: FMCharacterSheet, field: string, observation: string): FMCharacterSheet | null {
  const target = parseObservationReviewField(field);
  if (!target) return null;
  const notes = observation.trim();
  if (target.entityType === "technique" && target.entityId === "technique") return { ...sheet, technique: { ...sheet.technique, notes } };
  if (target.entityType === "domain" && target.entityId === "domain-expansion" && sheet.domainExpansion) return { ...sheet, domainExpansion: { ...sheet.domainExpansion, notes } };
  if (target.entityType === "aptitude" && sheet.aptitudes.some(item => item.id === target.entityId)) return { ...sheet, aptitudes: sheet.aptitudes.map(item => item.id === target.entityId ? { ...item, notes } : item) };
  if (target.entityType === "training" && sheet.training.some(item => item.trackId === target.entityId)) return { ...sheet, training: sheet.training.map(item => item.trackId === target.entityId ? { ...item, notes } : item) };
  if (target.entityType === "invocation" && sheet.invocations.some(item => item.id === target.entityId)) return { ...sheet, invocations: sheet.invocations.map(item => item.id === target.entityId ? { ...item, notes } : item) };
  if (target.entityType === "equipment" && sheet.equipment.some(item => item.id === target.entityId)) return { ...sheet, equipment: sheet.equipment.map(item => item.id === target.entityId ? { ...item, notes } : item) };
  if (target.entityType === "equipment" && sheet.cursedTools.some(item => item.id === target.entityId)) return { ...sheet, cursedTools: sheet.cursedTools.map(item => item.id === target.entityId ? { ...item, notes } : item) };
  if (target.entityType === "ally" && sheet.allies.some(item => item.id === target.entityId)) return { ...sheet, allies: sheet.allies.map(item => item.id === target.entityId ? { ...item, notes } : item) };
  return null;
}
