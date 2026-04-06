import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Admin ruxsatlari sozlamalari
  showPinsToAdmins: boolean("show_pins_to_admins").notNull().default(true),
  canAdminAnalyze: boolean("can_admin_analyze").notNull().default(true),
  canAdminDeleteOrders: boolean("can_admin_delete_orders").notNull().default(true),
  canAdminPrint: boolean("can_admin_print").notNull().default(true),
  canAdminEditOrders: boolean("can_admin_edit_orders").notNull().default(true),
  canAdminMarkDelivered: boolean("can_admin_mark_delivered").notNull().default(false),
});

export const insertStoreSchema = createInsertSchema(storesTable).omit({ id: true, createdAt: true });
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;

export interface StoreSettings {
  showPinsToAdmins: boolean;
  canAdminAnalyze: boolean;
  canAdminDeleteOrders: boolean;
  canAdminPrint: boolean;
  canAdminEditOrders: boolean;
  canAdminMarkDelivered: boolean;
}
