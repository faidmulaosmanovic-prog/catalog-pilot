import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/server/db/client";
import { activityLogs } from "@/server/db/schema/audit";

const recordActivitySchema = z.object({
  organizationId: z.uuid(),
  actorUserId: z.uuid().nullable().optional(),
  entityType: z.string().trim().min(1).max(100),
  entityId: z.uuid().nullable().optional(),
  action: z.string().trim().min(1).max(100),
  metadata: z.record(z.string(), z.json()).nullable().optional(),
});

const listActivitySchema = z.object({
  organizationId: z.uuid(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type RecordActivityInput = z.input<typeof recordActivitySchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export async function recordActivity(
  db: Database,
  input: RecordActivityInput,
): Promise<ActivityLog> {
  const data = recordActivitySchema.parse(input);
  const [row] = await db
    .insert(activityLogs)
    .values({
      organizationId: data.organizationId,
      actorUserId: data.actorUserId ?? null,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      action: data.action,
      metadataJson: data.metadata ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert activity log");
  }

  return row;
}

export async function listActivityLogs(
  db: Database,
  input: z.input<typeof listActivitySchema>,
): Promise<ActivityLog[]> {
  const data = listActivitySchema.parse(input);
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.organizationId, data.organizationId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(data.limit);
}

export async function listActivityForEntity(
  db: Database,
  input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    limit?: number;
  },
): Promise<ActivityLog[]> {
  const data = z
    .object({
      organizationId: z.uuid(),
      entityType: z.string().trim().min(1).max(100),
      entityId: z.uuid(),
      limit: z.number().int().min(1).max(100).default(50),
    })
    .parse(input);

  return db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.organizationId, data.organizationId),
        eq(activityLogs.entityType, data.entityType),
        eq(activityLogs.entityId, data.entityId),
      ),
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(data.limit);
}
