import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { PATCH as updateFeedback } from "@/app/api/v1/feedback/[id]/route";
import { GET as listFeedbackRoute, POST as createFeedbackRoute } from "@/app/api/v1/feedback/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { organizationMembers, users } from "@/server/db/schema/identity";
import { resetRateLimits } from "@/server/http/rate-limit";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3000";

function jsonRequest(
  path: string,
  body: unknown,
  options?: { cookie?: string; orgId?: string; method?: string },
) {
  const headers = new Headers({ origin, "content-type": "application/json" });
  if (options?.cookie) headers.set("cookie", options.cookie);
  if (options?.orgId) headers.set("x-organization-id", options.orgId);
  const method = options?.method ?? "POST";
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function sessionCookie(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).filter(Boolean).join("; ");
}

describe.skipIf(!hasDatabaseUrl)("Phase 10 feedback and bug triage", () => {
  const client = createPostgresClient();
  const db = createDb(client);

  beforeEach(async () => {
    await resetDatabase(db);
    clearAuthEmails();
    resetRateLimits();
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  async function registerUser(email: string, name: string) {
    const response = await register(jsonRequest("/api/v1/auth/register", { email, name, password: "Correct-horse-1" }));
    expect(response.status).toBe(201);
    const emailMessage = [...listAuthEmails()].reverse().find((item) => item.kind === "verify");
    const token = new URL(emailMessage?.url ?? "http://localhost/verify-email").searchParams.get("token");
    expect((await verifyEmail(jsonRequest("/api/v1/auth/verify-email", { token }))).status).toBe(204);
    const signedIn = await login(jsonRequest("/api/v1/auth/login", { email, password: "Correct-horse-1" }));
    expect(signedIn.status).toBe(200);
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return { cookie: sessionCookie(signedIn), userId: user?.id ?? "" };
  }

  async function makeOrg(cookie: string, name: string) {
    const response = await createOrg(jsonRequest("/api/v1/organizations", { name }, { cookie }));
    expect(response.status).toBe(201);
    return ((await response.json()) as { organization: { id: string } }).organization.id;
  }

  it("lets a member file a bug and keeps triage inside the organization", async () => {
    const owner = await registerUser("faid.launch@example.com", "Faid Launch");
    const orgId = await makeOrg(owner.cookie, "Launch Commerce");
    await db.update(organizationMembers).set({ role: "viewer" }).where(eq(organizationMembers.organizationId, orgId));

    const created = await createFeedbackRoute(
      jsonRequest(
        "/api/v1/feedback",
        { kind: "bug", title: "Export button stays disabled", body: "The Shopify export button stays disabled after I select one product." },
        { cookie: owner.cookie, orgId },
      ),
    );
    expect(created.status).toBe(201);
    const itemId = ((await created.json()) as { item: { id: string; status: string } }).item.id;
    expect(itemId).toBeTruthy();

    const denied = await updateFeedback(
      jsonRequest(`/api/v1/feedback/${itemId}`, { status: "triaged" }, { cookie: owner.cookie, orgId, method: "PATCH" }),
      { params: Promise.resolve({ id: itemId }) },
    );
    expect(denied.status).toBe(403);

    await db.update(organizationMembers).set({ role: "owner" }).where(eq(organizationMembers.userId, owner.userId));
    const triaged = await updateFeedback(
      jsonRequest(`/api/v1/feedback/${itemId}`, { status: "triaged" }, { cookie: owner.cookie, orgId, method: "PATCH" }),
      { params: Promise.resolve({ id: itemId }) },
    );
    expect(triaged.status).toBe(200);

    const listed = await listFeedbackRoute(
      jsonRequest("/api/v1/feedback", null, { cookie: owner.cookie, orgId, method: "GET" }),
    );
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: Array<{ title: string; status: string; kind: string }> };
    expect(body.items).toEqual([
      expect.objectContaining({ title: "Export button stays disabled", status: "triaged", kind: "bug" }),
    ]);

    const other = await registerUser("other.launch@example.com", "Other Launch");
    const foreign = await listFeedbackRoute(
      jsonRequest("/api/v1/feedback", null, { cookie: other.cookie, orgId, method: "GET" }),
    );
    expect(foreign.status).toBe(404);
    const missing = await updateFeedback(
      jsonRequest(`/api/v1/feedback/${itemId}`, { status: "resolved" }, { cookie: owner.cookie, orgId: (await makeOrg(owner.cookie, "Second Commerce")), method: "PATCH" }),
      { params: Promise.resolve({ id: itemId }) },
    );
    expect(missing.status).toBe(404);
  });
});
