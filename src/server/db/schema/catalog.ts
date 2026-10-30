import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { valueIn } from "./checks";
import {
  BARCODE_TYPES,
  IMAGE_STATUSES,
  IMPORT_ROW_STATUSES,
  PRODUCT_STATUSES,
} from "./constants";
import { organizations, users } from "./identity";
import { imports } from "./imports";

/**
 * DB-3 catalog core.
 * `source_import_id` references imports (DB-4).
 */

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  };
}

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    path: text("path"),
    ...timestamps(),
  },
  (table) => [
    index("categories_org_name_idx").on(table.organizationId, table.name),
    index("categories_org_parent_idx").on(table.organizationId, table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "categories_parent_id_categories_id_fk",
    }).onDelete("set null"),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    title: text("title"),
    description: text("description"),
    brand: text("brand"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    quantity: integer("quantity"),
    status: text("status").notNull().default("draft"),
    barcode: text("barcode"),
    barcodeType: text("barcode_type"),
    qualityScore: integer("quality_score"),
    attributesJson: jsonb("attributes_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    sourceImportId: uuid("source_import_id").references(() => imports.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("products_org_sku_active_unique")
      .on(table.organizationId, table.sku)
      .where(sql`${table.deletedAt} is null`),
    index("products_org_updated_at_idx").on(
      table.organizationId,
      table.updatedAt.desc(),
    ),
    index("products_org_status_idx").on(table.organizationId, table.status),
    index("products_org_brand_idx").on(table.organizationId, table.brand),
    index("products_org_barcode_idx")
      .on(table.organizationId, table.barcode)
      .where(sql`${table.barcode} is not null`),
    check("products_status_check", valueIn(table.status, PRODUCT_STATUSES)),
    check(
      "products_barcode_type_check",
      sql`${table.barcodeType} is null or ${valueIn(table.barcodeType, BARCODE_TYPES)}`,
    ),
    check(
      "products_quality_score_check",
      sql`${table.qualityScore} is null or (${table.qualityScore} >= 0 and ${table.qualityScore} <= 100)`,
    ),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    option1Name: text("option1_name"),
    option1Value: text("option1_value"),
    option2Name: text("option2_name"),
    option2Value: text("option2_value"),
    option3Name: text("option3_name"),
    option3Value: text("option3_value"),
    price: numeric("price", { precision: 12, scale: 2 }),
    quantity: integer("quantity"),
    barcode: text("barcode"),
    status: text("status").notNull().default("active"),
    ...timestamps(),
  },
  (table) => [
    unique("product_variants_org_sku_unique").on(table.organizationId, table.sku),
    index("product_variants_org_product_idx").on(table.organizationId, table.productId),
    check("product_variants_status_check", valueIn(table.status, PRODUCT_STATUSES)),
  ],
);

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    valueText: text("value_text"),
    valueNumber: numeric("value_number"),
    valueBool: boolean("value_bool"),
    unit: text("unit"),
  },
  (table) => [
    unique("product_attributes_product_key_unique").on(table.productId, table.key),
    index("product_attributes_org_key_value_idx").on(
      table.organizationId,
      table.key,
      table.valueText,
    ),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
    contentHash: text("content_hash"),
    r2Key: text("r2_key"),
    status: text("status"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("product_images_org_product_position_idx").on(
      table.organizationId,
      table.productId,
      table.position,
    ),
    index("product_images_org_content_hash_idx")
      .on(table.organizationId, table.contentHash)
      .where(sql`${table.contentHash} is not null`),
    check(
      "product_images_status_check",
      sql`${table.status} is null or ${valueIn(table.status, IMAGE_STATUSES)}`,
    ),
  ],
);

export const productRevisions = pgTable(
  "product_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>().notNull(),
    changeSource: text("change_source"),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("product_revisions_product_revision_unique").on(
      table.productId,
      table.revision,
    ),
  ],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>(),
    status: text("status"),
    errorMessage: text("error_message"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  },
  (table) => [
    index("import_rows_import_status_idx").on(table.importId, table.status),
    index("import_rows_import_row_number_idx").on(table.importId, table.rowNumber),
    check(
      "import_rows_status_check",
      sql`${table.status} is null or ${valueIn(table.status, IMPORT_ROW_STATUSES)}`,
    ),
  ],
);
