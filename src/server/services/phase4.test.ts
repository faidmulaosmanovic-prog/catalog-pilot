import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { POST as confirmImport } from "@/app/api/v1/imports/[importId]/confirm/route";
import { GET as importErrors } from "@/app/api/v1/imports/[importId]/errors/route";
import { PUT as saveMapping } from "@/app/api/v1/imports/[importId]/mapping/route";
import { POST as previewImport } from "@/app/api/v1/imports/[importId]/preview/route";
import { GET as getImportRoute } from "@/app/api/v1/imports/[importId]/route";
import { POST as rollbackImport } from "@/app/api/v1/imports/[importId]/rollback/route";
import { POST as uploadImport } from "@/app/api/v1/imports/upload/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { importMappings } from "@/server/db/schema/imports";
import { products } from "@/server/db/schema/catalog";
import { users } from "@/server/db/schema/identity";
import { resetRateLimits } from "@/server/http/rate-limit";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3000";

function jsonRequest(
  path: string,
  body: unknown,
  options?: { cookie?: string; orgId?: string; method?: string; idempotencyKey?: string },
) {
  const headers = new Headers({ origin, "content-type": "application/json" });
  if (options?.cookie) headers.set("cookie", options.cookie);
  if (options?.orgId) headers.set("x-organization-id", options.orgId);
  if (options?.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
  const method = options?.method ?? "POST";
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body),
  });
}

function uploadRequest(csv: string, cookie: string, orgId: string, name = "catalog.csv") {
  const form = new FormData();
  form.set("file", new File([csv], name, { type: "text/csv" }));
  const headers = new Headers({ origin, cookie, "x-organization-id": orgId });
  return new Request(`${origin}/api/v1/imports/upload`, { method: "POST", headers, body: form });
}

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe.skipIf(!hasDatabaseUrl)("DB-4 import", () => {
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
    const response = await register(
      jsonRequest("/api/v1/auth/register", { email, name, password: "Correct-horse-1" }),
    );
    expect(response.status).toBe(201);
    const emailMessage = [...listAuthEmails()].reverse().find((item) => item.kind === "verify");
    const token = new URL(emailMessage?.url ?? "http://localhost/verify-email").searchParams.get("token");
    expect((await verifyEmail(jsonRequest("/api/v1/auth/verify-email", { token }))).status).toBe(204);
    const signedIn = await login(
      jsonRequest("/api/v1/auth/login", { email, password: "Correct-horse-1" }),
    );
    expect(signedIn.status).toBe(200);
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return { cookie: sessionCookie(signedIn), userId: user?.id ?? "" };
  }

  async function makeOrg(cookie: string, name: string) {
    const response = await createOrg(jsonRequest("/api/v1/organizations", { name }, { cookie }));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { organization: { id: string } };
    return body.organization.id;
  }

  async function runImport(cookie: string, orgId: string, csv: string, mode = "create") {
    const uploaded = await uploadImport(uploadRequest(csv, cookie, orgId));
    expect(uploaded.status).toBe(201);
    const uploadedBody = (await uploaded.json()) as {
      import: { id: string; detection: { delimiter: string; encoding: string } };
    };
    const context = { params: Promise.resolve({ importId: uploadedBody.import.id }) };
    const mapped = await saveMapping(
      jsonRequest(
        `/api/v1/imports/${uploadedBody.import.id}/mapping`,
        {
          mode,
          mappings: [
            { sourceColumn: "sku", targetField: "sku" },
            { sourceColumn: "title", targetField: "title" },
          ],
        },
        { cookie, orgId, method: "PUT" },
      ),
      context,
    );
    expect(mapped.status).toBe(200);
    const preview = await previewImport(
      jsonRequest(`/api/v1/imports/${uploadedBody.import.id}/preview`, { limit: 50 }, { cookie, orgId }),
      context,
    );
    expect(preview.status).toBe(200);
    const confirmed = await confirmImport(
      jsonRequest(`/api/v1/imports/${uploadedBody.import.id}/confirm`, {}, {
        cookie,
        orgId,
        idempotencyKey: `idem-${uploadedBody.import.id}`,
      }),
      context,
    );
    expect(confirmed.status).toBe(202);
    const confirmedBody = (await confirmed.json()) as {
      import: { id: string; status: string; successRows: number; failedRows: number };
    };
    return { ...uploadedBody.import, ...confirmedBody.import, context };
  }

  it("imports new rows, skips a duplicate SKU, and rolls the created products back", async () => {
    const ada = await registerUser("ada.import@example.com", "Ada");
    const grace = await registerUser("grace.import@example.com", "Grace");
    const adaOrg = await makeOrg(ada.cookie, "Ada Imports");
    const graceOrg = await makeOrg(grace.cookie, "Grace Imports");
    const csv = "sku,title\nMUG-1,Blue mug\nMUG-1,Duplicate\nBOWL-1,Bowl\n";
    const result = await runImport(ada.cookie, adaOrg, csv);
    expect(result.status).toBe("completed");
    expect(result.successRows).toBe(2);
    expect(result.failedRows).toBe(1);

    const hidden = await getImportRoute(
      jsonRequest(`/api/v1/imports/${result.id}`, null, { cookie: grace.cookie, orgId: graceOrg, method: "GET" }),
      result.context,
    );
    expect(hidden.status).toBe(404);

    const errors = await importErrors(jsonRequest(`/api/v1/imports/${result.id}/errors`, null, {
      cookie: ada.cookie,
      orgId: adaOrg,
      method: "GET",
    }), result.context);
    expect(await errors.text()).toMatch(/Duplicate SKU/);

    const again = await confirmImport(
      jsonRequest(`/api/v1/imports/${result.id}/confirm`, {}, {
        cookie: ada.cookie,
        orgId: adaOrg,
        idempotencyKey: `idem-${result.id}`,
      }),
      result.context,
    );
    expect(again.status).toBe(202);
    const againBody = (await again.json()) as { import: { successRows: number } };
    expect(againBody.import.successRows).toBe(2);

    const rolled = await rollbackImport(
      jsonRequest(`/api/v1/imports/${result.id}/rollback`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      result.context,
    );
    expect(rolled.status).toBe(200);
    const live = await db.select().from(products).where(eq(products.organizationId, adaOrg));
    expect(live.filter((product) => product.deletedAt === null)).toHaveLength(0);

    await expect(
      db.insert(importMappings).values({
        importId: "00000000-0000-4000-8000-000000000000",
        organizationId: adaOrg,
        sourceColumn: "sku",
        targetField: "sku",
      }),
    ).rejects.toThrow();
  });

  it("restores an upserted product and blocks viewers", async () => {
    const owner = await registerUser("owner.import@example.com", "Owner");
    const viewer = await registerUser("viewer.import@example.com", "Viewer");
    const orgId = await makeOrg(owner.cookie, "Upsert Imports");
    const { organizationMembers } = await import("@/server/db/schema/identity");
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: viewer.userId,
      role: "viewer",
    });
    const created = await createProduct(
      jsonRequest("/api/v1/products", { sku: "MUG-9", title: "Old title" }, { cookie: owner.cookie, orgId }),
    );
    expect(created.status).toBe(201);

    const denied = await uploadImport(uploadRequest("sku,title\nMUG-9,New title\n", viewer.cookie, orgId));
    expect(denied.status).toBe(403);

    const result = await runImport(owner.cookie, orgId, "sku,title\nMUG-9,New title\n", "upsert");
    expect(result.successRows).toBe(1);
    const [updated] = await db.select().from(products).where(eq(products.sku, "MUG-9"));
    expect(updated?.title).toBe("New title");

    const rolled = await rollbackImport(
      jsonRequest(`/api/v1/imports/${result.id}/rollback`, {}, { cookie: owner.cookie, orgId }),
      result.context,
    );
    expect(rolled.status).toBe(200);
    const [restored] = await db.select().from(products).where(eq(products.sku, "MUG-9"));
    expect(restored?.title).toBe("Old title");
    expect(restored?.deletedAt).toBeNull();
  });
});
