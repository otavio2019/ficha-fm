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
import { getAptitudeCatalogEntry } from "../shared/fmCampaignCapabilities";
import { FM_HOMEBREW_KINDS, FM_REVIEW_KINDS, FM_REVIEW_STATUSES, validateHomebrew, validateReview } from "../shared/fmHomebrew";
import { normalizeHomebrewContent } from "../shared/fmHomebrew";
import { storagePut } from "./storage";
import { createFMChangeHistory, createFMCharacterShare, createFMContentShare, createFMReview, deleteFMCharacter, deleteFMHomebrew, deleteFMTechnique, getFMCharacter, getFMCharacterShare, getFMContentShare, getFMHomebrew, getFMTechnique, getSharedFMCharacter, getSharedFMContent, listFMChangeHistory, listFMCharacters, listFMCharacterShares, listFMHomebrews, listFMReviews, listFMTechniques, saveFMCharacter, saveFMHomebrew, saveFMTechnique, updateFMReview } from "./db";
import { emitCharacterUpdated } from "./live";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const validSkillAttributes = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "presence"]);
const validSkillProficiencies = new Set(["untrained", "trained", "master"]);
const validOriginIds = new Set([...FM_ORIGIN_CATALOG.map(origin => origin.id), "custom"]);
const validClanIds = new Set([...FM_CLAN_CATALOG.map(clan => clan.id), "custom"]);
const storedImageUrl = z.union([z.string().url(), z.string().regex(/^\/manus-storage\//)]);
const homebrewContentInput = z.object({ description: z.string().max(8000), requirements: z.string().max(8000), effects: z.string().max(8000), cost: z.string().max(1000), level: z.string().max(1000), notes: z.string().max(8000), fields: z.record(z.string(), z.string().max(4000)) });
const homebrewInput = z.object({ id: z.string().min(6).max(64), kind: z.enum(FM_HOMEBREW_KINDS), name: z.string().trim().min(1).max(160), summary: z.string().trim().min(1).max(1000), content: homebrewContentInput }).superRefine((input, context) => validateHomebrew(input).forEach(message => context.addIssue({ code: "custom", path: ["content"], message })));
const reviewSubmissionInput = z.object({ token: z.string().min(8).max(64), reviewerName: z.string().trim().min(1).max(160), kind: z.enum(FM_REVIEW_KINDS), section: z.string().trim().min(1).max(160), currentValue: z.string().max(8000).default(""), suggestedValue: z.string().max(8000).default(""), reason: z.string().trim().min(1).max(8000) }).superRefine((input, context) => validateReview({ ...input, targetId: "shared" }).forEach(message => context.addIssue({ code: "custom", path: ["reason"], message })));
const reviewOwnerUpdateInput = z.object({ id: z.string().min(6).max(64), status: z.enum(FM_REVIEW_STATUSES), ownerResponse: z.string().max(8000).default("") });
const reviewTargetInput = z.object({ targetType: z.enum(["character", "homebrew"]), targetId: z.string().min(6).max(64) });
function validateDeclaredModifier(value: unknown, path: (string | number)[], rule: FMDeclaredModifierRule, context: z.RefinementCtx) {
  if (!isDeclaredModifierInRange(value, rule)) {
    const specification = FM_DECLARED_MODIFIER_RULES[rule];
    context.addIssue({ code: "custom", path, message: `${specification.label} deve ficar entre ${specification.minimum} e +${specification.maximum}.` });
  }
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
      if (level < catalog.requiredLevel) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "catalogId"], message: `${catalog.name} exige nível ${catalog.requiredLevel}.` });
      if (catalog.prerequisite !== "—" && !aptitudes.some(candidate => (candidate as Record<string, unknown>).name === catalog.prerequisite)) context.addIssue({ code: "custom", path: ["sheet", "aptitudes", index, "catalogId"], message: `${catalog.name} exige ${catalog.prerequisite}.` });
    });
    const budget = Math.floor(Math.max(1, Math.min(30, level)) / 2) + Math.floor(Math.max(1, Math.min(30, level)) / 10);
    if (spent > budget) context.addIssue({ code: "custom", path: ["sheet", "aptitudes"], message: `A ficha possui ${spent} ponto(s) de aptidão gastos, mas o nível ${level} libera apenas ${budget}.` });
  }
  const houseRules = input.sheet.houseRules;
  validateHouseRules(houseRules).forEach(message => {
    context.addIssue({ code: "custom", path: ["sheet", "houseRules"], message });
  });
  const technique = input.sheet.technique as Record<string, unknown> | undefined;
  validateTechnique(technique, specialization).forEach(issue => {
    context.addIssue({ code: "custom", path: ["sheet", "technique", issue.field], message: issue.message });
  });
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
      const share = existing ?? await createFMContentShare({ ownerId: ctx.user.id, targetType: "homebrew", targetId: input.id, token: nanoid(24) });
      if (!share) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o link de avaliação." });
      if (!existing) await createFMChangeHistory({ id: nanoid(22), ownerId: ctx.user.id, targetType: "homebrew", targetId: input.id, actorName: ctx.user.name || "Criador", eventType: "shared", detail: { token: share.token } });
      return { token: share.token };
    }),
  }),
  reviews: router({
    list: protectedProcedure.input(reviewTargetInput.optional()).query(({ ctx, input }) => listFMReviews(ctx.user.id, input?.targetType, input?.targetId)),
    history: protectedProcedure.input(reviewTargetInput.optional()).query(({ ctx, input }) => listFMChangeHistory(ctx.user.id, input?.targetType, input?.targetId)),
    update: protectedProcedure.input(reviewOwnerUpdateInput).mutation(async ({ ctx, input }) => {
      const review = await updateFMReview(input.id, ctx.user.id, { status: input.status, ownerResponse: input.ownerResponse.trim() });
      if (!review) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode atualizar esta sugestão." });
      const eventType = input.status === "accepted" ? "accepted" : input.status === "rejected" ? "rejected" : input.status === "implemented" ? "implemented" : "responded";
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
      const character = await getSharedFMCharacter(input.token);
      if (!character) throw new TRPCError({ code: "NOT_FOUND", message: "Conteúdo compartilhado não encontrado." });
      return { targetType: "character" as const, targetId: character.id, name: character.name, summary: "Ficha de personagem compartilhada para avaliação.", content: character.sheet, kind: "character" };
    }),
    submit: publicProcedure.input(reviewSubmissionInput).mutation(async ({ ctx, input }) => {
      const genericShare = await getSharedFMContent(input.token);
      let targetType: "character" | "homebrew";
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
      const review = await createFMReview({ id: nanoid(22), ownerId, targetType, targetId, reviewerName: input.reviewerName.trim(), reviewerUserId: ctx.user?.id ?? null, kind: input.kind, section: input.section.trim(), currentValue: input.currentValue.trim(), suggestedValue: input.suggestedValue.trim(), reason: input.reason.trim(), status: "pending", ownerResponse: "" });
      if (!review) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível enviar a sugestão." });
      await createFMChangeHistory({ id: nanoid(22), ownerId, targetType, targetId, actorName: input.reviewerName.trim(), eventType: input.kind === "comment" ? "commented" : "suggested", detail: { reviewId: review.id, section: input.section.trim(), kind: input.kind } });
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
      if (typeof techniqueLibraryId === "string" && techniqueLibraryId) {
        const selectedTechnique = await getFMTechnique(techniqueLibraryId);
        if (!selectedTechnique || selectedTechnique.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A técnica selecionada não pertence à sua biblioteca." });
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
      const saved = await saveFMCharacter({ ...input, ownerId: ctx.user.id, portraitUrl: input.portraitUrl ?? null });
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a ficha." });
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
