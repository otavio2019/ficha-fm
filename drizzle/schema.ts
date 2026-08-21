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

export const fmHomebrews = mysqlTable("fm_homebrews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  kind: mysqlEnum("kind", ["technique", "vow", "aptitude", "race", "domain", "training", "item", "ability", "rule", "other"]).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  summary: text("summary").notNull(),
  content: json("content").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerIndex: index("fm_homebrews_owner_index").on(table.ownerId),
  ownerKindIndex: index("fm_homebrews_owner_kind_index").on(table.ownerId, table.kind),
  ownerUpdatedIndex: index("fm_homebrews_owner_updated_index").on(table.ownerId, table.updatedAt),
}));

export const fmContentShares = mysqlTable("fm_content_shares", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  targetType: mysqlEnum("targetType", ["character", "homebrew"]).notNull(),
  targetId: varchar("targetId", { length: 64 }).notNull(),
  token: varchar("token", { length: 64 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  tokenUnique: uniqueIndex("fm_content_shares_token_unique").on(table.token),
  targetUnique: uniqueIndex("fm_content_shares_target_unique").on(table.targetType, table.targetId),
  ownerIndex: index("fm_content_shares_owner_index").on(table.ownerId),
}));

export const fmReviews = mysqlTable("fm_reviews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  targetType: mysqlEnum("targetType", ["character", "homebrew"]).notNull(),
  targetId: varchar("targetId", { length: 64 }).notNull(),
  reviewerName: varchar("reviewerName", { length: 160 }).notNull(),
  reviewerUserId: int("reviewerUserId"),
  kind: mysqlEnum("kind", ["general", "suggestion", "comment"]).notNull(),
  section: varchar("section", { length: 160 }).notNull(),
  field: varchar("field", { length: 160 }).default("").notNull(),
  currentValue: text("currentValue").notNull(),
  suggestedValue: text("suggestedValue").notNull(),
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "implemented"]).default("pending").notNull(),
  ownerResponse: text("ownerResponse").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  targetIndex: index("fm_reviews_target_index").on(table.targetType, table.targetId),
  ownerStatusIndex: index("fm_reviews_owner_status_index").on(table.ownerId, table.status),
}));

export const fmChangeHistory = mysqlTable("fm_change_history", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  targetType: mysqlEnum("targetType", ["character", "homebrew"]).notNull(),
  targetId: varchar("targetId", { length: 64 }).notNull(),
  actorName: varchar("actorName", { length: 160 }).notNull(),
  eventType: mysqlEnum("eventType", ["created", "updated", "shared", "revoked", "regenerated", "suggested", "commented", "responded", "accepted", "rejected", "implemented", "deleted"]).notNull(),
  detail: json("detail").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  targetIndex: index("fm_change_history_target_index").on(table.targetType, table.targetId),
  ownerIndex: index("fm_change_history_owner_index").on(table.ownerId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type FMCharacter = typeof fmCharacters.$inferSelect;
export type InsertFMCharacter = typeof fmCharacters.$inferInsert;
export type FMCharacterShare = typeof fmCharacterShares.$inferSelect;
export type FMTechniqueLibraryItem = typeof fmTechniques.$inferSelect;
export type InsertFMTechniqueLibraryItem = typeof fmTechniques.$inferInsert;
export type FMHomebrew = typeof fmHomebrews.$inferSelect;
export type InsertFMHomebrew = typeof fmHomebrews.$inferInsert;
export type FMContentShare = typeof fmContentShares.$inferSelect;
export type FMReview = typeof fmReviews.$inferSelect;
export type FMChangeHistory = typeof fmChangeHistory.$inferSelect;
import { boolean } from "drizzle-orm/mysql-core";
