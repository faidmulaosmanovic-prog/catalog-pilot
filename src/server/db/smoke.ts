import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { createDb, createPostgresClient } from "./client";

config({ path: ".env.local" });
config();

async function main() {
  const client = createPostgresClient();
  const db = createDb(client);

  const result = await db.execute(sql`select 1 as ok`);
  const row = result[0] as { ok: number } | undefined;

  if (!row || Number(row.ok) !== 1) {
    throw new Error("Smoke query failed: expected select 1");
  }

  console.log("DB smoke OK: select 1");
  await client.end({ timeout: 5 });
}

main().catch((error) => {
  console.error("DB smoke failed:", error);
  process.exit(1);
});
