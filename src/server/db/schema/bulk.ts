import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { valueIn } from "./checks";
import { BULK_JOB_STATUSES, BULK_OPERATIONS } from "./constants";
import { products } from "./catalog";
import { organizations, users } from "./identity";

/**
 * DB-6 bulk editor. Each applied product keeps a before/after snapshot so the job can be undone.
 */

export const bulkEditJobs = pgTable(
  "bulk_edit_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    operation: text("operation").notNull(),
    operationConfig: jsonb("operation_config").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("queued"),
    productCount: integer("product_count"),
    previewJson: jsonb("preview_json").$type<Record<string, unknown>>(),
    canRollback: boolean("can_rollback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("bulk_edit_jobs_org_created_idx").on(table.organizationId, table.createdAt.desc()),
    check("bulk_edit_jobs_operation_check", valueIn(table.operation, BULK_OPERATIONS)),
    check("bulk_edit_jobs_status_check", valueIn(table.status, BULK_JOB_STATUSES)),
  ],
);

export const bulkEditChanges = pgTable(
  "bulk_edit_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bulkEditJobId: uuid("bulk_edit_job_id")
      .notNull()
      .references(() => bulkEditJobs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    beforeJson: jsonb("before_json").$type<Record<string, unknown>>().notNull(),
    afterJson: jsonb("after_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bulk_edit_changes_job_idx").on(table.bulkEditJobId),
    index("bulk_edit_changes_org_product_idx").on(table.organizationId, table.productId),
  ],
);
