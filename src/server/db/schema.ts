import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const importRulesTable = pgTable("import_rules", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  documentKind: varchar("document_kind", { length: 20 }).notNull(),
  definitionJson: jsonb("definition_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const importBatchesTable = pgTable("import_batches", {
  id: uuid("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  ruleId: uuid("rule_id"),
  status: varchar("status", { length: 20 }).notNull(),
  summaryJson: jsonb("summary_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const shipmentsTable = pgTable("shipments", {
  id: uuid("id").primaryKey(),
  externalCode: varchar("external_code", { length: 120 }),
  storeName: varchar("store_name", { length: 200 }),
  recipientName: varchar("recipient_name", { length: 120 }),
  recipientPhone: varchar("recipient_phone", { length: 30 }),
  recipientAddress: text("recipient_address"),
  remark: text("remark"),
  itemCount: integer("item_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const shipmentItemsTable = pgTable("shipment_items", {
  id: uuid("id").primaryKey(),
  shipmentId: uuid("shipment_id").notNull(),
  skuCode: varchar("sku_code", { length: 120 }).notNull(),
  skuName: varchar("sku_name", { length: 255 }).notNull(),
  skuSpec: varchar("sku_spec", { length: 255 }),
  quantity: integer("quantity").notNull(),
});
