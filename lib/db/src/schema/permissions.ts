import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { storesTable } from "./stores";

export const accountPermissionsTable = pgTable("account_permissions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  permissionKey: varchar("permission_key", { length: 64 }).notNull(),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.accountId, t.permissionKey, t.storeId)]);

// Mode for each permission per store:
// "none" = hech kimga (nobody, except sudo/superadmin)
// "some" = faqat tanlanganlarga (only listed users — whitelist, default)
// "all"  = xammaga, istisnolar bundan mustasno (everyone except listed — blacklist)
export const storePermissionModesTable = pgTable("store_permission_modes", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  permissionKey: varchar("permission_key", { length: 64 }).notNull(),
  mode: varchar("mode", { length: 16 }).notNull().default("some"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [unique().on(t.storeId, t.permissionKey)]);

export const PERMISSION_KEYS = [
  "show_pins",
  "can_analyze",
  "can_edit_orders",
  "can_delete_orders",
  "can_print",
  "can_mark_delivered",
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];
export type PermissionMode = "none" | "some" | "all";
