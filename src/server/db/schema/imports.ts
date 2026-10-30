import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { valueIn } from "./checks";
import { IMPORT_MODES, IMPORT_STATUSES } from "./constants";
import { organizations, users } from "./identity";

/**
 * DB-4 import header and column map.
 * `import_rows` lives in catalog.ts because it references both imports and products.
 */

export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    fileName: text("file_name").notNull(),
    fileR2Key: text("file_r2_key").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    fileContentHash: text("file_content_hash"),
    status: text("status").notNull().default("uploaded"),
    encoding: text("encoding"),
    delimiter: text("delimiter"),
    headerRow: integer("header_row").notNull().default(1),
    mode: text("mode").notNull().default("create"),
    totalRows: integer("total_rows"),
    successRows: integer("success_rows"),
    failedRows: integer("failed_rows"),
    errorR2Key: text("error_r2_key"),
    idempotencyKey: text("idempotency_key"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("imports_org_created_at_idx").on(table.organizationId, table.createdAt.desc()),
    index("imports_org_file_content_hash_idx").on(table.organizationId, table.fileContentHash),
    uniqueIndex("imports_org_idempotency_key_unique")
      .on(table.organizationId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check("imports_status_check", valueIn(table.status, IMPORT_STATUSES)),
    check("imports_mode_check", valueIn(table.mode, IMPORT_MODES)),
  ],
);

export const importMappings = pgTable(
  "import_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceColumn: text("source_column").notNull(),
    targetField: text("target_field").notNull(),
    transform: text("transform"),
  },
  (table) => [
    uniqueIndex("import_mappings_import_source_unique").on(table.importId, table.sourceColumn),
  ],
);
