import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/server/db/client";
import { JOB_RUN_STATUSES, type JobRunStatus } from "@/server/db/schema/constants";
import { jobRuns } from "@/server/db/schema/audit";

const createJobRunSchema = z.object({
  organizationId: z.uuid(),
  type: z.string().trim().min(1).max(100),
  status: z.enum(JOB_RUN_STATUSES).default("queued"),
  payload: z.record(z.string(), z.json()).nullable().optional(),
});

const updateJobRunStatusSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  status: z.enum(JOB_RUN_STATUSES),
  errorMessage: z.string().max(4000).nullable().optional(),
  attempts: z.number().int().min(0).optional(),
});

export class JobRunNotFoundError extends Error {
  constructor() {
    super("Job run not found");
    this.name = "JobRunNotFoundError";
  }
}

export type JobRun = typeof jobRuns.$inferSelect;
export type { JobRunStatus };

export async function createJobRun(
  db: Database,
  input: z.input<typeof createJobRunSchema>,
): Promise<JobRun> {
  const data = createJobRunSchema.parse(input);
  const [row] = await db
    .insert(jobRuns)
    .values({
      organizationId: data.organizationId,
      type: data.type,
      status: data.status,
      payloadJson: data.payload ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert job run");
  }

  return row;
}

export async function updateJobRunStatus(
  db: Database,
  input: z.input<typeof updateJobRunStatusSchema>,
): Promise<JobRun> {
  const data = updateJobRunStatusSchema.parse(input);
  const [row] = await db
    .update(jobRuns)
    .set({
      status: data.status,
      updatedAt: new Date(),
      ...(data.errorMessage !== undefined
        ? { errorMessage: data.errorMessage }
        : {}),
      ...(data.attempts !== undefined ? { attempts: data.attempts } : {}),
    })
    .where(
      and(eq(jobRuns.id, data.id), eq(jobRuns.organizationId, data.organizationId)),
    )
    .returning();

  if (!row) {
    throw new JobRunNotFoundError();
  }

  return row;
}

export async function getJobRun(
  db: Database,
  input: { id: string; organizationId: string },
): Promise<JobRun | null> {
  const data = z
    .object({
      id: z.uuid(),
      organizationId: z.uuid(),
    })
    .parse(input);

  const [row] = await db
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.id, data.id), eq(jobRuns.organizationId, data.organizationId)))
    .limit(1);

  return row ?? null;
}
