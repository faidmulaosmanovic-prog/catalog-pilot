import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { POST as applyBulk, GET as listBulk } from "@/app/api/v1/bulk-edits/route";
import { GET as getBulk } from "@/app/api/v1/bulk-edits/[id]/route";
import { POST as rollbackBulk } from "@/app/api/v1/bulk-edits/[id]/rollback/route";
import { POST as previewBulk } from "@/app/api/v1/bulk-edits/preview/route";
import { POST as createCategory } from "@/app/api/v1/categories/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { PATCH as patchProduct, GET as getProductRoute } from "@/app/api/v1/products/[productId]/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { activityLogs, jobRuns } from "@/server/db/schema/audit";
import { productRevisions } from "@/server/db/schema/catalog";
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
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body),
  });
}

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe.skipIf(!hasDatabaseUrl)("DB-6 bulk editor", () => {
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
    return ((await response.json()) as { organization: { id: string } }).organization.id;
  }

  async function setRole(organizationId: string, role: "owner" | "admin" | "editor" | "viewer") {
    await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.organizationId, organizationId));
  }

  async function addProduct(cookie: string, orgId: string, body: Record<string, unknown>) {
    const response = await createProduct(jsonRequest("/api/v1/products", body, { cookie, orgId }));
    expect(response.status).toBe(201);
    return ((await response.json()) as { product: { id: string } }).product.id;
  }

  it("previews, applies, snapshots, and undoes a text replace", async () => {
    const ada = await registerUser("ada.bulk@example.com", "Ada");
    const grace = await registerUser("grace.bulk@example.com", "Grace");
    const adaOrg = await makeOrg(ada.cookie, "Ada Bulk");
    const graceOrg = await makeOrg(grace.cookie, "Grace Bulk");
    const tee = await addProduct(ada.cookie, adaOrg, { sku: "TEE-1", title: "Blue Tee", price: "10.00", status: "draft" });
    const mug = await addProduct(ada.cookie, adaOrg, { sku: "MUG-1", title: "Green mug", price: "8.00", status: "active" });
    const bowl = await addProduct(ada.cookie, adaOrg, { sku: "BOWL-1", title: "Bowl", status: "draft" });

    const replace = {
      productIds: [tee, mug],
      operation: "replace_text",
      config: { field: "title", find: "Tee", replace: "T-Shirt" },
    };
    await setRole(adaOrg, "viewer");
    expect((await previewBulk(jsonRequest("/api/v1/bulk-edits/preview", replace, { cookie: ada.cookie, orgId: adaOrg }))).status).toBe(403);
    await setRole(adaOrg, "owner");

    const preview = await previewBulk(jsonRequest("/api/v1/bulk-edits/preview", replace, { cookie: ada.cookie, orgId: adaOrg }));
    expect(preview.status).toBe(200);
    const previewBody = (await preview.json()) as { preview: { affectedCount: number; samples: Array<{ sku: string; after: { title: string } }> } };
    expect(previewBody.preview.affectedCount).toBe(1);
    expect(previewBody.preview.samples[0]).toMatchObject({ sku: "TEE-1", after: { title: "Blue T-Shirt" } });

    const hidden = await previewBulk(
      jsonRequest("/api/v1/bulk-edits/preview", { ...replace, productIds: [tee] }, { cookie: grace.cookie, orgId: graceOrg }),
    );
    expect(hidden.status).toBe(404);

    const applied = await applyBulk(jsonRequest("/api/v1/bulk-edits", replace, { cookie: ada.cookie, orgId: adaOrg }));
    expect(applied.status).toBe(202);
    const appliedBody = (await applied.json()) as { job: { id: string; canRollback: boolean; status: string } };
    expect(appliedBody.job.canRollback).toBe(true);
    expect(appliedBody.job.status).toBe("completed");

    const loaded = await getProductRoute(
      jsonRequest(`/api/v1/products/${tee}`, null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
      { params: Promise.resolve({ productId: tee }) },
    );
    expect(((await loaded.json()) as { product: { title: string } }).product.title).toBe("Blue T-Shirt");
    const revisions = await db.select({ changeSource: productRevisions.changeSource }).from(productRevisions).where(eq(productRevisions.productId, tee));
    expect(revisions.some((revision) => revision.changeSource === `bulk:${appliedBody.job.id}`)).toBe(true);
    const jobs = await db.select({ type: jobRuns.type }).from(jobRuns).where(eq(jobRuns.organizationId, adaOrg));
    expect(jobs.map((job) => job.type)).toContain("bulk_edit.apply");
    const activity = await db.select({ action: activityLogs.action }).from(activityLogs).where(eq(activityLogs.entityId, appliedBody.job.id));
    expect(activity.map((row) => row.action)).toContain("completed");

    await patchProduct(
      jsonRequest(`/api/v1/products/${tee}`, { title: "Edited after" }, { cookie: ada.cookie, orgId: adaOrg, method: "PATCH" }),
      { params: Promise.resolve({ productId: tee }) },
    );

    const matching = {
      selectAllMatching: true,
      filter: { status: "draft" },
      operation: "append_text",
      config: { field: "title", text: "!" },
    };
    const appended = await applyBulk(jsonRequest("/api/v1/bulk-edits", matching, { cookie: ada.cookie, orgId: adaOrg }));
    expect(appended.status).toBe(202);
    const bowlLoaded = await getProductRoute(
      jsonRequest(`/api/v1/products/${bowl}`, null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
      { params: Promise.resolve({ productId: bowl }) },
    );
    expect(((await bowlLoaded.json()) as { product: { title: string } }).product.title).toBe("Bowl!");

    await setRole(adaOrg, "editor");
    const editorRollback = await rollbackBulk(
      jsonRequest(`/api/v1/bulk-edits/${appliedBody.job.id}/rollback`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ id: appliedBody.job.id }) },
    );
    expect(editorRollback.status).toBe(403);
    await setRole(adaOrg, "owner");
    const rolled = await rollbackBulk(
      jsonRequest(`/api/v1/bulk-edits/${appliedBody.job.id}/rollback`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ id: appliedBody.job.id }) },
    );
    expect(rolled.status).toBe(409);

    const category = await createCategory(jsonRequest("/api/v1/categories", { name: "Apparel" }, { cookie: ada.cookie, orgId: adaOrg }));
    const categoryId = ((await category.json()) as { category: { id: string } }).category.id;
    const categorized = await applyBulk(
      jsonRequest(
        "/api/v1/bulk-edits",
        { productIds: [mug], operation: "update_category", config: { categoryId } },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(categorized.status).toBe(202);
    const priced = await applyBulk(
      jsonRequest(
        "/api/v1/bulk-edits",
        { productIds: [mug], operation: "update_price", config: { mode: "percent", value: 10 } },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(priced.status).toBe(202);
    const mugLoaded = await getProductRoute(
      jsonRequest(`/api/v1/products/${mug}`, null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
      { params: Promise.resolve({ productId: mug }) },
    );
    const mugBody = (await mugLoaded.json()) as { product: { price: string; categoryId: string } };
    expect(mugBody.product.price).toBe("8.80");
    expect(mugBody.product.categoryId).toBe(categoryId);

    const priceJobId = ((await priced.json()) as { job: { id: string } }).job.id;
    const undone = await rollbackBulk(
      jsonRequest(`/api/v1/bulk-edits/${priceJobId}/rollback`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ id: priceJobId }) },
    );
    expect(undone.status).toBe(200);
    const restored = await getProductRoute(
      jsonRequest(`/api/v1/products/${mug}`, null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
      { params: Promise.resolve({ productId: mug }) },
    );
    expect(((await restored.json()) as { product: { price: string } }).product.price).toBe("8.00");

    const listed = await listBulk(jsonRequest("/api/v1/bulk-edits", null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }));
    expect(listed.status).toBe(200);
    const detail = await getBulk(
      jsonRequest(`/api/v1/bulk-edits/${priceJobId}`, null, { cookie: grace.cookie, orgId: graceOrg, method: "GET" }),
      { params: Promise.resolve({ id: priceJobId }) },
    );
    expect(detail.status).toBe(404);
  });
});
