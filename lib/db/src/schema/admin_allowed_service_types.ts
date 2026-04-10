import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { unique } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { serviceTypesTable } from "./service_types";

export const adminAllowedServiceTypesTable = pgTable("admin_allowed_service_types", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  serviceTypeId: integer("service_type_id").notNull().references(() => serviceTypesTable.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.accountId, t.serviceTypeId)]);

export type AdminAllowedServiceType = typeof adminAllowedServiceTypesTable.$inferSelect;
