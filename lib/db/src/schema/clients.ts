import { pgTable, serial, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientStatusEnum = pgEnum("client_status", ["pending", "approved", "rejected"]);

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  telegramUserId: text("telegram_user_id").unique(),
  botStoreId: integer("bot_store_id"),
  status: clientStatusEnum("status").notNull().default("pending"),
  registrationStep: text("registration_step").default("start"),
  tempData: text("temp_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
