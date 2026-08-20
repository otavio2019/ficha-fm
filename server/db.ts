import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { fmCharacters, fmCharacterShares, fmTechniques, type InsertFMCharacter, type InsertFMTechniqueLibraryItem, type InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!database && process.env.DATABASE_URL) {
    try {
      database = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Falha ao inicializar a conexão:", error);
      database = null;
    }
  }
  return database;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return records[0];
}

export async function listFMCharacters(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fmCharacters).where(eq(fmCharacters.ownerId, ownerId)).orderBy(desc(fmCharacters.updatedAt));
}

export async function getFMCharacter(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select().from(fmCharacters).where(eq(fmCharacters.id, id)).limit(1);
  return records[0];
}

export async function listFMTechniques(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fmTechniques).where(eq(fmTechniques.ownerId, ownerId)).orderBy(desc(fmTechniques.updatedAt));
}

export async function getFMTechnique(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select().from(fmTechniques).where(eq(fmTechniques.id, id)).limit(1);
  return records[0];
}

export async function saveFMTechnique(technique: InsertFMTechniqueLibraryItem) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(fmTechniques).values(technique).onDuplicateKeyUpdate({
    set: { name: technique.name, technique: technique.technique, updatedAt: new Date() },
  });
  return getFMTechnique(technique.id);
}

export async function deleteFMTechnique(id: string, ownerId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(fmTechniques).where(and(eq(fmTechniques.id, id), eq(fmTechniques.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}

export async function saveFMCharacter(character: InsertFMCharacter) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(fmCharacters).values(character).onDuplicateKeyUpdate({
    set: { name: character.name, portraitUrl: character.portraitUrl ?? null, sheet: character.sheet, updatedAt: new Date() },
  });
  return getFMCharacter(character.id);
}

export async function deleteFMCharacter(id: string, ownerId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(fmCharacterShares).where(and(eq(fmCharacterShares.characterId, id), eq(fmCharacterShares.ownerId, ownerId)));
  const result = await db.delete(fmCharacters).where(and(eq(fmCharacters.id, id), eq(fmCharacters.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}

export async function getFMCharacterShare(characterId: string, ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select().from(fmCharacterShares).where(and(eq(fmCharacterShares.characterId, characterId), eq(fmCharacterShares.ownerId, ownerId))).limit(1);
  return records[0];
}

export async function createFMCharacterShare(input: { characterId: string; ownerId: number; token: string }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(fmCharacterShares).values(input);
  return getFMCharacterShare(input.characterId, input.ownerId);
}

export async function listFMCharacterShares(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ token: fmCharacterShares.token, characterId: fmCharacters.id, name: fmCharacters.name, portraitUrl: fmCharacters.portraitUrl, updatedAt: fmCharacters.updatedAt })
    .from(fmCharacterShares)
    .innerJoin(fmCharacters, eq(fmCharacterShares.characterId, fmCharacters.id))
    .where(eq(fmCharacterShares.ownerId, ownerId))
    .orderBy(desc(fmCharacters.updatedAt));
}

export async function getSharedFMCharacter(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const records = await db.select({ id: fmCharacters.id, name: fmCharacters.name, portraitUrl: fmCharacters.portraitUrl, sheet: fmCharacters.sheet, updatedAt: fmCharacters.updatedAt, token: fmCharacterShares.token })
    .from(fmCharacterShares)
    .innerJoin(fmCharacters, eq(fmCharacterShares.characterId, fmCharacters.id))
    .where(eq(fmCharacterShares.token, token))
    .limit(1);
  return records[0];
}
