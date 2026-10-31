import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { valueIn } from "./checks";
import { products } from "./catalog";
import { CHANNEL_TYPES, EXPORT_JOB_STATUSES, LISTING_STATUSES } from "./constants";
import { organizations, users } from "./identity";
import type { TemplateSchema } from "@/server/exports/templates";

/**
 * DB-7 channels and export. Marketplace columns stay off products.
 * Templates are versioned JSON; adapters interpret them.
 */

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    unique("channels_code_unique").on(table.code),
    check("channels_type_check", valueIn(table.type, CHANNEL_TYPES)),
  ],
);

export const marketplaceTemplates = pgTable(
  "marketplace_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    name: text("name").notNull(),
    mappingSchema: jsonb("mapping_schema").$type<TemplateSchema>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("marketplace_templates_channel_version_unique").on(table.channelId, table.version)],
);

export const channelListings = pgTable(
  "channel_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    status: text("status").notNull().default("ready"),
    lastExportedAt: timestamp("last_exported_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
  },
  (table) => [
    unique("channel_listings_product_channel_unique").on(table.productId, table.channelId),
    index("channel_listings_org_channel_idx").on(table.organizationId, table.channelId),
    check("channel_listings_status_check", valueIn(table.status, LISTING_STATUSES)),
  ],
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => marketplaceTemplates.id, { onDelete: "set null" }),
    status: text("status").notNull().default("queued"),
    productCount: integer("product_count"),
    fileR2Key: text("file_r2_key"),
    errorReportJson: jsonb("error_report_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("export_jobs_org_created_idx").on(table.organizationId, table.createdAt.desc()),
    check("export_jobs_status_check", valueIn(table.status, EXPORT_JOB_STATUSES)),
  ],
);
