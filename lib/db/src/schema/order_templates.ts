import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

export const orderTemplatesTable = pgTable("order_templates", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => storesTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  fields: jsonb("fields").notNull().$type<{
    key: string;
    label: string;
    required: boolean;
    visible: boolean;
  }[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OrderTemplate = typeof orderTemplatesTable.$inferSelect;
