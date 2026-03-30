import { pgTable, serial, text, integer, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";
import { accountsTable } from "./accounts";
import { serviceTypesTable } from "./service_types";
import { clientsTable } from "./clients";

export const orderStatusEnum = pgEnum("order_status", ["new", "accepted", "ready"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("new"),
  serviceTypeId: integer("service_type_id").references(() => serviceTypesTable.id),
  serviceTypeName: text("service_type_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit"),
  shelf: text("shelf"),
  notes: text("notes"),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  storeName: text("store_name").notNull(),
  clientId: integer("client_id").references(() => clientsTable.id),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  createdById: integer("created_by_id").references(() => accountsTable.id),
  createdByName: text("created_by_name").notNull(),
  acceptedById: integer("accepted_by_id").references(() => accountsTable.id),
  acceptedByName: text("accepted_by_name"),
  acceptedAt: timestamp("accepted_at"),
  readyAt: timestamp("ready_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
