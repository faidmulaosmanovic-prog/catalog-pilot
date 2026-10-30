import { sql } from "drizzle-orm";

import type { Database } from "./client";

export async function resetDatabase(db: Database) {
  await db.execute(sql`
    truncate table
      activity_logs,
      job_runs,
      import_rows,
      import_mappings,
      product_revisions,
      product_images,
      product_attributes,
      product_variants,
      products,
      imports,
      categories,
      organization_invites,
      organization_members,
      organizations,
      sessions,
      accounts,
      verifications,
      users
    restart identity cascade
  `);
}
