import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { appBaseUrl, hashToken, newToken, sendAuthEmail } from "@/server/auth/email";
import { canAssignRole, canManageMembers } from "@/server/auth/roles";
import type { Database } from "@/server/db/client";
import { postgresErrorCode } from "@/server/db/postgres-error";
import { MEMBER_ROLES, type MemberRole } from "@/server/db/schema/constants";
import {
  organizationInvites,
  organizationMembers,
  organizations,
  users,
} from "@/server/db/schema/identity";
import { recordActivity } from "@/server/services/activity-log";

export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code");

const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultCurrency: currencySchema.optional(),
});

const patchOrgSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    defaultCurrency: currencySchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.defaultCurrency !== undefined, {
    message: "Nothing to update",
  });

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
});

const roleSchema = z.object({
  role: z.enum(MEMBER_ROLES),
});

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "org";
}

function publicOrg(org: typeof organizations.$inferSelect) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    defaultCurrency: org.defaultCurrency.trim(),
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export async function getMembership(
  db: Database,
  userId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({
      memberId: organizationMembers.id,
      role: organizationMembers.role,
      organizationId: organizationMembers.organizationId,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    memberId: row.memberId,
    organizationId: row.organizationId,
    role: row.role as MemberRole,
  };
}

export async function listOrganizationsForUser(db: Database, userId: string) {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      defaultCurrency: organizations.defaultCurrency,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(
      and(eq(organizationMembers.userId, userId), isNull(organizations.deletedAt)),
    );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    defaultCurrency: row.defaultCurrency.trim(),
    role: row.role as MemberRole,
  }));
}

export async function createOrganization(
  db: Database,
  userId: string,
  input: unknown,
) {
  const data = createOrgSchema.parse(input);
  const currency = data.defaultCurrency ?? "USD";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const slug = `${slugify(data.name)}${suffix}`;
    try {
      return await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({
            name: data.name,
            slug,
            defaultCurrency: currency,
          })
          .returning();
        if (!org) {
          throw new ServiceError(500, "INTERNAL", "Could not create organization");
        }
        await tx.insert(organizationMembers).values({
          organizationId: org.id,
          userId,
          role: "owner",
        });
        await recordActivity(tx as unknown as Database, {
          organizationId: org.id,
          actorUserId: userId,
          entityType: "organization",
          entityId: org.id,
          action: "created",
        });
        const { attachStarterSubscription } = await import("@/server/services/billing");
        await attachStarterSubscription(tx as unknown as Database, org.id);
        return { ...publicOrg(org), role: "owner" as const };
      });
    } catch (error) {
      if (postgresErrorCode(error) === "23505") {
        continue;
      }
      throw error;
    }
  }

  throw new ServiceError(409, "CONFLICT", "Could not allocate a unique organization slug");
}

export async function getOrganizationForMember(
  db: Database,
  userId: string,
  organizationId: string,
) {
  const membership = await getMembership(db, userId, organizationId);
  if (!membership) {
    throw new ServiceError(404, "NOT_FOUND", "Organization not found");
  }
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)))
    .limit(1);
  if (!org) {
    throw new ServiceError(404, "NOT_FOUND", "Organization not found");
  }
  return { ...publicOrg(org), role: membership.role };
}

export async function updateOrganization(
  db: Database,
  actorUserId: string,
  organizationId: string,
  role: MemberRole,
  input: unknown,
) {
  if (!canManageMembers(role)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot update this organization");
  }
  const data = patchOrgSchema.parse(input);
  const [org] = await db
    .update(organizations)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.defaultCurrency !== undefined
        ? { defaultCurrency: data.defaultCurrency }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt)))
    .returning();
  if (!org) {
    throw new ServiceError(404, "NOT_FOUND", "Organization not found");
  }
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "organization",
    entityId: organizationId,
    action: "updated",
  });
  return publicOrg(org);
}

export async function listMembers(db: Database, organizationId: string) {
  const rows = await db
    .select({
      id: organizationMembers.id,
      role: organizationMembers.role,
      userId: users.id,
      email: users.email,
      name: users.name,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId));

  return rows.map((row) => ({
    id: row.id,
    role: row.role as MemberRole,
    userId: row.userId,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function ownerCount(db: Database, organizationId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner"),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function createInvite(
  db: Database,
  actor: { userId: string; role: MemberRole },
  organizationId: string,
  input: unknown,
) {
  if (!canManageMembers(actor.role)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot invite members");
  }
  const data = inviteSchema.parse(input);
  const email = data.email.toLowerCase();
  if (!canAssignRole(actor.role, data.role)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot assign that role");
  }
  const { assertCanInviteMember } = await import("@/server/services/billing");
  await assertCanInviteMember(db, organizationId);

  const [existingMember] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        sql`lower(${users.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (existingMember) {
    throw new ServiceError(409, "CONFLICT", "That person is already a member");
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [invite] = await db
    .insert(organizationInvites)
    .values({
      organizationId,
      email,
      role: data.role,
      tokenHash: hashToken(token),
      expiresAt,
      createdBy: actor.userId,
    })
    .returning();
  if (!invite) {
    throw new ServiceError(500, "INTERNAL", "Could not create invite");
  }

  const url = new URL(`/invites/${token}`, appBaseUrl());
  await sendAuthEmail({
    to: email,
    kind: "invite",
    url: url.toString(),
    subject: "You were invited to a CatalogPilot organization",
  });
  await recordActivity(db, {
    organizationId,
    actorUserId: actor.userId,
    entityType: "organization_invite",
    entityId: invite.id,
    action: "created",
    metadata: { email, role: data.role },
  });

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role as MemberRole,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export async function acceptInvite(db: Database, userId: string, token: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new ServiceError(401, "UNAUTHENTICATED", "Sign in required");
  }

  const tokenHash = hashToken(token);
  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.tokenHash, tokenHash))
    .limit(1);
  if (!invite) {
    throw new ServiceError(404, "NOT_FOUND", "Invite not found");
  }
  if (invite.acceptedAt) {
    throw new ServiceError(409, "CONFLICT", "Invite already accepted");
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new ServiceError(400, "BAD_REQUEST", "Invite has expired");
  }
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new ServiceError(403, "FORBIDDEN", "This invite was sent to a different email");
  }

  const existing = await getMembership(db, userId, invite.organizationId);
  if (existing) {
    throw new ServiceError(409, "CONFLICT", "You are already a member");
  }

  await db.transaction(async (tx) => {
    await tx.insert(organizationMembers).values({
      organizationId: invite.organizationId,
      userId,
      role: invite.role,
    });
    await tx
      .update(organizationInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvites.id, invite.id));
    await recordActivity(tx as unknown as Database, {
      organizationId: invite.organizationId,
      actorUserId: userId,
      entityType: "organization_invite",
      entityId: invite.id,
      action: "accepted",
    });
  });

  return getOrganizationForMember(db, userId, invite.organizationId);
}

export async function updateMemberRole(
  db: Database,
  actor: { userId: string; role: MemberRole },
  organizationId: string,
  memberId: string,
  input: unknown,
) {
  if (!canManageMembers(actor.role)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot change roles");
  }
  const data = roleSchema.parse(input);
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!member) {
    throw new ServiceError(404, "NOT_FOUND", "Member not found");
  }
  const currentRole = member.role as MemberRole;
  if (!canAssignRole(actor.role, currentRole) || !canAssignRole(actor.role, data.role)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot assign that role");
  }
  if (currentRole === "owner" && data.role !== "owner") {
    const owners = await ownerCount(db, organizationId);
    if (owners <= 1) {
      throw new ServiceError(409, "CONFLICT", "Cannot demote the last owner");
    }
  }
  const [updated] = await db
    .update(organizationMembers)
    .set({ role: data.role })
    .where(eq(organizationMembers.id, memberId))
    .returning();
  if (!updated) {
    throw new ServiceError(404, "NOT_FOUND", "Member not found");
  }
  await recordActivity(db, {
    organizationId,
    actorUserId: actor.userId,
    entityType: "organization_member",
    entityId: memberId,
    action: "role_changed",
    metadata: { role: data.role },
  });
  return { id: updated.id, role: updated.role as MemberRole, userId: updated.userId };
}

export async function removeMember(
  db: Database,
  actor: { userId: string; role: MemberRole },
  organizationId: string,
  memberId: string,
) {
  if (!canManageMembers(actor.role)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot remove members");
  }
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!member) {
    throw new ServiceError(404, "NOT_FOUND", "Member not found");
  }
  const currentRole = member.role as MemberRole;
  if (!canAssignRole(actor.role, currentRole)) {
    throw new ServiceError(403, "FORBIDDEN", "You cannot remove that member");
  }
  if (currentRole === "owner" && (await ownerCount(db, organizationId)) <= 1) {
    throw new ServiceError(409, "CONFLICT", "Cannot remove the last owner");
  }
  await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
  await recordActivity(db, {
    organizationId,
    actorUserId: actor.userId,
    entityType: "organization_member",
    entityId: memberId,
    action: "removed",
  });
}

export async function listPendingInvites(db: Database, organizationId: string) {
  const rows = await db
    .select({
      id: organizationInvites.id,
      email: organizationInvites.email,
      role: organizationInvites.role,
      expiresAt: organizationInvites.expiresAt,
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, organizationId),
        isNull(organizationInvites.acceptedAt),
        gt(organizationInvites.expiresAt, new Date()),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as MemberRole,
    expiresAt: row.expiresAt.toISOString(),
  }));
}
