import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Node-oriented Postgres client (postgres.js).
 *
 * Workers / OpenNext: prefer Neon serverless driver or Cloudflare Hyperdrive
 * with a Workers-compatible client. See docs/architecture/adr/0001-hosting.md
 * (created during Phase 0 hosting spike).
 */

const globalForDb = globalThis as unknown as {
  postgresClient: ReturnType<typeof postgres> | undefined;
};

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function createPostgresClient(url = requireDatabaseUrl()) {
  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function createDb(client: ReturnType<typeof postgres> = getPostgresClient()) {
  return drizzle(client, { schema });
}

export function getPostgresClient() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = createPostgresClient();
  }
  return globalForDb.postgresClient;
}

/** Lazy singleton for app server usage. */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    const instance = createDb();
    return Reflect.get(instance, prop, receiver);
  },
});

export type Database = ReturnType<typeof createDb>;
