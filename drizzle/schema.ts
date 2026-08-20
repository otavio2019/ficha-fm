import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const fmCharacters = mysqlTable("fm_characters", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  portraitUrl: text("portraitUrl"),
  sheet: json("sheet").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerIndex: index("fm_characters_owner_index").on(table.ownerId),
  ownerUpdatedIndex: index("fm_characters_owner_updated_index").on(table.ownerId, table.updatedAt),
}));

export const fmCharacterShares = mysqlTable("fm_character_shares", {
  id: int("id").autoincrement().primaryKey(),
  characterId: varchar("characterId", { length: 64 }).notNull(),
  ownerId: int("ownerId").notNull(),
  token: varchar("token", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  tokenUnique: uniqueIndex("fm_character_shares_token_unique").on(table.token),
  characterUnique: uniqueIndex("fm_character_shares_character_unique").on(table.characterId),
  ownerIndex: index("fm_character_shares_owner_index").on(table.ownerId),
}));

export const fmTechniques = mysqlTable("fm_techniques", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  technique: json("technique").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerIndex: index("fm_techniques_owner_index").on(table.ownerId),
  ownerUpdatedIndex: index("fm_techniques_owner_updated_index").on(table.ownerId, table.updatedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type FMCharacter = typeof fmCharacters.$inferSelect;
export type InsertFMCharacter = typeof fmCharacters.$inferInsert;
export type FMCharacterShare = typeof fmCharacterShares.$inferSelect;
export type FMTechniqueLibraryItem = typeof fmTechniques.$inferSelect;
export type InsertFMTechniqueLibraryItem = typeof fmTechniques.$inferInsert;
