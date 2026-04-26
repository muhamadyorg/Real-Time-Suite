import { pgTable, serial, integer, numeric, timestamp, text, pgEnum } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { storesTable } from "./stores";
import { accountsTable } from "./accounts";
import { serviceTypesTable } from "./service_types";
import { ordersTable } from "./orders";

export const transactionTypeEnum = pgEnum("transaction_type", ["naqd", "qarz", "tolov", "tuzatish", "click", "dokonga"]);

export const clientAccountsTable = pgTable("client_accounts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clientTransactionsTable = pgTable("client_transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => storesTable.id, { onDelete: "cascade" }),
  serviceTypeId: integer("service_type_id").references(() => serviceTypesTable.id),
  serviceTypeName: text("service_type_name"),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  orderCode: text("order_code"),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 14, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
  note: text("note"),
  performedById: integer("performed_by_id").references(() => accountsTable.id, { onDelete: "set null" }),
  performedByName: text("performed_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ClientAccount = typeof clientAccountsTable.$inferSelect;
export type ClientTransaction = typeof clientTransactionsTable.$inferSelect;
