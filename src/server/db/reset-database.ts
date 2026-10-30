import { sql } from "drizzle-orm";

import type { Database } from "./client";

export async function resetDatabase(db: Database) {
  await db.execute(sql`
    truncate table
      activity_logs,
      job_runs,
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
