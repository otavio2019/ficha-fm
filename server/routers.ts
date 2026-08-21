import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { FM_MULTICLASS_REQUIREMENTS, FM_SPECIALIZATION_PROFILES, getHighestSpellLevel, getTechniquePowerProgression } from "../shared/fmRules";
import { getEquipmentCatalogEntry, getSkillCatalogEntry } from "../shared/fmCatalogs";
import { FM_DECLARED_MODIFIER_RULES, isDeclaredModifierInRange, type FMDeclaredModifierRule } from "../shared/fmModifiers";
import { getInfiniteWorldLevel } from "../shared/infiniteWorlds";
import { validateTechnique } from "../shared/fmTechniques";
import { validateHouseRules } from "../shared/fmHouseRules";
import { FM_CLAN_CATALOG, FM_ORIGIN_CATALOG, getClanCatalogEntry, getOriginAttributeAllocation, getOriginCatalogEntry } from "../shared/fmOrigins";
import { FM_INVOCATION_GRADE_RULES } from "../shared/fmInvocations";
import { getAptitudeCatalogEntry, getAptitudeDefinition } from "../shared/fmCampaignCapabilities";
import { FM_HOMEBREW_KINDS, FM_REVIEW_KINDS, FM_REVIEW_STATUSES, validateHomebrew, validateReview } from "../shared/fmHomebrew";
import { normalizeHomebrewContent } from "../shared/fmHomebrew";
import { fmAttributeKeys, type FMModifierTarget, type FMRequirement } from "../shared/fmTypes";
import { calculateCharacterState } from "../shared/fmCharacterState";
import { storagePut } from "./storage";
import { createFMChangeHistory, createFMCharacterShare, createFMContentShare, createFMReview, deleteFMCharacter, deleteFMHomebrew, deleteFMTechnique, getFMCharacter, getFMCharacterShare, getFMContentShare, getFMHomebrew, getFMReview, getFMTechnique, getSharedFMCharacter, getSharedFMContent, listFMChangeHistory, listFMCharacters, listFMCharacterShares, listFMContentShares, listFMHomebrews, listFMReviews, listFMTechniques, regenerateFMContentShare, saveFMCharacter, saveFMHomebrew, saveFMTechnique, setFMContentShareEnabled, updateFMReview } from "./db";
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
const raceEvolutionInput = z.object({ id: z.string().min(1).max(64), name: z.string().trim().min(1).max(160), description: z.string().max(4000), replacesBaseModifiers: z.boolean().optional(), requirements: z.array(requirementInput).default([]), modifiers: z.array(modifierDefinitionInput).default([]), characteristics: z.array(z.string().max(1000)).default([]), abilities: z.array(z.string().max(1000)).default([]) });
const aptitudeEffectInput = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(64), type: z.literal("skill-modifier"), skillId: z.string().min(1).max(160), value: z.number().finite().min(-20).max(20), note: z.string().max(1000).optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("unlock"), target: z.enum(["technique", "ability", "training", "vow", "item"]), referenceId: z.string().min(1).max(160), label: z.string().min(1).max(160), description: z.string().max(4000).optional() }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("feature"), label: z.string().min(1).max(160), description: z.string().min(1).max(4000) }),
]);
const aptitudeEvolutionInput = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(160), description: z.string().max(4000), level: z.number().int().min(1).max(30), requirements: z.array(requirementInput).default([]), modifiers: z.array(modifierDefinitionInput).default([]), effects: z.array(aptitudeEffectInput).default([]), limitations: z.string().max(4000).default(""), replacesBaseEffects: z.boolean().optional() });
const aptitudeMechanicsInput = z.object({ description: z.string().max(8000).default(""), requirements: z.array(requirementInput).default([]), modifiers: z.array(modifierDefinitionInput).default([]), effects: z.array(aptitudeEffectInput).default([]), limitations: z.string().max(4000).default(""), evolutions: z.array(aptitudeEvolutionInput).default([]) }).default({ description: "", requirements: [], modifiers: [], effects: [], limitations: "", evolutions: [] });
const homebrewMechanicsInput = z.object({ modifiers: z.array(modifierDefinitionInput).default([]), requirements: z.array(requirementInput).default([]), evolutions: z.array(raceEvolutionInput).default([]), aptitude: aptitudeMechanicsInput }).default({ modifiers: [], requirements: [], evolutions: [], aptitude: { description: "", requirements: [], modifiers: [], effects: [], limitations: "", evolutions: [] } });
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

const characterInput = z.object({
  id: z.string().min(6).max(64),
  name: z.string().trim().min(1).max(160),
  portraitUrl: storedImageUrl.nullable().optional(),
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
  const technique = input.sheet.technique as Record<string, unknown> | undefined;
  validateMechanicSource(technique, ["sheet", "technique"], context);
  validateTechnique(technique, specialization).forEach(issue => {
    context.addIssue({ code: "custom", path: ["sheet", "technique", issue.field], message: issue.message });
  });
  const mechanics = asRecord(input.sheet.mechanics);
  const race = asRecord(mechanics?.race);
  if (race) {
    if (race.sourceKind !== "homebrew" && race.sourceKind !== "custom") context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "sourceKind"], message: "A origem da raça mecânica é inválida." });
    if (typeof race.id !== "string" || !race.id.trim() || typeof race.name !== "string" || !race.name.trim()) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race"], message: "A raça mecânica precisa de identificador e nome." });
    validateMechanicSource(race, ["sheet", "mechanics", "race"], context);
    if (race.evolutions !== undefined && !Array.isArray(race.evolutions)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "evolutions"], message: "Evoluções da raça devem ser uma lista." });
    if (Array.isArray(race.evolutions)) race.evolutions.forEach((evolution, index) => {
      const item = asRecord(evolution);
      if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim()) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "evolutions", index], message: "Cada evolução precisa de identificador e nome." });
      validateMechanicSource(item, ["sheet", "mechanics", "race", "evolutions", index], context);
    });
    if (typeof race.selectedEvolutionId === "string" && Array.isArray(race.evolutions) && !race.evolutions.some(evolution => asRecord(evolution)?.id === race.selectedEvolutionId)) context.addIssue({ code: "custom", path: ["sheet", "mechanics", "race", "selectedEvolutionId"], message: "A evolução selecionada não pertence à raça atual." });
  }
  const training = input.sheet.training;
  if (Array.isArray(training)) training.forEach((track, index) => validateMechanicSource(track, ["sheet", "training", index], context));
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
  const invocations = input.sheet.invocations;
  if (invocations !== undefined && !Array.isArray(invocations)) {
    context.addIssue({ code: "custom", path: ["sheet", "invocations"], message: "Invocações devem ser uma lista." });
  }
  if (Array.isArray(invocations)) invocations.forEach((invocation, index) => {
    const value = invocation as Record<string, unknown>;
    if (typeof value.name !== "string" || !value.name.trim()) context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "name"], message: "O nome da Invocação é obrigatório." });
    if (typeof value.grade !== "string" || !(value.grade in FM_INVOCATION_GRADE_RULES)) context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "grade"], message: "Grau de Invocação inválido." });
    if (!Array.isArray(value.actions) || value.actions.some(action => typeof action !== "object" || action === null || typeof (action as Record<string, unknown>).name !== "string" || typeof (action as Record<string, unknown>).effect !== "string")) {
      context.addIssue({ code: "custom", path: ["sheet", "invocations", index, "actions"], message: "Toda ação de Invocação precisa ter nome e efeito declarados." });
    }
  });
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
      const review = await updateFMReview(input.id, ctx.user.id, { status: input.status, ownerResponse: input.ownerResponse.trim() });
      if (!review) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode atualizar esta sugestão." });
      const eventType = input.status === previous.status ? "responded" : input.status === "accepted" ? "accepted" : input.status === "rejected" ? "rejected" : "implemented";
      await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: review.targetType, targetId: review.targetId, actorName: ctx.user.name || "Criador", eventType, detail: { reviewId: review.id, section: review.section, status: input.status, response: input.ownerResponse.trim() } });
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
      const saved = await saveFMCharacter({ ...input, sheet: sheetForSave, ownerId: ctx.user.id, portraitUrl: input.portraitUrl ?? null });
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a ficha." });
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
      emitCharacterUpdated({ characterId: input.id, shareToken: share?.token, updatedAt: Date.now() });
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
