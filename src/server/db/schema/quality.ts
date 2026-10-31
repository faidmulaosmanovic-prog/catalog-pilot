import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { valueIn } from "./checks";
import { products } from "./catalog";
import {
  ISSUE_STATUSES,
  SEVERITIES,
  VALIDATION_RUN_STATUSES,
  VALIDATION_SCOPES,
} from "./constants";
import { organizations, users } from "./identity";

/**
 * DB-5 data quality. System rules use a null organization_id.
 * Org overrides are separate rows so the seeded defaults stay intact.
 */

export const validationRules = pgTable(
  "validation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    severity: text("severity").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    configJson: jsonb("config_json")
      .$type<{ minSeverity?: string; maxSeverity?: string }>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("validation_rules_system_code_unique")
      .on(table.code)
      .where(sql`${table.organizationId} is null`),
    uniqueIndex("validation_rules_org_code_unique")
      .on(table.organizationId, table.code)
      .where(sql`${table.organizationId} is not null`),
    check("validation_rules_severity_check", valueIn(table.severity, SEVERITIES)),
  ],
);

export const validationRuns = pgTable(
  "validation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    scope: text("scope").notNull(),
    productCount: integer("product_count"),
    issueCount: integer("issue_count"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("validation_runs_status_check", valueIn(table.status, VALIDATION_RUN_STATUSES)),
    check("validation_runs_scope_check", valueIn(table.scope, VALIDATION_SCOPES)),
  ],
);

export const validationIssues = pgTable(
  "validation_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ruleCode: text("rule_code").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    field: text("field"),
    status: text("status").notNull().default("open"),
    runId: uuid("run_id").references(() => validationRuns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("validation_issues_org_status_severity_idx").on(
      table.organizationId,
      table.status,
      table.severity,
    ),
    index("validation_issues_org_product_idx").on(table.organizationId, table.productId),
    index("validation_issues_org_rule_code_idx").on(table.organizationId, table.ruleCode),
    check("validation_issues_severity_check", valueIn(table.severity, SEVERITIES)),
    check("validation_issues_status_check", valueIn(table.status, ISSUE_STATUSES)),
  ],
);
