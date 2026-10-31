import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { valueIn } from "./checks";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from "./constants";
import { organizations, users } from "./identity";

/**
 * Phase 10 launch notes. One organization sees only its own feedback and bugs.
 */

export const feedbackItems = pgTable(
  "feedback_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("open"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_items_org_created_idx").on(table.organizationId, table.createdAt.desc()),
    check("feedback_items_kind_check", valueIn(table.kind, FEEDBACK_KINDS)),
    check("feedback_items_status_check", valueIn(table.status, FEEDBACK_STATUSES)),
  ],
);
