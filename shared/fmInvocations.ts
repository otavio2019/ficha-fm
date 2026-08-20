import type { FMAttributes, FMInvocation, FMInvocationGrade } from "./fmTypes";

export const FM_INVOCATION_GRADE_RULES: Record<FMInvocationGrade, { label: string; attributePoints: number; attributeMaximum: number; baseHealth: number; defenseBase: number; summonCost: number; actionSlots: number }> = {
  fourth: { label: "Quarto Grau", attributePoints: 10, attributeMaximum: 16, baseHealth: 10, defenseBase: 10, summonCost: 2, actionSlots: 2 },
  third: { label: "Terceiro Grau", attributePoints: 15, attributeMaximum: 20, baseHealth: 25, defenseBase: 12, summonCost: 4, actionSlots: 2 },
  second: { label: "Segundo Grau", attributePoints: 20, attributeMaximum: 24, baseHealth: 40, defenseBase: 16, summonCost: 6, actionSlots: 3 },
  first: { label: "Primeiro Grau", attributePoints: 30, attributeMaximum: 26, baseHealth: 60, defenseBase: 20, summonCost: 8, actionSlots: 3 },
  special: { label: "Grau Especial", attributePoints: 40, attributeMaximum: 30, baseHealth: 80, defenseBase: 24, summonCost: 12, actionSlots: 4 },
};

export const getInvocationAttributeSpend = (attributes: FMAttributes) => Object.values(attributes).reduce((total, value) => total + (value - 8), 0);
export const getInvocationActionCost = (invocation: FMInvocation) => invocation.actions.reduce((total, action) => total + (action.kind === "complex" ? 2 : action.kind === "simple" ? 1 : 1), 0);
export function getInvocationDerived(invocation: FMInvocation, controllerLevel: number, trainingBonus: number) {
  const rule = FM_INVOCATION_GRADE_RULES[invocation.grade];
  const constitutionHalf = Math.floor(invocation.attributes.constitution / 2);
  const health = rule.baseHealth + (invocation.grade === "fourth" || invocation.grade === "third" ? constitutionHalf + controllerLevel : invocation.attributes.constitution + (invocation.grade === "first" ? Math.floor(controllerLevel * 1.5) : invocation.grade === "special" ? controllerLevel * 2 : controllerLevel));
  const dexterityModifier = Math.floor((invocation.attributes.dexterity - 10) / 2);
  return { ...rule, health, defense: rule.defenseBase + dexterityModifier + trainingBonus, actionCost: getInvocationActionCost(invocation), totalSummonCost: rule.summonCost + getInvocationActionCost(invocation), attributeSpend: getInvocationAttributeSpend(invocation.attributes) };
}
