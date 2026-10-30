import {
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
import { JOB_RUN_STATUSES } from "./constants";
import { organizations, users } from "./identity";

/**
 * DB-2 audit and job primitives.
 * Activity rows and job status are always scoped by organization_id.
 */

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activity_logs_org_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    index("activity_logs_org_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
    ),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status").notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown> | null>(),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("job_runs_org_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    check("job_runs_status_check", valueIn(table.status, JOB_RUN_STATUSES)),
  ],
);
