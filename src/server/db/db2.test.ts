import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { recordActivity, listActivityLogs } from "@/server/services/activity-log";
import {
  createJobRun,
  getJobRun,
  JobRunNotFoundError,
  updateJobRunStatus,
} from "@/server/services/job-runs";

import { createDb, createPostgresClient } from "./client";
import { postgresErrorCode } from "./postgres-error";
import { resetDatabase } from "./reset-database";
import { JOB_RUN_STATUSES } from "./schema/constants";
import { organizationMembers, organizations, users } from "./schema/identity";
import { jobRuns } from "./schema/audit";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)("DB-1 tenancy and DB-2 audit", () => {
  const client = createPostgresClient();
  const db = createDb(client);

  beforeAll(async () => {
    await db.execute(sql`select 1`);
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  async function seedUser(email: string) {
    const [user] = await db
      .insert(users)
      .values({ email, name: email })
      .returning();
    if (!user) throw new Error("user insert failed");
    return user;
  }

  async function seedOrg(slug: string) {
    const [org] = await db
      .insert(organizations)
      .values({ name: slug, slug })
      .returning();
    if (!org) throw new Error("org insert failed");
    return org;
  }

  it("rejects a member without a real organization and user", async () => {
    const error = await db
      .insert(organizationMembers)
      .values({
        organizationId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        role: "owner",
      })
      .catch((caught: unknown) => caught);

    expect(postgresErrorCode(error)).toBe("23503");
  });

  it("rejects a duplicate membership and a role outside the allowed set", async () => {
    const user = await seedUser("owner@example.com");
    const org = await seedOrg("acme");

    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: "owner",
    });

    const duplicate = await db
      .insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: user.id,
        role: "admin",
      })
      .catch((caught: unknown) => caught);
    expect(postgresErrorCode(duplicate)).toBe("23505");

    const badRole = await db
      .insert(organizationMembers)
      .values({
        organizationId: org.id,
        userId: (await seedUser("editor@example.com")).id,
        role: "superadmin",
      })
      .catch((caught: unknown) => caught);
    expect(postgresErrorCode(badRole)).toBe("23514");
  });

  it("keeps membership isolated between two organizations", async () => {
    const userA = await seedUser("a@example.com");
    const userB = await seedUser("b@example.com");
    const orgA = await seedOrg("org-a");
    const orgB = await seedOrg("org-b");

    await db.insert(organizationMembers).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner" },
      { organizationId: orgB.id, userId: userB.id, role: "editor" },
    ]);

    const membersA = await db
      .select()
      .from(organizationMembers)
      .where(sql`${organizationMembers.organizationId} = ${orgA.id}`);

    expect(membersA).toHaveLength(1);
    expect(membersA[0]?.userId).toBe(userA.id);
    expect(membersA[0]?.role).toBe("owner");
  });

  it("stores invite secrets as token_hash only", async () => {
    const rows = await db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_invites'
    `);
    const names = rows.map((row) => row.column_name);
    expect(names).toContain("token_hash");
    expect(names).not.toContain("token");
  });

  it("writes activity logs scoped to one organization", async () => {
    const user = await seedUser("actor@example.com");
    const orgA = await seedOrg("audit-a");
    const orgB = await seedOrg("audit-b");

    await recordActivity(db, {
      organizationId: orgA.id,
      actorUserId: user.id,
      entityType: "product",
      entityId: "33333333-3333-4333-8333-333333333333",
      action: "created",
      metadata: { sku: "SKU-1" },
    });
    await recordActivity(db, {
      organizationId: orgB.id,
      entityType: "product",
      action: "created",
    });

    const logsA = await listActivityLogs(db, { organizationId: orgA.id });
    expect(logsA).toHaveLength(1);
    expect(logsA[0]?.organizationId).toBe(orgA.id);
    expect(logsA[0]?.actorUserId).toBe(user.id);
    expect(logsA[0]?.metadataJson).toEqual({ sku: "SKU-1" });

    const missingOrg = await recordActivity(db, {
      organizationId: "44444444-4444-4444-8444-444444444444",
      entityType: "product",
      action: "created",
    }).catch((caught: unknown) => caught);
    expect(postgresErrorCode(missingOrg)).toBe("23503");
  });

  it("clears actor_user_id when the actor user is deleted", async () => {
    const user = await seedUser("temporary@example.com");
    const org = await seedOrg("audit-delete");
    const log = await recordActivity(db, {
      organizationId: org.id,
      actorUserId: user.id,
      entityType: "organization",
      entityId: org.id,
      action: "member_added",
    });

    await db.delete(users).where(sql`${users.id} = ${user.id}`);

    const logs = await listActivityLogs(db, { organizationId: org.id });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.id).toBe(log.id);
    expect(logs[0]?.actorUserId).toBeNull();
  });

  it("stores each queue status and rejects anything else", async () => {
    const org = await seedOrg("jobs");

    for (const status of JOB_RUN_STATUSES) {
      const job = await createJobRun(db, {
        organizationId: org.id,
        type: "import",
        status,
      });
      expect(job.status).toBe(status);
    }

    const invalid = await db
      .insert(jobRuns)
      .values({
        organizationId: org.id,
        type: "import",
        status: "cancelled",
      })
      .catch((caught: unknown) => caught);
    expect(postgresErrorCode(invalid)).toBe("23514");
  });

  it("does not update a job run from another organization", async () => {
    const orgA = await seedOrg("jobs-a");
    const orgB = await seedOrg("jobs-b");
    const job = await createJobRun(db, {
      organizationId: orgA.id,
      type: "export",
      payload: { channel: "shopify" },
    });

    await expect(
      updateJobRunStatus(db, {
        id: job.id,
        organizationId: orgB.id,
        status: "failed",
        errorMessage: "nope",
      }),
    ).rejects.toBeInstanceOf(JobRunNotFoundError);

    const unchanged = await getJobRun(db, {
      id: job.id,
      organizationId: orgA.id,
    });
    expect(unchanged?.status).toBe("queued");
    expect(unchanged?.errorMessage).toBeNull();

    const updated = await updateJobRunStatus(db, {
      id: job.id,
      organizationId: orgA.id,
      status: "processing",
      attempts: 1,
    });
    expect(updated.status).toBe("processing");
    expect(updated.attempts).toBe(1);

    const hidden = await getJobRun(db, {
      id: job.id,
      organizationId: orgB.id,
    });
    expect(hidden).toBeNull();
  });
});
