import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { canManageMembers } from "@/server/auth/roles";
import type { Database } from "@/server/db/client";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus, type MemberRole } from "@/server/db/schema/constants";
import { feedbackItems } from "@/server/db/schema/feedback";
import { recordActivity } from "@/server/services/activity-log";
import { ServiceError } from "@/server/services/organizations";

const createSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
});

const statusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

function publicItem(row: typeof feedbackItems.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind as FeedbackKind,
    status: row.status as FeedbackStatus,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFeedback(db: Database, organizationId: string) {
  const rows = await db
    .select()
    .from(feedbackItems)
    .where(eq(feedbackItems.organizationId, organizationId))
    .orderBy(desc(feedbackItems.createdAt));
  return { items: rows.map(publicItem) };
}

export async function createFeedback(db: Database, actorUserId: string, organizationId: string, input: unknown) {
  const data = createSchema.parse(input);
  const [row] = await db
    .insert(feedbackItems)
    .values({
      organizationId,
      authorUserId: actorUserId,
      kind: data.kind,
      status: "open",
      title: data.title,
      body: data.body,
    })
    .returning();
  if (!row) {
    throw new ServiceError(500, "INTERNAL", "Could not save this note");
  }
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "feedback_item",
    entityId: row.id,
    action: "created",
    metadata: { kind: row.kind },
  });
  return { item: publicItem(row) };
}

export async function updateFeedbackStatus(
  db: Database,
  actor: { userId: string; role: MemberRole },
  organizationId: string,
  itemId: string,
  input: unknown,
) {
  if (!canManageMembers(actor.role)) {
    throw new ServiceError(403, "FORBIDDEN", "Only an owner or admin can triage notes");
  }
  const data = statusSchema.parse(input);
  const [row] = await db
    .update(feedbackItems)
    .set({ status: data.status, updatedAt: new Date() })
    .where(and(eq(feedbackItems.id, itemId), eq(feedbackItems.organizationId, organizationId)))
    .returning();
  if (!row) {
    throw new ServiceError(404, "NOT_FOUND", "Note not found");
  }
  await recordActivity(db, {
    organizationId,
    actorUserId: actor.userId,
    entityType: "feedback_item",
    entityId: row.id,
    action: "status_changed",
    metadata: { status: row.status },
  });
  return { item: publicItem(row) };
}
