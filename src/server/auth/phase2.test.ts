import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as acceptInvite } from "@/app/api/v1/invites/[token]/accept/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as confirmReset } from "@/app/api/v1/auth/password-reset/confirm/route";
import { POST as requestReset } from "@/app/api/v1/auth/password-reset/request/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { PATCH as patchOrg } from "@/app/api/v1/organizations/[orgId]/route";
import { POST as invite } from "@/app/api/v1/organizations/[orgId]/invites/route";
import { GET as listMembersRoute } from "@/app/api/v1/organizations/[orgId]/members/route";
import { PATCH as patchMember } from "@/app/api/v1/organizations/[orgId]/members/[memberId]/route";
import { GET as getOrg } from "@/app/api/v1/organizations/[orgId]/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { users } from "@/server/db/schema/identity";
import { resetRateLimits } from "@/server/http/rate-limit";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3000";

function jsonRequest(
  path: string,
  body: unknown,
  options?: { cookie?: string; orgId?: string; method?: string },
) {
  const headers = new Headers({
    origin,
    "content-type": "application/json",
  });
  if (options?.cookie) {
    headers.set("cookie", options.cookie);
  }
  if (options?.orgId) {
    headers.set("x-organization-id", options.orgId);
  }
  const method = options?.method ?? "POST";
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function tokenFrom(kind: "verify" | "reset" | "invite") {
  const email = [...listAuthEmails()].reverse().find((item) => item.kind === kind);
  if (!email) {
    throw new Error(`missing ${kind} email`);
  }
  if (kind === "invite") {
    return email.url.split("/invites/")[1] ?? "";
  }
  return new URL(email.url).searchParams.get("token") ?? "";
}

describe.skipIf(!hasDatabaseUrl)("Phase 2 auth and organizations", () => {
  const client = createPostgresClient();
  const db = createDb(client);

  beforeAll(async () => {
    await resetDatabase(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    clearAuthEmails();
    resetRateLimits();
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  async function registerUser(email: string, name: string) {
    const response = await register(
      jsonRequest("/api/v1/auth/register", {
        email,
        name,
        password: "Correct-horse-1",
      }),
    );
    expect(response.status).toBe(201);
    const token = tokenFrom("verify");
    const verified = await verifyEmail(
      jsonRequest("/api/v1/auth/verify-email", { token }),
    );
    expect(verified.status).toBe(204);
    const signedIn = await login(
      jsonRequest("/api/v1/auth/login", {
        email,
        password: "Correct-horse-1",
      }),
    );
    expect(signedIn.status).toBe(200);
    return sessionCookie(signedIn);
  }

  it("registers once, verifies, and rejects a second signup without a second user", async () => {
    const first = await register(
      jsonRequest("/api/v1/auth/register", {
        email: "ada@example.com",
        name: "Ada",
        password: "Correct-horse-1",
      }),
    );
    expect(first.status).toBe(201);
    const body = (await first.json()) as { message: string };
    expect(body.message).toMatch(/check your email/i);

    const unverified = await login(
      jsonRequest("/api/v1/auth/login", {
        email: "ada@example.com",
        password: "Correct-horse-1",
      }),
    );
    expect(unverified.status).toBe(403);

    const token = tokenFrom("verify");
    expect(await verifyEmail(jsonRequest("/api/v1/auth/verify-email", { token })).then((r) => r.status)).toBe(204);

    const duplicate = await register(
      jsonRequest("/api/v1/auth/register", {
        email: "ada@example.com",
        name: "Ada",
        password: "Correct-horse-1",
      }),
    );
    expect(duplicate.status).toBe(201);
    const rows = await db.select().from(users).where(eq(users.email, "ada@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.emailVerified).toBe(true);
  });

  it("resets a password with a single-use email token", async () => {
    await registerUser("reset@example.com", "Reset");
    const requested = await requestReset(
      jsonRequest("/api/v1/auth/password-reset/request", {
        email: "reset@example.com",
      }),
    );
    expect(requested.status).toBe(202);
    const missing = await requestReset(
      jsonRequest("/api/v1/auth/password-reset/request", {
        email: "nobody@example.com",
      }),
    );
    expect(missing.status).toBe(202);

    const token = tokenFrom("reset");
    const confirmed = await confirmReset(
      jsonRequest("/api/v1/auth/password-reset/confirm", {
        token,
        password: "Correct-horse-2",
      }),
    );
    expect(confirmed.status).toBe(204);

    const oldPassword = await login(
      jsonRequest("/api/v1/auth/login", {
        email: "reset@example.com",
        password: "Correct-horse-1",
      }),
    );
    expect(oldPassword.status).toBe(401);
    const nextPassword = await login(
      jsonRequest("/api/v1/auth/login", {
        email: "reset@example.com",
        password: "Correct-horse-2",
      }),
    );
    expect(nextPassword.status).toBe(200);
  });

  it("isolates organizations and enforces roles", async () => {
    const ownerCookie = await registerUser("owner@example.com", "Owner");
    const created = await createOrg(
      jsonRequest("/api/v1/organizations", { name: "Acme", defaultCurrency: "USD" }, {
        cookie: ownerCookie,
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { organization: { id: string; role: string } };
    expect(createdBody.organization.role).toBe("owner");
    const orgId = createdBody.organization.id;
    const ownerSession = [ownerCookie, sessionCookie(created)].filter(Boolean).join("; ");

    const otherCookie = await registerUser("other@example.com", "Other");
    const otherOrg = await createOrg(
      jsonRequest("/api/v1/organizations", { name: "Other Co" }, { cookie: otherCookie }),
    );
    const otherBody = (await otherOrg.json()) as { organization: { id: string } };
    const hidden = await getOrg(
      jsonRequest(`/api/v1/organizations/${otherBody.organization.id}`, {}, {
        cookie: ownerSession,
        orgId: otherBody.organization.id,
        method: "GET",
      }),
      { params: Promise.resolve({ orgId: otherBody.organization.id }) },
    );
    expect(hidden.status).toBe(404);

    const invited = await invite(
      jsonRequest(
        `/api/v1/organizations/${orgId}/invites`,
        { email: "viewer@example.com", role: "viewer" },
        { cookie: ownerSession, orgId },
      ),
      { params: Promise.resolve({ orgId }) },
    );
    expect(invited.status).toBe(201);
    const inviteToken = tokenFrom("invite");

    const viewerCookie = await registerUser("viewer@example.com", "Viewer");
    const accepted = await acceptInvite(
      jsonRequest(`/api/v1/invites/${inviteToken}/accept`, {}, { cookie: viewerCookie }),
      { params: Promise.resolve({ token: inviteToken }) },
    );
    expect(accepted.status).toBe(200);

    const denied = await patchOrg(
      jsonRequest(
        `/api/v1/organizations/${orgId}`,
        { name: "Hacked" },
        { cookie: viewerCookie, orgId, method: "PATCH" },
      ),
      { params: Promise.resolve({ orgId }) },
    );
    expect(denied.status).toBe(403);

    const membersResponse = await listMembersRoute(
      jsonRequest(`/api/v1/organizations/${orgId}/members`, {}, {
        cookie: ownerSession,
        orgId,
        method: "GET",
      }),
      { params: Promise.resolve({ orgId }) },
    );
    expect(membersResponse.status).toBe(200);
    const membersBody = (await membersResponse.json()) as {
      members: Array<{ id: string; role: string; email: string }>;
    };
    const ownerMember = membersBody.members.find((member) => member.email === "owner@example.com");
    expect(ownerMember).toBeTruthy();
    const demote = await patchMember(
      jsonRequest(
        `/api/v1/organizations/${orgId}/members/${ownerMember?.id}`,
        { role: "admin" },
        { cookie: ownerSession, orgId, method: "PATCH" },
      ),
      { params: Promise.resolve({ orgId, memberId: ownerMember?.id ?? "" }) },
    );
    expect(demote.status).toBe(409);
  });
});
