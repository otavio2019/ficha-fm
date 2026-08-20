import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getHighestSpellLevel } from "../shared/fmRules";
import { FM_DECLARED_MODIFIER_RULES, isDeclaredModifierInRange, type FMDeclaredModifierRule } from "../shared/fmModifiers";
import { getInfiniteWorldLevel } from "../shared/infiniteWorlds";
import { validateTechnique } from "../shared/fmTechniques";
import { validateHouseRules } from "../shared/fmHouseRules";
import { createFMCharacterShare, deleteFMCharacter, getFMCharacter, getFMCharacterShare, getSharedFMCharacter, listFMCharacters, listFMCharacterShares, saveFMCharacter } from "./db";
import { emitCharacterUpdated } from "./live";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const validSkillAttributes = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "presence"]);
const validSkillProficiencies = new Set(["untrained", "trained", "master"]);
function validateDeclaredModifier(value: unknown, path: (string | number)[], rule: FMDeclaredModifierRule, context: z.RefinementCtx) {
  if (!isDeclaredModifierInRange(value, rule)) {
    const specification = FM_DECLARED_MODIFIER_RULES[rule];
    context.addIssue({ code: "custom", path, message: `${specification.label} deve ficar entre ${specification.minimum} e +${specification.maximum}.` });
  }
}

const characterInput = z.object({
  id: z.string().min(6).max(64),
  name: z.string().trim().min(1).max(160),
  portraitUrl: z.string().url().nullable().optional(),
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
  const progression = input.sheet.progression as Record<string, unknown> | undefined;
  const level = typeof progression?.level === "number" ? progression.level : 1;
  const specialization = typeof progression?.specialization === "string" ? progression.specialization : "fighter";
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
    });
  }
});

const characterIdInput = z.object({ id: z.string().min(6).max(64) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
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
    save: protectedProcedure.input(characterInput).mutation(async ({ ctx, input }) => {
      const existing = await getFMCharacter(input.id);
      if (existing && existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode editar esta ficha." });
      }
      const nextVow = (input.sheet.houseRules as Record<string, unknown> | undefined)?.birthVow as Record<string, unknown> | undefined;
      const existingVow = (existing?.sheet.houseRules as Record<string, unknown> | undefined)?.birthVow as Record<string, unknown> | undefined;
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
