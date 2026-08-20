import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getHighestSpellLevel } from "../shared/fmRules";
import { createFMCharacterShare, deleteFMCharacter, getFMCharacter, getFMCharacterShare, getSharedFMCharacter, listFMCharacters, listFMCharacterShares, saveFMCharacter } from "./db";
import { emitCharacterUpdated } from "./live";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const validSkillAttributes = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "presence"]);
const validSkillProficiencies = new Set(["untrained", "trained", "master"]);

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
    });
  }
  const progression = input.sheet.progression as Record<string, unknown> | undefined;
  const level = typeof progression?.level === "number" ? progression.level : 1;
  const spells = input.sheet.spells;
  if (Array.isArray(spells)) {
    const highestSpellLevel = getHighestSpellLevel(level);
    spells.forEach((spell, index) => {
      const spellLevel = (spell as Record<string, unknown>).level;
      if (typeof spellLevel !== "number" || spellLevel < 0 || spellLevel > highestSpellLevel) {
        context.addIssue({ code: "custom", path: ["sheet", "spells", index, "level"], message: `O nível do feitiço excede o máximo liberado (${highestSpellLevel}).` });
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
