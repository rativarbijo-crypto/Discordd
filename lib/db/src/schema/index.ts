import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const keysTable = pgTable("keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  type: text("type").notNull().default("user"),
  usedBy: text("used_by"),
  usedAt: timestamp("used_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isUsed: boolean("is_used").notNull().default(false),
});

export const resellersTable = pgTable("resellers", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  name: text("name").notNull(),
  token: text("token").notNull(),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(false),
  autoReplyText: text("auto_reply_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").notNull(),
  discordId: text("discord_id").notNull(),
  name: text("name").notNull().default("Ad Job"),
  message: text("message").notNull(),
  channelIds: text("channel_ids").notNull(),
  delaySeconds: integer("delay_seconds").notNull().default(0),
  images: text("images"),
  isActive: boolean("is_active").notNull().default(false),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertKeySchema = createInsertSchema(keysTable).omit({ id: true, createdAt: true });
export const insertResellerSchema = createInsertSchema(resellersTable).omit({ id: true, createdAt: true });
export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true });
export const insertAdminSchema = createInsertSchema(adminsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type Key = typeof keysTable.$inferSelect;
export type Reseller = typeof resellersTable.$inferSelect;
export type Token = typeof tokensTable.$inferSelect;
export type Job = typeof jobsTable.$inferSelect;
export type Admin = typeof adminsTable.$inferSelect;
