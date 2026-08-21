import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { FM_MULTICLASS_REQUIREMENTS, FM_SPECIALIZATION_PROFILES, getHighestSpellLevel, getTechniquePowerProgression } from "../shared/fmRules";
import { getEquipmentCatalogEntry, getSkillCatalogEntry } from "../shared/fmCatalogs";
import { FM_DECLARED_MODIFIER_RULES, isDeclaredModifierInRange, type FMDeclaredModifierRule } from "../shared/fmModifiers";
import { getInfiniteWorldLevel } from "../shared/infiniteWorlds";
import { validateTechnique } from "../shared/fmTechniques";
import { getSheetSpecializationAbilityUnlocks, mergeSpecializationAbilityUnlockHistory, validateSpecializationAbilityChoices } from "../shared/fmSpecializationAbilities";
import { FM_MUTANT_CORE_COUNT, FM_MUTANT_CURSED_CORPSE_ORIGIN } from "../shared/fmMutantCores";
import { validateHouseRules } from "../shared/fmHouseRules";
import { FM_CLAN_CATALOG, FM_ORIGIN_CATALOG, getClanCatalogEntry, getOriginAttributeAllocation, getOriginCatalogEntry } from "../shared/fmOrigins";
import { FM_INVOCATION_GRADE_RULES, FM_INVOCATION_TYPE_LABELS } from "../shared/fmInvocations";
import { getAptitudeCatalogEntry, getAptitudeDefinition } from "../shared/fmCampaignCapabilities";
import { FM_HOMEBREW_KINDS, FM_REVIEW_KINDS, FM_REVIEW_STATUSES, validateHomebrew, validateReview } from "../shared/fmHomebrew";
import { normalizeHomebrewContent } from "../shared/fmHomebrew";
import { applyCharacterObservationSuggestion } from "../shared/fmObservations";
import { fmAttributeKeys, type FMCharacterSheet, type FMModifierTarget, type FMRequirement } from "../shared/fmTypes";
import { calculateCharacterState } from "../shared/fmCharacterState";
import { storagePut } from "./storage";
import { createFMChangeHistory, createFMCharacterShare, createFMContentShare, createFMReview, deleteFMCharacter, deleteFMHomebrew, deleteFMTechnique, getFMCharacter, getFMCharacterShare, getFMContentShare, getFMHomebrew, getFMReview, getFMTechnique, getSharedFMCharacter, getSharedFMContent, listFMChangeHistory, listFMCharacters, listFMCharacterShares, listFMContentShares, listFMHomebrews, listFMReviews, listFMTechniques, regenerateFMContentShare, saveFMCharacter, saveFMHomebrew, saveFMTechnique, syncFMCharacterSpecializationAbilities, setFMContentShareEnabled, updateFMReview } from "./db";
import { ensureFMSpecializationAbilityCatalog, listSeededFMSpecializationAbilities } from "./fmSpecializationAbilityCatalog";
import { emitCharacterUpdated } from "./live";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const validSkillAttributes = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "presence"]);
const validSkillProficiencies = new Set(["untrained", "trained", "master"]);
const validOriginIds = new Set([...FM_ORIGIN_CATALOG.map(origin => origin.id), "custom"]);
const validClanIds = new Set([...FM_CLAN_CATALOG.map(clan => clan.id), "custom"]);
const storedImageUrl = z.union([z.string().url(), z.string().regex(/^\/manus-storage\//)]);
const modifierTargetInput: z.ZodType<FMModifierTarget> = z.union([z.enum([...fmAttributeKeys, "healthMaximum", "energyMaximum", "attention", "defense", "initiative", "movement", "techniqueDc"]), z.string().regex(/^extra:[a-zA-Z0-9_-]{1,64}$/)]).transform(value => value as FMModifierTarget);
const requirementInput: z.ZodType<FMRequirement> = z.lazy(() => z.discriminatedUnion("type", [
  z.object({ type: z.literal("attribute-min"), attribute: z.enum(fmAttributeKeys), minimum: z.number().finite() }),
  z.object({ type: z.literal("level-min"), minimum: z.number().finite() }),
  z.object({ type: z.literal("aptitude"), aptitudeId: z.string().min(1).max(160) }),
  z.object({ type: z.literal("training"), trainingId: z.string().min(1).max(160) }),
  z.object({ type: z.literal("race"), raceId: z.string().min(1).max(160) }),
  z.object({ type: z.literal("origin"), originId: z.string().min(1).max(160) }),
  z.object({ type: z.literal("skill-min"), skillId: z.string().min(1).max(160), minimum: z.number().finite() }),
  z.object({ type: z.literal("grade"), grade: z.string().min(1).max(160) }),
  z.object({ type: z.literal("technique"), techniqueId: z.string().min(1).max(160) }),
  z.object({ type: z.literal("vow"), vowType: z.enum(["none", "congenital-restriction", "celestial-restriction"]) }),
  z.object({ type: z.literal("item"), itemId: z.string().min(1).max(160) }),
  z.object({ type: z.literal("all"), requirements: z.array(requirementInput).min(1).max(12) }),
  z.object({ type: z.literal("any"), requirements: z.array(requirementInput).min(1).max(12) }),
]));
const modifierDefinitionInput = z.object({ id: z.string().min(1).max(64), target: modifierTargetInput, operation: z.literal("add"), value: z.number().finite().min(-20).max(20), active: z.boolean().optional(), conditions: z.array(requirementInput).optional(), note: z.string().max(1000).optional() });
const raceChoiceOptionInput = z.object({ id: z.string().min(1).max(64), name: z.string().trim().min(1).max(160), description: z.string().max(4000), modifiers: z.array(modifierDefinitionInput).default([]) });
const raceChoiceInput = z.object({ id: z.string().min(1).max(64), label: z.string().trim().min(1).max(160), description: z.string().max(4000), requirements: z.array(requirementInput).default([]), options: z.array(raceChoiceOptionInput).min(1).max(12) });
const raceEvolutionInput = z.object({ id: z.string().min(1).max(64), name: z.string().trim().min(1).max(160), description: z.string().max(4000), replacesBaseModifiers: z.boolean().optional(), requirements: z.array(requirementInput).default([]), modifiers: z.array(modifierDefinitionInput).default([]), characteristics: z.array(z.string().max(1000)).default([]), abilities: z.array(z.string().max(1000)).default([]), choices: z.array(raceChoiceInput).default([]) });
const aptitudeEffectInput = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(64), type: z.literal("skill-modifier"), skillId: z.string().min(1).max(160), value: z.number().finite().min(-20).max(20), note: z.string().max(1000).optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("unlock"), target: z.enum(["technique", "ability", "training", "vow", "item"]), referenceId: z.string().min(1).max(160), label: z.string().min(1).max(160), description: z.string().max(4000).optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("feature"), label: z.string().min(1).max(160), description: z.string().min(1).max(4000) }),
]);
const aptitudeEvolutionInput = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(160), description: z.string().max(4000), level: z.number().int().min(1).max(30), requirements: z.array(requirementInput).default([]), modifiers: z.array(modifierDefinitionInput).default([]), effects: z.array(aptitudeEffectInput).default([]), limitations: z.string().max(4000).default(""), replacesBaseEffects: z.boolean().optional() });
const aptitudeMechanicsInput = z.object({ description: z.string().max(8000).default(""), requirements: z.array(requirementInput).default([]), modifiers: z.array(modifierDefinitionInput).default([]), effects: z.array(aptitudeEffectInput).default([]), limitations: z.string().max(4000).default(""), evolutions: z.array(aptitudeEvolutionInput).default([]) }).default({ description: "", requirements: [], modifiers: [], effects: [], limitations: "", evolutions: [] });
const homebrewMechanicsInput = z.object({ modifiers: z.array(modifierDefinitionInput).default([]), requirements: z.array(requirementInput).default([]), evolutions: z.array(raceEvolutionInput).default([]), raceChoices: z.array(raceChoiceInput).default([]), aptitude: aptitudeMechanicsInput }).default({ modifiers: [], requirements: [], evolutions: [], raceChoices: [], aptitude: { description: "", requirements: [], modifiers: [], effects: [], limitations: "", evolutions: [] } });
const homebrewContentInput = z.object({ description: z.string().max(8000), requirements: z.string().max(8000), effects: z.string().max(8000), cost: z.string().max(1000), level: z.string().max(1000), notes: z.string().max(8000), fields: z.record(z.string(), z.string().max(4000)), mechanics: homebrewMechanicsInput });
const homebrewInput = z.object({ id: z.string().min(6).max(64), kind: z.enum(FM_HOMEBREW_KINDS), name: z.string().trim().min(1).max(160), summary: z.string().trim().min(1).max(1000), content: homebrewContentInput }).superRefine((input, context) => validateHomebrew(input).forEach(message => context.addIssue({ code: "custom", path: ["content"], message })));
const reviewSubmissionInput = z.object({ token: z.string().min(8).max(64), reviewerName: z.string().trim().min(1).max(160), kind: z.enum(FM_REVIEW_KINDS), section: z.string().trim().min(1).max(160), field: z.string().trim().max(160).default(""), currentValue: z.string().max(8000).default(""), suggestedValue: z.string().max(8000).default(""), reason: z.string().trim().min(1).max(8000) }).superRefine((input, context) => validateReview({ ...input, targetId: "shared" }).forEach(message => context.addIssue({ code: "custom", path: message.includes("campo específico") ? ["field"] : ["reason"], message })));
const reviewOwnerUpdateInput = z.object({ id: z.string().min(6).max(64), status: z.enum(FM_REVIEW_STATUSES), ownerResponse: z.string().max(8000).default("") });
const reviewTargetInput = z.object({ targetType: z.enum(["character", "homebrew", "technique"]), targetId: z.string().min(6).max(64) });
const contentShareTargetInput = reviewTargetInput;
const contentShareIdInput = z.object({ id: z.number().int().positive() });
function validateDeclaredModifier(value: unknown, path: (string | number)[], rule: FMDeclaredModifierRule, context: z.RefinementCtx) {
  if (!isDeclaredModifierInRange(value, rule)) {
    const specification = FM_DECLARED_MODIFIER_RULES[rule];
    context.addIssue({ code: "custom", path, message: `${specification.label} deve ficar entre ${specification.minimum} e +${specification.maximum}.` });
  }
}

const mechanicModifierTargets = new Set([...fmAttributeKeys, "healthMaximum", "energyMaximum", "attention", "defense", "initiative", "movement", "techniqueDc"]);
const mechanicRequirementTypes = new Set(["attribute-min", "level-min", "aptitude", "training", "race", "origin", "skill-min", "grade", "technique", "vow", "item", "all", "any"]);
const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
function validateMechanicRequirements(value: unknown, path: (string | number)[], context: z.RefinementCtx, depth = 0) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30 || depth > 4) { context.addIssue({ code: "custom", path, message: "Requisitos mecânicos devem ser uma lista de até 30 entradas e quatro níveis de composição." }); return; }
  value.forEach((entry, index) => {
    const requirement = asRecord(entry);
    const type = requirement?.type;
    if (!requirement || typeof type !== "string" || !mechanicRequirementTypes.has(type)) { context.addIssue({ code: "custom", path: [...path, index], message: "Tipo de requisito mecânico inválido." }); return; }
    if (type === "attribute-min" && (typeof requirement.attribute !== "string" || !fmAttributeKeys.includes(requirement.attribute as typeof fmAttributeKeys[number]) || typeof requirement.minimum !== "number" || !Number.isFinite(requirement.minimum))) context.addIssue({ code: "custom", path: [...path, index], message: "Requisito de atributo inválido." });
    if (type === "level-min" && (typeof requirement.minimum !== "number" || !Number.isInteger(requirement.minimum) || requirement.minimum < 1 || requirement.minimum > 30)) context.addIssue({ code: "custom", path: [...path, index], message: "O nível mínimo deve ficar entre 1 e 30." });
    if (type === "skill-min" && (typeof requirement.skillId !== "string" || !requirement.skillId.trim() || requirement.skillId.length > 160 || typeof requirement.minimum !== "number" || !Number.isFinite(requirement.minimum))) context.addIssue({ code: "custom", path: [...path, index], message: "Requisito de perícia inválido." });
    if (["aptitude", "training", "race", "origin", "grade", "technique", "item"].includes(type)) { const key = type === "aptitude" ? "aptitudeId" : type === "training" ? "trainingId" : type === "race" ? "raceId" : type === "origin" ? "originId" : type === "grade" ? "grade" : type === "technique" ? "techniqueId" : "itemId"; if (typeof requirement[key] !== "string" || !(requirement[key] as string).trim() || (requirement[key] as string).length > 160) context.addIssue({ code: "custom", path: [...path, index, key], message: "A referência do requisito mecânico é inválida." }); }
    if (type === "vow" && !["none", "congenital-restriction", "celestial-restriction"].includes(String(requirement.vowType))) context.addIssue({ code: "custom", path: [...path, index, "vowType"], message: "O voto exigido é inválido." });
    if (type === "all" || type === "any") { if (!Array.isArray(requirement.requirements) || requirement.requirements.length === 0 || requirement.requirements.length > 12) context.addIssue({ code: "custom", path: [...path, index, "requirements"], message: "Um grupo de requisitos precisa ter entre uma e 12 condições." }); else validateMechanicRequirements(requirement.requirements, [...path, index, "requirements"], context, depth + 1); }
  });
}
function validateMechanicModifiers(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30) { context.addIssue({ code: "custom", path, message: "Modificadores mecânicos devem ser uma lista de até 30 entradas." }); return; }
  value.forEach((entry, index) => {
    const modifier = asRecord(entry);
    if (!modifier || typeof modifier.id !== "string" || !modifier.id.trim() || modifier.id.length > 64 || typeof modifier.target !== "string" || (!mechanicModifierTargets.has(modifier.target) && !/^extra:[a-zA-Z0-9_-]{1,64}$/.test(modifier.target)) || modifier.operation !== "add" || typeof modifier.value !== "number" || !Number.isFinite(modifier.value) || modifier.value < -20 || modifier.value > 20 || (modifier.active !== undefined && typeof modifier.active !== "boolean")) { context.addIssue({ code: "custom", path: [...path, index], message: "Modificador mecânico inválido; use um alvo permitido, operação de soma e valor entre −20 e +20." }); return; }
    validateMechanicRequirements(modifier.conditions, [...path, index, "conditions"], context);
  });
}
function validateMechanicSource(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  const source = asRecord(value);
  if (!source) return;
  validateMechanicModifiers(source.modifiers, [...path, "modifiers"], context);
  const requirements = Array.isArray(source.requirements) ? source.requirements : source.mechanicalRequirements;
  validateMechanicRequirements(requirements, [...path, source.mechanicalRequirements !== undefined ? "mechanicalRequirements" : "requirements"], context);
}
function validateStringList(value: unknown, path: (string | number)[], context: z.RefinementCtx, label: string, maximum = 30) {
  if (!Array.isArray(value) || value.length > maximum || value.some(item => typeof item !== "string" || item.length > 4000)) context.addIssue({ code: "custom", path, message: `${label} deve ser uma lista de até ${maximum} textos válidos.` });
}
function validateGrantBundle(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  const grants = asRecord(value);
  if (!grants) { context.addIssue({ code: "custom", path, message: "As concessões precisam formar um bloco estruturado." }); return; }
  const checkEntries = (key: "abilities" | "techniques" | "skills" | "equipment", validator: (entry: Record<string, unknown>, index: number) => void) => {
    const entries = grants[key];
    if (!Array.isArray(entries) || entries.length > 30) { context.addIssue({ code: "custom", path: [...path, key], message: `${key} deve conter até 30 concessões.` }); return; }
    entries.forEach((entry, index) => { const item = asRecord(entry); if (!item) context.addIssue({ code: "custom", path: [...path, key, index], message: "Concessão inválida." }); else validator(item, index); });
  };
  checkEntries("abilities", (ability, index) => {
    if (typeof ability.id !== "string" || !ability.id.trim() || typeof ability.name !== "string" || !ability.name.trim() || typeof ability.description !== "string" || typeof ability.type !== "string") context.addIssue({ code: "custom", path: [...path, "abilities", index], message: "Habilidade concedida inválida." });
    validateMechanicRequirements(ability.requirements, [...path, "abilities", index, "requirements"], context);
    validateMechanicModifiers(ability.modifiers, [...path, "abilities", index, "modifiers"], context);
  });
  checkEntries("techniques", (technique, index) => { if (typeof technique.id !== "string" || !technique.id.trim() || typeof technique.name !== "string" || !technique.name.trim() || typeof technique.description !== "string") context.addIssue({ code: "custom", path: [...path, "techniques", index], message: "Técnica concedida inválida." }); });
  checkEntries("skills", (skill, index) => { if (typeof skill.id !== "string" || !skill.id.trim() || typeof skill.name !== "string" || !skill.name.trim() || typeof skill.attribute !== "string" || !fmAttributeKeys.includes(skill.attribute as typeof fmAttributeKeys[number]) || !validSkillProficiencies.has(String(skill.proficiency))) context.addIssue({ code: "custom", path: [...path, "skills", index], message: "Perícia concedida inválida." }); });
  checkEntries("equipment", (item, index) => { if (typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim() || typeof item.category !== "string") context.addIssue({ code: "custom", path: [...path, "equipment", index], message: "Item concedido inválido." }); });
  validateStringList(grants.aptitudes, [...path, "aptitudes"], context, "Aptidões concedidas");
  validateStringList(grants.trainings, [...path, "trainings"], context, "Treinamentos concedidos");
  validateStringList(grants.limitations, [...path, "limitations"], context, "Limitações concedidas");
  validateMechanicModifiers(grants.modifiers, [...path, "modifiers"], context);
}
function validateRaceChoices(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 12) { context.addIssue({ code: "custom", path, message: "Escolhas raciais devem conter até 12 grupos." }); return; }
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const choice = asRecord(entry);
    if (!choice || typeof choice.id !== "string" || !choice.id.trim() || typeof choice.label !== "string" || !choice.label.trim() || typeof choice.description !== "string") { context.addIssue({ code: "custom", path: [...path, index], message: "Escolha racial inválida." }); return; }
    if (ids.has(choice.id)) context.addIssue({ code: "custom", path: [...path, index, "id"], message: "Cada escolha racial deve ter um identificador único." });
    ids.add(choice.id);
    validateMechanicRequirements(choice.requirements, [...path, index, "requirements"], context);
    if (!Array.isArray(choice.options) || choice.options.length === 0 || choice.options.length > 12) { context.addIssue({ code: "custom", path: [...path, index, "options"], message: "Uma escolha racial precisa ter entre uma e 12 opções." }); return; }
    const optionIds = new Set<string>();
    choice.options.forEach((option, optionIndex) => {
      const item = asRecord(option);
      if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim() || typeof item.description !== "string") context.addIssue({ code: "custom", path: [...path, index, "options", optionIndex], message: "Opção racial inválida." });
      else if (optionIds.has(item.id)) context.addIssue({ code: "custom", path: [...path, index, "options", optionIndex, "id"], message: "Cada opção racial deve ter identificador único." });
      else optionIds.add(item.id);
      validateMechanicModifiers(item?.modifiers, [...path, index, "options", optionIndex, "modifiers"], context);
      validateGrantBundle(item?.grants, [...path, index, "options", optionIndex, "grants"], context);
    });
  });
}
function validateCustomVows(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30) { context.addIssue({ code: "custom", path, message: "Votos próprios devem ser uma lista de até 30 entradas." }); return; }
  value.forEach((entry, index) => {
    const vow = asRecord(entry);
    if (!vow || typeof vow.id !== "string" || !vow.id.trim() || typeof vow.name !== "string" || typeof vow.description !== "string" || typeof vow.conditions !== "string" || typeof vow.limitations !== "string" || typeof vow.notes !== "string" || typeof vow.approved !== "boolean" || typeof vow.active !== "boolean") context.addIssue({ code: "custom", path: [...path, index], message: "Voto próprio inválido." });
    validateMechanicRequirements(vow?.requirements, [...path, index, "requirements"], context);
    validateMechanicModifiers(vow?.benefits, [...path, index, "benefits"], context);
    validateMechanicModifiers(vow?.drawbacks, [...path, index, "drawbacks"], context);
  });
}
function validateCustomResources(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30) { context.addIssue({ code: "custom", path, message: "Recursos Extras devem ser uma lista de até 30 entradas." }); return; }
  value.forEach((entry, index) => {
    const resource = asRecord(entry);
    if (!resource || typeof resource.id !== "string" || !resource.id.trim() || typeof resource.name !== "string" || typeof resource.description !== "string" || typeof resource.unit !== "string" || typeof resource.notes !== "string" || ![resource.current, resource.baseMaximum, resource.minimum].every(item => typeof item === "number" && Number.isFinite(item)) || Number(resource.baseMaximum) < Number(resource.minimum)) context.addIssue({ code: "custom", path: [...path, index], message: "Recurso Extra inválido; o máximo-base não pode ser menor que o mínimo." });
    validateMechanicModifiers(resource?.modifiers, [...path, index, "modifiers"], context);
  });
}
function validateTransformations(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30) { context.addIssue({ code: "custom", path, message: "Transformações devem ser uma lista de até 30 entradas." }); return; }
  value.forEach((entry, index) => {
    const transformation = asRecord(entry);
    if (!transformation || typeof transformation.id !== "string" || !transformation.id.trim() || typeof transformation.name !== "string" || typeof transformation.description !== "string" || typeof transformation.conditions !== "string" || typeof transformation.notes !== "string" || typeof transformation.active !== "boolean" || !Number.isInteger(transformation.elapsedRounds) || Number(transformation.elapsedRounds) < 0 || (transformation.durationRounds !== null && (!Number.isInteger(transformation.durationRounds) || Number(transformation.durationRounds) < 1))) context.addIssue({ code: "custom", path: [...path, index], message: "Transformação inválida." });
    validateMechanicRequirements(transformation?.requirements, [...path, index, "requirements"], context);
    validateMechanicModifiers(transformation?.benefits, [...path, index, "benefits"], context);
    validateMechanicModifiers(transformation?.drawbacks, [...path, index, "drawbacks"], context);
  });
}
function validateTrainingStageEffects(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  const stages = asRecord(value);
  if (!stages || Object.keys(stages).some(key => !["1", "2", "3", "4"].includes(key))) { context.addIssue({ code: "custom", path, message: "Efeitos por etapa devem usar apenas as etapas de 1 a 4." }); return; }
  Object.entries(stages).forEach(([stage, entry]) => {
    const effect = asRecord(entry);
    if (!effect || typeof effect.description !== "string" || typeof effect.limitations !== "string") context.addIssue({ code: "custom", path: [...path, stage], message: "Efeito por etapa inválido." });
    validateMechanicModifiers(effect?.modifiers, [...path, stage, "modifiers"], context);
    if (!Array.isArray(effect?.unlocks) || effect.unlocks.some(unlock => { const item = asRecord(unlock); return !item || item.type !== "unlock" || typeof item.id !== "string" || !item.id.trim() || typeof item.referenceId !== "string" || !item.referenceId.trim() || typeof item.label !== "string" || !item.label.trim() || !["technique", "ability", "training", "vow", "item"].includes(String(item.target)); })) context.addIssue({ code: "custom", path: [...path, stage, "unlocks"], message: "Desbloqueios por etapa inválidos." });
  });
}
function validateAptitudeEffects(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30) { context.addIssue({ code: "custom", path, message: "Efeitos de Aptidão devem ser uma lista de até 30 entradas." }); return; }
  value.forEach((entry, index) => {
    const effect = asRecord(entry);
    if (!effect || typeof effect.id !== "string" || !effect.id.trim() || effect.id.length > 64 || typeof effect.type !== "string") { context.addIssue({ code: "custom", path: [...path, index], message: "Efeito de Aptidão inválido." }); return; }
    if (effect.type === "skill-modifier" && (typeof effect.skillId !== "string" || !effect.skillId.trim() || effect.skillId.length > 160 || typeof effect.value !== "number" || !Number.isFinite(effect.value) || effect.value < -20 || effect.value > 20)) context.addIssue({ code: "custom", path: [...path, index], message: "Modificador de Perícia inválido." });
    if (effect.type === "unlock" && (!["technique", "ability", "training", "vow", "item"].includes(String(effect.target)) || typeof effect.referenceId !== "string" || !effect.referenceId.trim() || typeof effect.label !== "string" || !effect.label.trim())) context.addIssue({ code: "custom", path: [...path, index], message: "Desbloqueio de Aptidão inválido." });
    if (effect.type === "feature" && (typeof effect.label !== "string" || !effect.label.trim() || typeof effect.description !== "string" || !effect.description.trim())) context.addIssue({ code: "custom", path: [...path, index], message: "Característica de Aptidão inválida." });
    if (!["skill-modifier", "unlock", "feature"].includes(effect.type)) context.addIssue({ code: "custom", path: [...path, index, "type"], message: "Tipo de efeito de Aptidão inválido." });
  });
}
function validateAptitudeDefinition(value: unknown, path: (string | number)[], context: z.RefinementCtx) {
  const aptitude = asRecord(value);
  if (!aptitude) return;
  validateMechanicSource(aptitude, path, context);
  validateAptitudeEffects(aptitude.effects, [...path, "effects"], context);
  if (aptitude.evolutions !== undefined && !Array.isArray(aptitude.evolutions)) { context.addIssue({ code: "custom", path: [...path, "evolutions"], message: "Evoluções de Aptidão devem ser uma lista." }); return; }
  if (Array.isArray(aptitude.evolutions)) aptitude.evolutions.forEach((evolution, index) => {
    const item = asRecord(evolution);
    if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim() || !Number.isInteger(item.level) || Number(item.level) < 1 || Number(item.level) > 30) context.addIssue({ code: "custom", path: [...path, "evolutions", index], message: "Evolução de Aptidão inválida." });
    validateMechanicSource(item, [...path, "evolutions", index], context);
    validateAptitudeEffects(item?.effects, [...path, "evolutions", index, "effects"], context);
  });
  if (typeof aptitude.selectedEvolutionId === "string" && Array.isArray(aptitude.evolutions) && !aptitude.evolutions.some(item => asRecord(item)?.id === aptitude.selectedEvolutionId)) context.addIssue({ code: "custom", path: [...path, "selectedEvolutionId"], message: "A evolução selecionada não pertence à Aptidão." });
}

function validateMutantCores(value: unknown, level: number, context: z.RefinementCtx) {
  const path = ["sheet", "mutantCores"] as (string | number)[];
  if (!value || typeof value !== "object") { context.addIssue({ code: "custom", path, message: "Corpo Amaldiçoado Mutante precisa registrar os três núcleos." }); return; }
  const state = value as Record<string, unknown>;
  if (!Array.isArray(state.cores) || state.cores.length !== FM_MUTANT_CORE_COUNT) { context.addIssue({ code: "custom", path: [...path, "cores"], message: "Corpo Amaldiçoado Mutante precisa possuir exatamente três núcleos." }); return; }
  const cores = state.cores as Array<Record<string, unknown>>;
  const ids = cores.map(core => core.id).filter((id): id is string => typeof id === "string" && Boolean(id.trim()));
  if (ids.length !== cores.length || new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: [...path, "cores"], message: "Cada núcleo precisa de um identificador único." });
  if (typeof state.primaryCoreId !== "string" || !ids.includes(state.primaryCoreId)) context.addIssue({ code: "custom", path: [...path, "primaryCoreId"], message: "Selecione um Núcleo Primário válido." });
  if (typeof state.activeCoreId !== "string" || !ids.includes(state.activeCoreId)) context.addIssue({ code: "custom", path: [...path, "activeCoreId"], message: "Selecione um Núcleo ativo válido." });
  const primary = cores.find(core => core.id === state.primaryCoreId) ?? cores[0];
  const getTotal = (core: Record<string, unknown>) => fmAttributeKeys.reduce((total, attribute) => total + (typeof (core.attributes as Record<string, unknown> | undefined)?.[attribute] === "number" ? Number((core.attributes as Record<string, unknown>)[attribute]) : 0), 0);
  const primaryTotal = getTotal(primary);
  cores.forEach((core, index) => {
    const corePath = [...path, "cores", index] as (string | number)[];
    if (typeof core.name !== "string" || !core.name.trim()) context.addIssue({ code: "custom", path: [...corePath, "name"], message: "Todo núcleo precisa de um nome." });
    if (typeof core.specialization !== "string" || !FM_SPECIALIZATION_PROFILES[core.specialization as keyof typeof FM_SPECIALIZATION_PROFILES]) context.addIssue({ code: "custom", path: [...corePath, "specialization"], message: "Especialização do núcleo inválida." });
    const attributes = core.attributes as Record<string, unknown> | undefined;
    if (!attributes || fmAttributeKeys.some(attribute => !Number.isInteger(attributes[attribute]) || Number(attributes[attribute]) < 0 || Number(attributes[attribute]) > 30)) context.addIssue({ code: "custom", path: [...corePath, "attributes"], message: "Cada núcleo deve declarar atributos inteiros entre 0 e 30." });
    else if (getTotal(core) !== primaryTotal) context.addIssue({ code: "custom", path: [...corePath, "attributes"], message: "Todos os núcleos devem redistribuir a mesma soma de atributos do Núcleo Primário." });
    const resources = core.resources as Record<string, Record<string, unknown>> | undefined;
    (["health", "energy"] as const).forEach(resource => {
      const entry = resources?.[resource];
      if (!entry || typeof entry.current !== "number" || entry.current < 0) context.addIssue({ code: "custom", path: [...corePath, "resources", resource, "current"], message: "O recurso atual do núcleo deve ser um número não negativo." });
      if (entry) validateDeclaredModifier(entry.bonusMaximum, [...corePath, "resources", resource, "bonusMaximum"], "sheet", context);
    });
    if (typeof core.damaged === "boolean" && core.id === state.activeCoreId && core.damaged) context.addIssue({ code: "custom", path: [...path, "activeCoreId"], message: "Um núcleo Danificado não pode permanecer ativo." });
    if (typeof core.destroyed === "boolean" && core.id === state.activeCoreId && core.destroyed) context.addIssue({ code: "custom", path: [...path, "activeCoreId"], message: "Um núcleo destruído não pode permanecer ativo." });
    if (!Array.isArray(core.spells)) context.addIssue({ code: "custom", path: [...corePath, "spells"], message: "Os feitiços de cada núcleo devem ser uma lista." });
    else {
      const spells = core.spells as Array<Record<string, unknown>>;
      const highestSpellLevel = getHighestSpellLevel(level);
      const sourcePowerIds = spells.map(spell => spell.sourcePowerId).filter((id): id is string => typeof id === "string");
      if (new Set(sourcePowerIds).size !== sourcePowerIds.length) context.addIssue({ code: "custom", path: [...corePath, "spells"], message: "Um poder da Técnica só pode ser selecionado uma vez por núcleo." });
      spells.forEach((spell, spellIndex) => {
        if (typeof spell.level !== "number" || spell.level < 0 || spell.level > highestSpellLevel) context.addIssue({ code: "custom", path: [...corePath, "spells", spellIndex, "level"], message: `O nível do feitiço excede o máximo liberado (${highestSpellLevel}).` });
        if (spell.counterplay !== undefined && (typeof spell.counterplay !== "string" || !spell.counterplay.trim())) context.addIssue({ code: "custom", path: [...corePath, "spells", spellIndex, "counterplay"], message: "Todo feitiço do núcleo precisa declarar contrajogo quando esse campo for registrado." });
      });
    }
    const coreSpecialization = core.specialization as Parameters<typeof validateSpecializationAbilityChoices>[0]["specialization"];
    const choiceErrors = validateSpecializationAbilityChoices({ level, specialization: coreSpecialization, specializationLevels: level, specializationTracks: [{ specialization: coreSpecialization, level }], specializationAbilityChoices: Array.isArray(core.specializationAbilityChoices) ? core.specializationAbilityChoices as Parameters<typeof validateSpecializationAbilityChoices>[0]["specializationAbilityChoices"] : [] });
    choiceErrors.forEach(message => context.addIssue({ code: "custom", path: [...corePath, "specializationAbilityChoices"], message }));
  });
}

const characterInput = z.object({
  id: z.string().min(6).max(64),
  name: z.string().trim().min(1).max(160),
  portraitUrl: storedImageUrl.nullable().optional(),
  clientId: z.string().uuid().optional(),
  sheet: z.record(z.string(), z.unknown()),
}).superRefine((input, context) => {
  const skills = input.sheet.skills;
  if (Array.isArray(skills)) {
    skills.forEach((skill, index) => {
      const value = skill as Record<string, unknown>;
      if (typeof value.name !== "string" || !value.name.trim()) {
        context.addIssue({ code: "custom", path: ["sheet", "skills", index, "name"], message: "O nome da perícia é obrigatório." });
      }
      if (typeof value.attribute !== "string" || !validSkillAttributes.has(value.attribute)) {
        context.addIssue({ code: "custom", path: ["sheet", "skills", index, "attribute"], message: "Atributo de perícia inválido." });
      }
      if (typeof value.proficiency !== "string" || !validSkillProficiencies.has(value.proficiency)) {
        context.addIssue({ code: "custom", path: ["sheet", "skills", index, "proficiency"], message: "Proficiência de perícia inválida." });
      }
      validateDeclaredModifier(value.otherBonus, ["sheet", "skills", index, "otherBonus"], "skill", context);
      if (value.otherBonus !== 0 && (typeof value.notes !== "string" || !value.notes.trim())) {
        context.addIssue({ code: "custom", path: ["sheet", "skills", index, "notes"], message: "Todo bônus extra de perícia precisa registrar sua origem nas observações." });
      }
      if (typeof value.catalogId === "string") {
        const catalog = getSkillCatalogEntry(value.catalogId);
        if (!catalog || catalog.name !== value.name || catalog.attribute !== value.attribute) context.addIssue({ code: "custom", path: ["sheet", "skills", index, "catalogId"], message: "A perícia selecionada não corresponde ao banco oficial." });
        if (catalog?.requiresTraining && value.proficiency === "untrained") context.addIssue({ code: "custom", path: ["sheet", "skills", index, "proficiency"], message: `${catalog.name} exige treinamento.` });
      }
    });
  }
  const bonuses = input.sheet.bonuses as Record<string, unknown> | undefined;
  if (bonuses) Object.entries(bonuses).forEach(([key, value]) => validateDeclaredModifier(value, ["sheet", "bonuses", key], "sheet", context));
  const resources = input.sheet.resources as Record<string, Record<string, unknown>> | undefined;
  if (resources?.health) validateDeclaredModifier(resources.health.bonusMaximum, ["sheet", "resources", "health", "bonusMaximum"], "sheet", context);
  if (resources?.energy) validateDeclaredModifier(resources.energy.bonusMaximum, ["sheet", "resources", "energy", "bonusMaximum"], "sheet", context);
  const attacks = input.sheet.attacks;
  if (Array.isArray(attacks)) attacks.forEach((attack, index) => {
    const value = attack as Record<string, unknown>;
    validateDeclaredModifier(value.otherBonus, ["sheet", "attacks", index, "otherBonus"], "attack", context);
    validateDeclaredModifier(value.penalties, ["sheet", "attacks", index, "penalties"], "attack", context);
    if ((value.otherBonus !== 0 || value.penalties !== 0) && (typeof value.notes !== "string" || !value.notes.trim())) {
      context.addIssue({ code: "custom", path: ["sheet", "attacks", index, "notes"], message: "Todo modificador de ataque precisa registrar sua origem nas observações." });
    }
  });
  const equipment = input.sheet.equipment;
  if (Array.isArray(equipment)) equipment.forEach((item, index) => {
    const value = item as Record<string, unknown>;
    if (typeof value.catalogId === "string") {
      const catalog = getEquipmentCatalogEntry(value.catalogId);
      if (!catalog || catalog.name !== value.name || catalog.category !== value.category) context.addIssue({ code: "custom", path: ["sheet", "equipment", index, "catalogId"], message: "O equipamento selecionado não corresponde ao banco oficial." });
    }
    if (typeof value.spaces === "number" && (value.spaces < 0 || value.spaces > 4)) context.addIssue({ code: "custom", path: ["sheet", "equipment", index, "spaces"], message: "Espaços de equipamento devem ficar entre 0 e 4." });
    validateMechanicSource(value, ["sheet", "equipment", index], context);
  });
  const progression = input.sheet.progression as Record<string, unknown> | undefined;
  const level = typeof progression?.level === "number" ? progression.level : 1;
  const specialization = typeof progression?.specialization === "string" ? progression.specialization : "fighter";
  const primarySpecialization = typeof progression?.primarySpecialization === "string" ? progression.primarySpecialization : specialization;
  const tracks = Array.isArray(progression?.specializationTracks) ? progression.specializationTracks as Array<Record<string, unknown>> : [];
  if (!FM_SPECIALIZATION_PROFILES[primarySpecialization as keyof typeof FM_SPECIALIZATION_PROFILES]) context.addIssue({ code: "custom", path: ["sheet", "progression", "primarySpecialization"], message: "Especialização primária inválida." });
  if (tracks.length) {
    const names = tracks.map(track => track.specialization).filter((value): value is string => typeof value === "string");
    const total = tracks.reduce((sum, track, index) => {
      if (!FM_SPECIALIZATION_PROFILES[track.specialization as keyof typeof FM_SPECIALIZATION_PROFILES]) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks", index, "specialization"], message: "Especialização de multiclasse inválida." });
      if (!Number.isInteger(track.level) || Number(track.level) < 1) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks", index, "level"], message: "Todo núcleo deve possuir ao menos um nível." });
      return sum + (Number.isInteger(track.level) ? Number(track.level) : 0);
    }, 0);
    if (total !== level) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks"], message: "A soma dos níveis de especialização deve ser igual ao nível geral." });
    if (new Set(names).size !== names.length) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks"], message: "Cada especialização deve aparecer apenas uma vez na Multiclasse." });
    if (!names.includes(primarySpecialization)) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks"], message: "A especialização primária deve constar na divisão de níveis." });
    if (names.includes("restricted") && names.length > 1) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks"], message: "Restringido não pode realizar nem receber Multiclasse." });
    const attributes = input.sheet.attributes as Record<string, Record<string, unknown>> | undefined;
    const base = attributes?.base ?? {};
    const bonuses = attributes?.permanentBonuses ?? {};
    tracks.filter(track => track.specialization !== primarySpecialization).forEach((track, index) => {
      const requirement = FM_MULTICLASS_REQUIREMENTS[track.specialization as keyof typeof FM_MULTICLASS_REQUIREMENTS];
      if (!requirement || track.specialization === "restricted") return;
      if (!requirement.attributes.some(attribute => Number(base[attribute] ?? 0) + Number(bonuses[attribute] ?? 0) >= requirement.minimum)) context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationTracks", index], message: `A Multiclasse em ${track.specialization} requer ${requirement.label}.` });
    });
  }
  const specializationChoiceErrors = validateSpecializationAbilityChoices({
    level,
    specialization: specialization as Parameters<typeof validateSpecializationAbilityChoices>[0]["specialization"],
    specializationLevels: typeof progression?.specializationLevels === "number" ? progression.specializationLevels : level,
    specializationTracks: tracks as Parameters<typeof validateSpecializationAbilityChoices>[0]["specializationTracks"],
    specializationAbilityChoices: Array.isArray(progression?.specializationAbilityChoices) ? progression.specializationAbilityChoices as Parameters<typeof validateSpecializationAbilityChoices>[0]["specializationAbilityChoices"] : [],
  });
  specializationChoiceErrors.forEach(message => context.addIssue({ code: "custom", path: ["sheet", "progression", "specializationAbilityChoices"], message }));
  const aptitudes = input.sheet.aptitudes;
  if (aptitudes !== undefined && !Array.isArray(aptitudes)) {
    context.addIssue({ code: "custom", path: ["sheet", "aptitudes"], message: "Aptidões devem ser uma lista." });
  }
  if (Array.isArray(aptitudes)) {
    const selectedCatalogIds = aptitudes.map(aptitude => (aptitude as Record<string, unknown>).catalogId).filter((catalogId): catalogId is string => typeof catalogId === "string");
    if (new Set(selectedCatalogIds).size !== selectedCatalogIds.length) context.addIssue({ code: "custom", path: ["sheet", "aptitudes"], message: "Cada aptidão só pode ser escolhida uma vez." });
    let spent = 0;
    aptitudes.forEach((aptitude, index) => {
      const value = aptitude as Record<string, unknown>;
      validateAptitudeDefinition(value, ["sheet", "aptitudes", index], context);
      const catalogId = typeof value.catalogId === "string" ? value.catalogId : "";
      if (catalogId.startsWith("homebrew:")) {
        if (typeof value.homebrewId !== "string" || value.homebrewId !== catalogId.slice("homebrew:".length)) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "homebrewId"], message: "A referência da Aptidão Homebrew é inválida." });
        if (value.group !== "special") context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "group"], message: "Aptidões Homebrew usam o grupo Especial até aprovação do mestre." });
        return;
      }
      const catalog = getAptitudeCatalogEntry(catalogId);
      if (!catalog) {
        context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "catalogId"], message: "A aptidão selecionada não corresponde ao catálogo oficial." });
        return;
      }
      spent += catalog.cost;
      if (value.name !== catalog.name || value.group !== catalog.group || value.requiredLevel !== catalog.requiredLevel || value.cost !== catalog.cost || value.prerequisite !== catalog.prerequisite || value.effect !== catalog.effect) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index], message: "Os dados da aptidão devem corresponder ao catálogo oficial." });
      const definition = getAptitudeDefinition(catalog);
      const serialized = (entry: unknown) => JSON.stringify(entry ?? null);
      if ((value.modifiers !== undefined && serialized(value.modifiers) !== serialized(definition.modifiers)) || (value.requirements !== undefined && serialized(value.requirements) !== serialized(definition.requirements)) || (value.effects !== undefined && serialized(value.effects) !== serialized(definition.effects)) || (value.evolutions !== undefined && serialized(value.evolutions) !== serialized(definition.evolutions)) || (value.limitations !== undefined && value.limitations !== definition.limitations)) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index], message: "Os efeitos mecânicos da Aptidão oficial devem corresponder ao catálogo." });
      if (level < catalog.requiredLevel) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "catalogId"], message: `${catalog.name} exige nível ${catalog.requiredLevel}.` });
      if (catalog.prerequisite !== "—" && !aptitudes.some(candidate => (candidate as Record<string, unknown>).name === catalog.prerequisite)) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "catalogId"], message: `${catalog.name} exige ${catalog.prerequisite}.` });
      const selectedEvolutionId = typeof value.selectedEvolutionId === "string" ? value.selectedEvolutionId : null;
      const selectedEvolution = Array.isArray(value.evolutions) ? value.evolutions.find(entry => asRecord(entry)?.id === selectedEvolutionId) : undefined;
      if (selectedEvolution && Number(asRecord(selectedEvolution)?.level) > level) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "selectedEvolutionId"], message: "A evolução selecionada exige nível maior que o personagem atual." });
    });
    const budget = Math.floor(Math.max(1, Math.min(30, level)) / 2) + Math.floor(Math.max(1, Math.min(30, level)) / 10);
    if (spent > budget) context.addIssue({ code: "custom", path: ["sheet", "aptitudes"], message: `A ficha possui ${spent} ponto(s) de aptidão gastos, mas o nível ${level} libera apenas ${budget}.` });
  }
  const houseRules = input.sheet.houseRules;
  validateHouseRules(houseRules).forEach(message => {
    context.addIssue({ code: "custom", path: ["sheet", "houseRules"], message });
  });
  const birthVow = asRecord(houseRules)?.birthVow;
  validateMechanicSource(birthVow, ["sheet", "houseRules", "birthVow"], context);
  validateCustomVows(asRecord(houseRules)?.customVows, ["sheet", "houseRules", "customVows"], context);
  const technique = input.sheet.technique as Record<string, unknown> | undefined;
  validateMechanicSource(technique, ["sheet", "technique"], context);
  validateTechnique(technique, specialization).forEach(issue => {
    context.addIssue({ code: "custom", path: ["sheet", "technique", issue.field], message: issue.message });
  });
  const mechanics = asRecord(input.sheet.mechanics);
  validateGrantBundle(mechanics?.originGrants, ["sheet", "mechanics", "originGrants"], context);
  const race = asRecord(mechanics?.race);
  if (race) {
    if (race.sourceKind !== "homebrew" && race.sourceKind !== "custom") context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "sourceKind"], message: "A origem da raça mecânica é inválida." });
    if (typeof race.id !== "string" || !race.id.trim() || typeof race.name !== "string" || !race.name.trim()) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race"], message: "A raça mecânica precisa de identificador e nome." });
    validateMechanicSource(race, ["sheet", "mechanics", "race"], context);
    validateGrantBundle(race.grants, ["sheet", "mechanics", "race", "grants"], context);
    validateRaceChoices(race.choices, ["sheet", "mechanics", "race", "choices"], context);
    if (race.evolutions !== undefined && !Array.isArray(race.evolutions)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "evolutions"], message: "Evoluções da raça devem ser uma lista." });
    if (Array.isArray(race.evolutions)) race.evolutions.forEach((evolution, index) => {
      const item = asRecord(evolution);
      if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim()) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "evolutions", index], message: "Cada evolução precisa de identificador e nome." });
      validateMechanicSource(item, ["sheet", "mechanics", "race", "evolutions", index], context);
      validateGrantBundle(item?.grants, ["sheet", "mechanics", "race", "evolutions", index, "grants"], context);
      validateRaceChoices(item?.choices, ["sheet", "mechanics", "race", "evolutions", index, "choices"], context);
    });
    if (typeof race.selectedEvolutionId === "string" && Array.isArray(race.evolutions) && !race.evolutions.some(evolution => asRecord(evolution)?.id === race.selectedEvolutionId)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "selectedEvolutionId"], message: "A evolução selecionada não pertence à raça atual." });
    const selectedEvolution = Array.isArray(race.evolutions) ? race.evolutions.find(evolution => asRecord(evolution)?.id === race.selectedEvolutionId) : undefined;
    const choices = [...(Array.isArray(race.choices) ? race.choices : []), ...(Array.isArray(asRecord(selectedEvolution)?.choices) ? asRecord(selectedEvolution)?.choices as unknown[] : [])].map(asRecord).filter(Boolean) as Record<string, unknown>[];
    if (race.selectedChoices !== undefined && !Array.isArray(race.selectedChoices)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "selectedChoices"], message: "As escolhas selecionadas da raça devem formar uma lista." });
    if (Array.isArray(race.selectedChoices)) {
      const selectedIds = new Set<string>();
      race.selectedChoices.forEach((selection, index) => {
        const item = asRecord(selection);
        const choiceId = typeof item?.choiceId === "string" ? item.choiceId : "";
        const optionId = typeof item?.optionId === "string" ? item.optionId : "";
        const choice = choices.find(candidate => candidate.id === choiceId);
        if (!choice || !optionId || !Array.isArray(choice.options) || !choice.options.some(option => asRecord(option)?.id === optionId)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "selectedChoices", index], message: "A opção racial selecionada não pertence à raça ou evolução ativa." });
        if (selectedIds.has(choiceId)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "selectedChoices", index, "choiceId"], message: "Cada escolha racial pode ser definida apenas uma vez." });
        selectedIds.add(choiceId);
      });
    }
  }
  const training = input.sheet.training;
  if (Array.isArray(training)) training.forEach((track, index) => {
    validateMechanicSource(track, ["sheet", "training", index], context);
    validateTrainingStageEffects(asRecord(track)?.stageEffects, ["sheet", "training", index, "stageEffects"], context);
  });
  const cursedTools = input.sheet.cursedTools;
  if (Array.isArray(cursedTools)) cursedTools.forEach((tool, index) => validateMechanicSource(tool, ["sheet", "cursedTools", index], context));
  validateMechanicSource(input.sheet.domainExpansion, ["sheet", "domainExpansion"], context);
  const mechanicInvocations = input.sheet.invocations;
  if (Array.isArray(mechanicInvocations)) mechanicInvocations.forEach((invocation, index) => validateMechanicSource(invocation, ["sheet", "invocations", index], context));
  const experience = progression?.experience;
  if (experience !== undefined) {
    if (typeof experience !== "number" || !Number.isInteger(experience) || experience < 0 || experience > 6499) {
      context.addIssue({ code: "custom", path: ["sheet", "progression", "experience"], message: "O XP da guilda deve ser um inteiro entre 0 e 6499." });
    } else if (level !== getInfiniteWorldLevel(experience)) {
      context.addIssue({ code: "custom", path: ["sheet", "progression", "level"], message: "O nível deve corresponder ao XP acumulado na tabela Infinite Worlds." });
    }
  }
  const spells = input.sheet.spells;
  if (Array.isArray(spells)) {
    const highestSpellLevel = getHighestSpellLevel(level);
    const techniquePowers = Array.isArray(technique?.powers) ? technique.powers as Array<Record<string, unknown>> : [];
    const powersById = new Map(techniquePowers.filter(power => typeof power.id === "string").map(power => [power.id as string, power]));
    const specializationLevel = typeof progression?.specializationLevels === "number" ? progression.specializationLevels : level;
    const powerProgression = getTechniquePowerProgression(specialization as Parameters<typeof getTechniquePowerProgression>[0], specializationLevel);
    const selectedPowerIds = spells.map(spell => (spell as Record<string, unknown>).sourcePowerId).filter((powerId): powerId is string => typeof powerId === "string");
    if (new Set(selectedPowerIds).size !== selectedPowerIds.length) context.addIssue({ code: "custom", path: ["sheet", "spells"], message: "Um poder da técnica só pode ser selecionado uma vez." });
    if (selectedPowerIds.length > powerProgression.availableSlots) context.addIssue({ code: "custom", path: ["sheet", "spells"], message: `A especialização possui apenas ${powerProgression.availableSlots} vaga(s) de poder liberada(s) neste nível.` });
    spells.forEach((spell, index) => {
      const value = spell as Record<string, unknown>;
      const spellLevel = value.level;
      if (typeof spellLevel !== "number" || spellLevel < 0 || spellLevel > highestSpellLevel) {
        context.addIssue({ code: "custom", path: ["sheet", "spells", index, "level"], message: `O nível do feitiço excede o máximo liberado (${highestSpellLevel}).` });
      }
      if (value.counterplay !== undefined && (typeof value.counterplay !== "string" || !value.counterplay.trim())) {
        context.addIssue({ code: "custom", path: ["sheet", "spells", index, "counterplay"], message: "Todo feitiço novo precisa declarar uma resistência, reação ou outro contrajogo." });
      }
      validateDeclaredModifier(value.costAdjustment, ["sheet", "spells", index, "costAdjustment"], "spellCost", context);
      validateDeclaredModifier(value.combatModifier, ["sheet", "spells", index, "combatModifier"], "spellCombat", context);
      if ((value.costAdjustment !== 0 || value.combatModifier !== 0) && (![value.effect, value.notes].some(entry => typeof entry === "string" && entry.trim()))) {
        context.addIssue({ code: "custom", path: ["sheet", "spells", index, "effect"], message: "Todo modificador de feitiço precisa registrar seu efeito ou observação de origem." });
      }
      if (typeof value.sourcePowerId === "string") {
        const sourcePower = powersById.get(value.sourcePowerId);
        if (!sourcePower) context.addIssue({ code: "custom", path: ["sheet", "spells", index, "sourcePowerId"], message: "O poder selecionado não pertence à técnica atual." });
        else {
          const requiredLevel = sourcePower.requiredCharacterLevel;
          const sourceSpellLevel = sourcePower.spellLevel;
          if (typeof requiredLevel !== "number" || requiredLevel > specializationLevel) context.addIssue({ code: "custom", path: ["sheet", "spells", index, "sourcePowerId"], message: "Este poder ainda não foi liberado pelo nível de especialização." });
          if (typeof sourceSpellLevel !== "number" || sourceSpellLevel > highestSpellLevel) context.addIssue({ code: "custom", path: ["sheet", "spells", index, "sourcePowerId"], message: "O nível de poder selecionado ainda não está liberado." });
        }
      }
    });
  }
  const origin = input.sheet.origin as Record<string, unknown> | undefined;
  validateGrantBundle(origin?.grants, ["sheet", "origin", "grants"], context);
  if (origin?.catalogId !== undefined && (typeof origin.catalogId !== "string" || !validOriginIds.has(origin.catalogId))) {
    context.addIssue({ code: "custom", path: ["sheet", "origin", "catalogId"], message: "Origem inválida." });
  }
  if (typeof origin?.catalogId === "string" && origin.catalogId !== "custom") {
    const entry = getOriginCatalogEntry(origin.catalogId as Parameters<typeof getOriginCatalogEntry>[0]);
    const clanId = typeof origin.clanId === "string" ? origin.clanId : "custom";
    if (!validClanIds.has(clanId)) context.addIssue({ code: "custom", path: ["sheet", "origin", "clanId"], message: "Clã estruturado inválido." });
    if (origin.catalogId !== "inherited" && clanId !== "custom") context.addIssue({ code: "custom", path: ["sheet", "origin", "clanId"], message: "Benefícios estruturados de clã só podem ser usados pela Origem Herdado." });
    if (entry?.requiresRestrictedSpecialization && specialization !== "restricted") context.addIssue({ code: "custom", path: ["sheet", "progression", "specialization"], message: "A origem Restringido exige a Especialização Restringido." });
    if (origin.catalogId === "inherited" && (typeof origin.clan !== "string" || !origin.clan.trim())) context.addIssue({ code: "custom", path: ["sheet", "origin", "clan"], message: "A origem Herdado exige a escolha de um clã ou linhagem." });
    if (origin.catalogId === "inherited" && clanId !== "custom" && !getClanCatalogEntry(clanId as Parameters<typeof getClanCatalogEntry>[0])) context.addIssue({ code: "custom", path: ["sheet", "origin", "clanId"], message: "Clã estruturado inválido." });
    if (origin.catalogId === "technique-less" && (specialization === "technique-specialist" || (Array.isArray(spells) && spells.length > 0))) context.addIssue({ code: "custom", path: ["sheet", "origin"], message: "Sem Técnica não pode ser Especialista em Técnica nem possuir Feitiços." });
    const bonuses = origin.attributeBonuses as Record<string, unknown> | undefined;
    const allocation = getOriginAttributeAllocation(origin.catalogId as Parameters<typeof getOriginAttributeAllocation>[0], (validClanIds.has(clanId) ? clanId : "custom") as Parameters<typeof getOriginAttributeAllocation>[1]);
    if (bonuses && allocation) {
      const entries = Object.entries(bonuses);
      const total = entries.reduce<number>((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0);
      const allowedViolation = allocation.allowedAttributes && entries.some(([attribute, value]) => typeof value === "number" && value > 0 && !allocation.allowedAttributes?.includes(attribute as Parameters<typeof allocation.allowedAttributes.includes>[0]));
      const requiredViolation = Object.entries(allocation.requiredBonuses ?? {}).some(([attribute, minimum]) => typeof bonuses[attribute] !== "number" || (bonuses[attribute] as number) < minimum);
      if (entries.some(([, value]) => typeof value !== "number" || value < 0 || value > allocation.maximumPerAttribute) || total > allocation.total || allowedViolation || requiredViolation) context.addIssue({ code: "custom", path: ["sheet", "origin", "attributeBonuses"], message: `Os bônus desta origem devem respeitar ${allocation.total} ponto(s), máximo ${allocation.maximumPerAttribute} por atributo e os atributos permitidos.` });
    }
  }
  if (origin?.catalogId === FM_MUTANT_CURSED_CORPSE_ORIGIN) validateMutantCores(input.sheet.mutantCores, level, context);
  const invocations = input.sheet.invocations;
  if (invocations !== undefined && !Array.isArray(invocations)) {
    context.addIssue({ code: "custom", path: ["sheet", "invocations"], message: "Invocações devem ser uma lista." });
  }
  if (Array.isArray(invocations)) invocations.forEach((invocation, index) => {
    const value = invocation as Record<string, unknown>;
    if (typeof value.name !== "string" || !value.name.trim()) context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "name"], message: "O nome da Invocação é obrigatório." });
    if (typeof value.grade !== "string" || !(value.grade in FM_INVOCATION_GRADE_RULES)) context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "grade"], message: "Grau de Invocação inválido." });
    if (value.type !== undefined && (typeof value.type !== "string" || !(value.type in FM_INVOCATION_TYPE_LABELS))) context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "type"], message: "Tipo de Invocação inválido." });
    if (!Array.isArray(value.actions) || value.actions.some(action => typeof action !== "object" || action === null || typeof (action as Record<string, unknown>).name !== "string" || typeof (action as Record<string, unknown>).effect !== "string")) {
      context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "actions"], message: "Toda ação de Invocação precisa ter nome e efeito declarados." });
    }
  });
  validateCustomResources(input.sheet.customResources, ["sheet", "customResources"], context);
  validateTransformations(input.sheet.transformations, ["sheet", "transformations"], context);
});

const characterIdInput = z.object({ id: z.string().min(6).max(64) });
const characterImageUploadInput = z.object({
  characterId: z.string().min(6).max(64),
  fileName: z.string().trim().min(1).max(160),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(7_000_000),
  caption: z.string().max(300).default(""),
});
const techniqueLibraryInput = z.object({
  id: z.string().min(6).max(64),
  name: z.string().trim().min(1).max(160),
  technique: z.record(z.string(), z.unknown()),
}).superRefine((input, context) => {
  const specialization = input.technique.kind === "martial" ? "restricted" : "fighter";
  validateTechnique({ ...input.technique, name: input.name }, specialization, { requireCounterplay: true }).forEach(issue => {
    context.addIssue({ code: "custom", path: ["technique", issue.field], message: issue.message });
  });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  specializationAbilities: router({
    list: protectedProcedure.input(z.object({ specialization: z.string().max(48).optional() }).optional()).query(async ({ input }) => listSeededFMSpecializationAbilities(input?.specialization)),
  }),
  techniques: router({
    list: protectedProcedure.query(({ ctx }) => listFMTechniques(ctx.user.id)),
    get: protectedProcedure.input(characterIdInput).query(async ({ ctx, input }) => {
      const technique = await getFMTechnique(input.id);
      if (!technique || technique.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode abrir esta técnica." });
      return technique;
    }),
    save: protectedProcedure.input(techniqueLibraryInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMTechnique(input.id);
      if (existing && existing.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode editar esta técnica." });
      const saved = await saveFMTechnique({ id: input.id, ownerId: ctx.user.id, name: input.name, technique: { ...input.technique, name: input.name } });
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a técnica." });
      return saved;
    }),
    remove: protectedProcedure.input(characterIdInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMTechnique(input.id);
      if (!existing || existing.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode excluir esta técnica." });
      await deleteFMTechnique(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  }),
  homebrews: router({
    list: protectedProcedure.query(({ ctx }) => listFMHomebrews(ctx.user.id)),
    get: protectedProcedure.input(characterIdInput).query(async ({ ctx, input }) => {
      const homebrew = await getFMHomebrew(input.id);
      if (!homebrew || homebrew.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode abrir este Homebrew." });
      return homebrew;
    }),
    save: protectedProcedure.input(homebrewInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMHomebrew(input.id);
      if (existing && existing.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode editar este Homebrew." });
      const saved = await saveFMHomebrew({ ...input, ownerId: ctx.user.id });
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar o Homebrew." });
      await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "homebrew", targetId: input.id, actorName: ctx.user.name || "Criador", eventType: existing ? "updated" : "created", detail: { kind: input.kind, name: input.name } });
      return saved;
    }),
    remove: protectedProcedure.input(characterIdInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMHomebrew(input.id);
      if (!existing || existing.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode excluir este Homebrew." });
      await deleteFMHomebrew(input.id, ctx.user.id);
      await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "homebrew", targetId: input.id, actorName: ctx.user.name || "Criador", eventType: "deleted", detail: { name: existing.name, kind: existing.kind } });
      return { success: true } as const;
    }),
    share: protectedProcedure.input(characterIdInput).mutation(async ({ ctx, input }) => {
      const homebrew = await getFMHomebrew(input.id);
      if (!homebrew || homebrew.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode compartilhar este Homebrew." });
      const existing = await getFMContentShare("homebrew", input.id, ctx.user.id);
      const share = existing?.enabled ? existing : await createFMContentShare({ ownerId: ctx.user.id, targetType: "homebrew", targetId: input.id, token: nanoid(24) });
      if (!share) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o link de avaliação." });
      if (!existing || !existing.enabled) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "homebrew", targetId: input.id, actorName: ctx.user.name || "Criador", eventType: existing ? "regenerated" : "shared", detail: { token: share.token } });
      return { token: share.token };
    }),
  }),
  reviews: router({
    list: protectedProcedure.input(reviewTargetInput.optional()).query(({ ctx, input }) => listFMReviews(ctx.user.id, input?.targetType, input?.targetId)),
    history: protectedProcedure.input(reviewTargetInput.optional()).query(({ ctx, input }) => listFMChangeHistory(ctx.user.id, input?.targetType, input?.targetId)),
    update: protectedProcedure.input(reviewOwnerUpdateInput).mutation(async ({ ctx, input }) => {
      const previous = await getFMReview(input.id);
      if (!previous || previous.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode atualizar esta sugestão." });
      const transitions: Record<typeof previous.status, Array<typeof previous.status>> = { pending: ["accepted", "rejected"], accepted: ["implemented", "rejected"], rejected: [], implemented: [] };
      if (input.status !== previous.status && !transitions[previous.status].includes(input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta transição de status não é permitida para a revisão atual." });
      if ((previous.status === "rejected" || previous.status === "implemented") && input.ownerResponse.trim() !== previous.ownerResponse) throw new TRPCError({ code: "BAD_REQUEST", message: "A resposta só pode ser editada enquanto a revisão estiver pendente ou aceita." });
      const requestsObservationUpdate = previous.kind === "suggestion" && previous.field.startsWith("observation:");
      if (input.status === "accepted" && requestsObservationUpdate) {
        if (previous.targetType !== "character") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta observação não pertence a uma ficha editável." });
        const character = await getFMCharacter(previous.targetId);
        if (!character || character.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode aplicar esta sugestão de observação." });
        const sheet = applyCharacterObservationSuggestion(character.sheet as FMCharacterSheet, previous.field, previous.suggestedValue);
        if (!sheet) throw new TRPCError({ code: "BAD_REQUEST", message: "A observação sugerida não corresponde a uma entidade atual da ficha." });
        await saveFMCharacter({ id: character.id, ownerId: ctx.user.id, name: character.name, portraitUrl: character.portraitUrl ?? null, sheet });
      }
      const review = await updateFMReview(input.id, ctx.user.id, { status: input.status, ownerResponse: input.ownerResponse.trim() });
      if (!review) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode atualizar esta sugestão." });
      const eventType = input.status === previous.status ? "responded" : input.status === "accepted" ? "accepted" : input.status === "rejected" ? "rejected" : "implemented";
      await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: review.targetType, targetId: review.targetId, actorName: ctx.user.name || "Criador", eventType, detail: { reviewId: review.id, section: review.section, status: input.status, response: input.ownerResponse.trim(), observationApplied: input.status === "accepted" && requestsObservationUpdate } });
      return review;
    }),
    getPublic: publicProcedure.input(z.object({ token: z.string().min(8).max(64) })).query(async ({ input }) => {
      const genericShare = await getSharedFMContent(input.token);
      if (genericShare?.targetType === "homebrew") {
        const homebrew = await getFMHomebrew(genericShare.targetId);
        if (!homebrew) throw new TRPCError({ code: "NOT_FOUND", message: "Homebrew compartilhado não encontrado." });
        return { targetType: "homebrew" as const, targetId: homebrew.id, name: homebrew.name, summary: homebrew.summary, content: homebrew.content, kind: homebrew.kind };
      }
      if (genericShare?.targetType === "technique") {
        const technique = await getFMTechnique(genericShare.targetId);
        if (!technique) throw new TRPCError({ code: "NOT_FOUND", message: "Técnica compartilhada não encontrada." });
        const content = technique.technique as Record<string, unknown>;
        return { targetType: "technique" as const, targetId: technique.id, name: technique.name, summary: typeof content.basicFunction === "string" ? content.basicFunction : "Técnica compartilhada para avaliação.", content, kind: "technique" as const };
      }
      if (genericShare?.targetType === "character") {
        const character = await getFMCharacter(genericShare.targetId);
        if (!character) throw new TRPCError({ code: "NOT_FOUND", message: "Ficha compartilhada não encontrada." });
        return { targetType: "character" as const, targetId: character.id, name: character.name, summary: "Ficha de personagem compartilhada para avaliação.", content: character.sheet, kind: "character" };
      }
      const character = await getSharedFMCharacter(input.token);
      if (!character) throw new TRPCError({ code: "NOT_FOUND", message: "Conteúdo compartilhado não encontrado." });
      return { targetType: "character" as const, targetId: character.id, name: character.name, summary: "Ficha de personagem compartilhada para avaliação.", content: character.sheet, kind: "character" };
    }),
    submit: publicProcedure.input(reviewSubmissionInput).mutation(async ({ ctx, input }) => {
      const genericShare = await getSharedFMContent(input.token);
      let targetType: "character" | "homebrew" | "technique";
      let targetId: string;
      let ownerId: number;
      if (genericShare) {
        targetType = genericShare.targetType;
        targetId = genericShare.targetId;
        ownerId = genericShare.ownerId;
      } else {
        const sharedCharacter = await getSharedFMCharacter(input.token);
        const character = sharedCharacter ? await getFMCharacter(sharedCharacter.id) : undefined;
        if (!character) throw new TRPCError({ code: "NOT_FOUND", message: "Link de avaliação não encontrado." });
        targetType = "character";
        targetId = character.id;
        ownerId = character.ownerId;
      }
      const review = await createFMReview({ id: nanoid(22), ownerId, targetType, targetId, reviewerName: input.reviewerName.trim(), reviewerUserId: ctx.user?.id ?? null, kind: input.kind, section: input.section.trim(), field: input.field.trim(), currentValue: input.currentValue.trim(), suggestedValue: input.suggestedValue.trim(), reason: input.reason.trim(), status: "pending", ownerResponse: "" });
      if (!review) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível enviar a sugestão." });
      await createFMChangeHistory({ id: nanoid(22), ownerId, targetType, targetId, actorName: input.reviewerName.trim(), eventType: input.kind === "comment" ? "commented" : "suggested", detail: { reviewId: review.id, section: input.section.trim(), field: input.field.trim(), kind: input.kind } });
      return review;
    }),
  }),
  characters: router({
    list: protectedProcedure.query(({ ctx }) => listFMCharacters(ctx.user.id)),
    get: protectedProcedure.input(characterIdInput).query(async ({ ctx, input }) => {
      const character = await getFMCharacter(input.id);
      if (!character || character.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode abrir esta ficha." });
      }
      return character;
    }),
    uploadImage: protectedProcedure.input(characterImageUploadInput).mutation(async ({ ctx, input }) => {
      const character = await getFMCharacter(input.characterId);
      if (!character || character.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode anexar imagens a esta ficha." });
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo da imagem é inválido." });
      const data = Buffer.from(input.base64, "base64");
      if (!data.length || data.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "A imagem deve ter até 5 MB." });
      const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1];
      const stored = await storagePut(`fm-characters/${ctx.user.id}/${input.characterId}/${nanoid(12)}.${extension}`, data, input.contentType);
      return { id: nanoid(14), key: stored.key, url: stored.url, name: input.fileName, caption: input.caption.trim(), createdAt: Date.now() };
    }),
    save: protectedProcedure.input(characterInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMCharacter(input.id);
      if (existing && existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode editar esta ficha." });
      }
      const techniqueLibraryId = input.sheet.techniqueLibraryId;
      let sheetForSave = input.sheet;
      if (typeof techniqueLibraryId === "string" && techniqueLibraryId) {
        const selectedTechnique = await getFMTechnique(techniqueLibraryId);
        if (selectedTechnique && selectedTechnique.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A técnica selecionada não pertence à sua biblioteca." });
        }
        const previousTechniqueLibraryId = existing?.sheet.techniqueLibraryId;
        if (!selectedTechnique && previousTechniqueLibraryId === techniqueLibraryId) {
          const { techniqueLibraryId: _staleTechniqueLibraryId, ...legacySheet } = input.sheet;
          sheetForSave = legacySheet;
        } else if (!selectedTechnique) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A técnica selecionada não foi encontrada na sua biblioteca." });
        }
      }
      const customAptitudes = Array.isArray(input.sheet.aptitudes) ? input.sheet.aptitudes.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).catalogId === "string" && String((entry as Record<string, unknown>).catalogId).startsWith("homebrew:"))) : [];
      for (const aptitude of customAptitudes) {
        const homebrewId = typeof aptitude.homebrewId === "string" ? aptitude.homebrewId : "";
        const homebrew = homebrewId ? await getFMHomebrew(homebrewId) : undefined;
        if (!homebrew || homebrew.ownerId !== ctx.user.id || homebrew.kind !== "aptitude") throw new TRPCError({ code: "BAD_REQUEST", message: "A Aptidão Homebrew precisa pertencer à sua central e ser do tipo Aptidão." });
        const content = normalizeHomebrewContent(homebrew.content);
        const requiredLevel = Math.max(1, Math.min(30, Number.parseInt(content.level, 10) || 1));
        const cost = Math.max(0, Number.parseInt(content.cost, 10) || 0);
        if (aptitude.catalogId !== `homebrew:${homebrew.id}` || aptitude.name !== homebrew.name || aptitude.group !== "special" || aptitude.requiredLevel !== requiredLevel || aptitude.cost !== cost || aptitude.prerequisite !== (content.requirements || "—") || aptitude.effect !== (content.effects || content.description)) throw new TRPCError({ code: "BAD_REQUEST", message: "Os dados da Aptidão Homebrew devem corresponder ao conteúdo salvo na central." });
        const mechanics = content.mechanics.aptitude;
        const expected = { description: mechanics.description || content.description, requirements: mechanics.requirements.length ? mechanics.requirements : content.mechanics.requirements, modifiers: mechanics.modifiers.length ? mechanics.modifiers : content.mechanics.modifiers, effects: mechanics.effects, limitations: mechanics.limitations || content.fields.limitations || "", evolutions: mechanics.evolutions };
        const serialized = (entry: unknown) => JSON.stringify(entry ?? null);
        if ((aptitude.description !== undefined && aptitude.description !== expected.description) || (aptitude.modifiers !== undefined && serialized(aptitude.modifiers) !== serialized(expected.modifiers)) || (aptitude.requirements !== undefined && serialized(aptitude.requirements) !== serialized(expected.requirements)) || (aptitude.effects !== undefined && serialized(aptitude.effects) !== serialized(expected.effects)) || (aptitude.evolutions !== undefined && serialized(aptitude.evolutions) !== serialized(expected.evolutions)) || (aptitude.limitations !== undefined && aptitude.limitations !== expected.limitations)) throw new TRPCError({ code: "BAD_REQUEST", message: "Os efeitos da Aptidão Homebrew devem corresponder ao conteúdo estruturado salvo na central." });
      }
      const customTraining = Array.isArray(input.sheet.training) ? input.sheet.training.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).trackId === "string" && String((entry as Record<string, unknown>).trackId).startsWith("homebrew:"))) : [];
      for (const training of customTraining) {
        const homebrewId = typeof training.homebrewId === "string" ? training.homebrewId : "";
        const homebrew = homebrewId ? await getFMHomebrew(homebrewId) : undefined;
        if (!homebrew || homebrew.ownerId !== ctx.user.id || homebrew.kind !== "training" || training.trackId !== `homebrew:${homebrew.id}` || training.label !== homebrew.name) throw new TRPCError({ code: "BAD_REQUEST", message: "O Treinamento Homebrew precisa pertencer à sua central e corresponder ao conteúdo salvo." });
      }
      const nextVow = (input.sheet.houseRules as Record<string, unknown> | undefined)?.birthVow as Record<string, unknown> | undefined;
      const existingVow = (existing?.sheet.houseRules as Record<string, unknown> | undefined)?.birthVow as Record<string, unknown> | undefined;
      const existingProgression = existing?.sheet.progression as Record<string, unknown> | undefined;
      const nextProgression = input.sheet.progression as Record<string, unknown> | undefined;
      const establishedPrimary = typeof existingProgression?.primarySpecialization === "string" ? existingProgression.primarySpecialization : existingProgression?.specialization;
      const requestedPrimary = typeof nextProgression?.primarySpecialization === "string" ? nextProgression.primarySpecialization : nextProgression?.specialization;
      if (typeof establishedPrimary === "string" && typeof requestedPrimary === "string" && establishedPrimary !== requestedPrimary) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A primeira especialização escolhida é permanente e não pode ser alterada." });
      }
      if (existingVow?.locked) {
        const lockedFields = ["type", "description", "approved", "locked"];
        if (lockedFields.some(field => existingVow[field] !== nextVow?.[field])) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Votos de nascimento aprovados são imutáveis após o início da campanha." });
        }
      }
      if (nextVow?.locked && !existingVow?.locked && (nextVow.type === "none" || nextVow.approved !== true || typeof nextVow.description !== "string" || !nextVow.description.trim())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Um voto só pode ser fixado após descrição e aprovação antes da campanha." });
      }
      const projectedUnlocks = getSheetSpecializationAbilityUnlocks(sheetForSave as FMCharacterSheet);
      const rootProgression = sheetForSave.progression as Record<string, unknown> | undefined;
      const previousProgression = existing?.sheet.progression as Record<string, unknown> | undefined;
      const previousUnlocks = (Array.isArray(previousProgression?.specializationAbilityUnlocks) ? previousProgression.specializationAbilityUnlocks as FMCharacterSheet["progression"]["specializationAbilityUnlocks"] : []) ?? [];
      if (previousUnlocks.length || projectedUnlocks.length) {
        sheetForSave = { ...sheetForSave, progression: { ...rootProgression, specializationAbilityUnlocks: mergeSpecializationAbilityUnlockHistory(previousUnlocks, projectedUnlocks.filter(unlock => !unlock.coreId)) } };
      }
      const { clientId: _clientId, ...characterInputForStorage } = input;
      const saved = await saveFMCharacter({ ...characterInputForStorage, sheet: sheetForSave, ownerId: ctx.user.id, portraitUrl: input.portraitUrl ?? null });
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a ficha." });
      try {
        await ensureFMSpecializationAbilityCatalog();
        await syncFMCharacterSpecializationAbilities(input.id, projectedUnlocks);
      } catch (error) {
        console.error("[Especialização] Não foi possível sincronizar os desbloqueios após o salvamento:", error);
      }
      const previousAptitudes = Array.isArray(existing?.sheet.aptitudes) ? existing.sheet.aptitudes.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) : [];
      const nextAptitudes = Array.isArray(sheetForSave.aptitudes) ? sheetForSave.aptitudes.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) : [];
      for (const aptitude of nextAptitudes) {
        const id = typeof aptitude.id === "string" ? aptitude.id : "";
        const name = typeof aptitude.name === "string" ? aptitude.name : "Aptidão";
        const previous = previousAptitudes.find(item => item.id === id);
        if (!previous) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "character", targetId: input.id, actorName: ctx.user.name || "Jogador", eventType: "updated", detail: { category: aptitude.homebrewId ? "aptitude-homebrew-added" : "aptitude-acquired", aptitudeId: id, name } });
        else if (previous.selectedEvolutionId !== aptitude.selectedEvolutionId) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "character", targetId: input.id, actorName: ctx.user.name || "Jogador", eventType: "updated", detail: { category: aptitude.selectedEvolutionId ? "aptitude-evolved" : "aptitude-evolution-removed", aptitudeId: id, name, evolutionId: aptitude.selectedEvolutionId ?? null } });
      }
      for (const aptitude of previousAptitudes) {
        const id = typeof aptitude.id === "string" ? aptitude.id : "";
        if (id && !nextAptitudes.some(item => item.id === id)) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "character", targetId: input.id, actorName: ctx.user.name || "Jogador", eventType: "updated", detail: { category: "aptitude-removed", aptitudeId: id, name: typeof aptitude.name === "string" ? aptitude.name : "Aptidão" } });
      }
      const calculatedSheet = sheetForSave as unknown as import("../shared/fmTypes").FMCharacterSheet;
      if (calculatedSheet.mechanics && Array.isArray(calculatedSheet.aptitudes)) {
        const unmet = calculateCharacterState(calculatedSheet).requirements.filter(item => !item.met && nextAptitudes.some(aptitude => item.sourceId === aptitude.id || item.sourceId.startsWith(`${aptitude.id}:`)));
        for (const item of unmet) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "character", targetId: input.id, actorName: ctx.user.name || "Sistema", eventType: "updated", detail: { category: "aptitude-requirement-unmet", aptitude: item.sourceName, requirement: item.message } });
      }
      const share = await getFMCharacterShare(input.id, ctx.user.id);
      emitCharacterUpdated({ characterId: input.id, shareToken: share?.token, updatedAt: Date.now(), sourceClientId: input.clientId });
      return saved;
    }),
    remove: protectedProcedure.input(characterIdInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMCharacter(input.id);
      if (!existing || existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode excluir esta ficha." });
      }
      await deleteFMCharacter(input.id, ctx.user.id);
      return { success: true } as const;
    }),
    duplicate: protectedProcedure.input(characterIdInput).mutation(async ({ ctx, input }) => {
      const source = await getFMCharacter(input.id);
      if (!source || source.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode duplicar esta ficha." });
      }
      const id = nanoid(18);
      const sheet = { ...source.sheet, identity: { ...(source.sheet.identity as Record<string, unknown> ?? {}), name: `${source.name} — cópia` } };
      const duplicate = await saveFMCharacter({ id, ownerId: ctx.user.id, name: `${source.name} — cópia`, portraitUrl: source.portraitUrl, sheet });
      if (!duplicate) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível duplicar a ficha." });
      return duplicate;
    }),
    share: protectedProcedure.input(z.object({ characterId: z.string().min(6).max(64) })).mutation(async ({ ctx, input }) => {
      const character = await getFMCharacter(input.characterId);
      if (!character || character.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode compartilhar esta ficha." });
      }
      const existing = await getFMCharacterShare(input.characterId, ctx.user.id);
      const share = existing ?? await createFMCharacterShare({ characterId: input.characterId, ownerId: ctx.user.id, token: nanoid(24) });
      if (!share) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o link público." });
      return { token: share.token };
    }),
  }),
  contentShares: router({
    list: protectedProcedure.query(({ ctx }) => listFMContentShares(ctx.user.id)),
    create: protectedProcedure.input(contentShareTargetInput).mutation(async ({ ctx, input }) => {
      const target = input.targetType === "character" ? await getFMCharacter(input.targetId) : input.targetType === "homebrew" ? await getFMHomebrew(input.targetId) : await getFMTechnique(input.targetId);
      if (!target || target.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode compartilhar este conteúdo." });
      const existing = await getFMContentShare(input.targetType, input.targetId, ctx.user.id);
      const share = existing?.enabled ? existing : await createFMContentShare({ ownerId: ctx.user.id, targetType: input.targetType, targetId: input.targetId, token: nanoid(24) });
      if (!share) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o link compartilhável." });
      if (!existing || !existing.enabled) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: input.targetType, targetId: input.targetId, actorName: ctx.user.name || "Criador", eventType: existing ? "regenerated" : "shared", detail: { shareId: share.id, token: share.token } });
      return share;
    }),
    revoke: protectedProcedure.input(contentShareIdInput).mutation(async ({ ctx, input }) => {
      const share = await setFMContentShareEnabled({ id: input.id, ownerId: ctx.user.id, enabled: false });
      if (!share) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode revogar este link." });
      await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: share.targetType, targetId: share.targetId, actorName: ctx.user.name || "Criador", eventType: "revoked", detail: { shareId: share.id } });
      return share;
    }),
    regenerate: protectedProcedure.input(contentShareIdInput).mutation(async ({ ctx, input }) => {
      const share = await regenerateFMContentShare({ id: input.id, ownerId: ctx.user.id, token: nanoid(24) });
      if (!share) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode gerar um novo link para este conteúdo." });
      await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: share.targetType, targetId: share.targetId, actorName: ctx.user.name || "Criador", eventType: "regenerated", detail: { shareId: share.id, token: share.token } });
      return share;
    }),
  }),
  shares: router({
    list: protectedProcedure.query(({ ctx }) => listFMCharacterShares(ctx.user.id)),
  }),
  shared: router({
    get: publicProcedure.input(z.object({ token: z.string().min(8).max(64) })).query(async ({ input }) => {
      const character = await getSharedFMCharacter(input.token);
      if (!character) throw new TRPCError({ code: "NOT_FOUND", message: "Ficha compartilhada não encontrada." });
      return character;
    }),
  }),
});

export type AppRouter = typeof appRouter;
