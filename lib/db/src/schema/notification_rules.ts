import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { storesTable } from "./stores";
import { serviceTypesTable } from "./service_types";

export const notificationRulesTable = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  serviceTypeId: integer("service_type_id").notNull().references(() => serviceTypesTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type NotificationRule = typeof notificationRulesTable.$inferSelect;
