import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createDb, createPostgresClient } from "./client";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)("DB-0 foundation", () => {
  const client = createPostgresClient();
  const db = createDb(client);

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  it("connects and runs select 1", async () => {
    const rows = await db.execute(sql`select 1::int as ok`);
    expect(Number((rows[0] as { ok: number }).ok)).toBe(1);
  });

  it("has pgcrypto extension after migrate", async () => {
    const rows = await db.execute(sql`
      select extname
      from pg_extension
      where extname = 'pgcrypto'
    `);
    expect(rows.length).toBe(1);
  });
});
