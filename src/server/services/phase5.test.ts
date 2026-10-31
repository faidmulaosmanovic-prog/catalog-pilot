import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { POST as confirmImport } from "@/app/api/v1/imports/[importId]/confirm/route";
import { PUT as saveMapping } from "@/app/api/v1/imports/[importId]/mapping/route";
import { POST as previewImport } from "@/app/api/v1/imports/[importId]/preview/route";
import { POST as uploadImport } from "@/app/api/v1/imports/upload/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { GET as getProductRoute } from "@/app/api/v1/products/[productId]/route";
import { POST as createProduct, GET as listProductsRoute } from "@/app/api/v1/products/route";
import { POST as ignoreIssue } from "@/app/api/v1/validation/issues/[issueId]/ignore/route";
import { GET as listIssuesRoute } from "@/app/api/v1/validation/issues/route";
import { PATCH as patchRule } from "@/app/api/v1/validation/rules/[code]/route";
import { GET as listRules } from "@/app/api/v1/validation/rules/route";
import { POST as startRun } from "@/app/api/v1/validation/runs/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { productVariants } from "@/server/db/schema/catalog";
import { organizationMembers, users } from "@/server/db/schema/identity";
import { validationRules } from "@/server/db/schema/quality";
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

function sessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe.skipIf(!hasDatabaseUrl)("DB-5 data quality", () => {
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

  async function setRole(organizationId: string, role: "owner" | "admin" | "editor" | "viewer") {
    await db
      .update(organizationMembers)
      .set({ role })
      .where(eq(organizationMembers.organizationId, organizationId));
  }

  it("scores a bare product, enforces ignore and severity bounds, and hides other organizations", async () => {
    const rules = await db.select({ code: validationRules.code }).from(validationRules);
    expect(rules.length).toBeGreaterThanOrEqual(12);

    const ada = await registerUser("ada.quality@example.com", "Ada");
    const grace = await registerUser("grace.quality@example.com", "Grace");
    const adaOrg = await makeOrg(ada.cookie, "Ada Quality");
    const graceOrg = await makeOrg(grace.cookie, "Grace Quality");

    const listedRules = await listRules(
      jsonRequest("/api/v1/validation/rules", null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
    );
    expect(listedRules.status).toBe(200);
    const listedRulesBody = (await listedRules.json()) as { rules: Array<{ code: string }> };
    expect(listedRulesBody.rules.map((rule) => rule.code)).toContain("missing_title");

    const created = await createProduct(
      jsonRequest("/api/v1/products", { sku: "OK-1" }, { cookie: ada.cookie, orgId: adaOrg }),
    );
    expect(created.status).toBe(201);
    const productId = ((await created.json()) as { product: { id: string } }).product.id;

    const other = await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "OTHER-1", title: "Other", price: "1.00", barcode: "12345678" },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    const otherId = ((await other.json()) as { product: { id: string } }).product.id;
    await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "OTHER-2", title: "Twin", price: "1.00", barcode: "12345678" },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );

    await setRole(adaOrg, "viewer");
    const denied = await startRun(
      jsonRequest("/api/v1/validation/runs", { scope: "all" }, { cookie: ada.cookie, orgId: adaOrg }),
    );
    expect(denied.status).toBe(403);
    await setRole(adaOrg, "owner");

    const run = await startRun(
      jsonRequest("/api/v1/validation/runs", { scope: "all" }, { cookie: ada.cookie, orgId: adaOrg }),
    );
    expect(run.status).toBe(202);

    const loaded = await getProductRoute(
      jsonRequest(`/api/v1/products/${productId}`, null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
      { params: Promise.resolve({ productId }) },
    );
    const loadedBody = (await loaded.json()) as { product: { qualityScore: number } };
    expect(loadedBody.product.qualityScore).toBe(70);

    const issues = await listIssuesRoute(
      jsonRequest("/api/v1/validation/issues?status=open&productId=" + productId, null, {
        cookie: ada.cookie,
        orgId: adaOrg,
        method: "GET",
      }),
    );
    const issuesBody = (await issues.json()) as {
      issues: Array<{ id: string; ruleCode: string; severity: string }>;
    };
    const titleIssue = issuesBody.issues.find((issue) => issue.ruleCode === "missing_title");
    const imageIssue = issuesBody.issues.find((issue) => issue.ruleCode === "missing_image");
    expect(titleIssue?.severity).toBe("error");
    expect(imageIssue).toBeTruthy();

    const barcodeIssues = await listIssuesRoute(
      jsonRequest("/api/v1/validation/issues?status=open&ruleCode=duplicate_barcode", null, {
        cookie: ada.cookie,
        orgId: adaOrg,
        method: "GET",
      }),
    );
    const barcodeBody = (await barcodeIssues.json()) as { issues: unknown[] };
    expect(barcodeBody.issues.length).toBe(2);

    const filtered = await listProductsRoute(
      jsonRequest("/api/v1/products?hasIssues=true", null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
    );
    const filteredBody = (await filtered.json()) as { data: Array<{ sku: string }> };
    expect(filteredBody.data.map((item) => item.sku)).toContain("OK-1");

    await setRole(adaOrg, "editor");
    const editorError = await ignoreIssue(
      jsonRequest(`/api/v1/validation/issues/${titleIssue?.id}/ignore`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ issueId: titleIssue?.id ?? "" }) },
    );
    expect(editorError.status).toBe(403);
    const editorWarning = await ignoreIssue(
      jsonRequest(`/api/v1/validation/issues/${imageIssue?.id}/ignore`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ issueId: imageIssue?.id ?? "" }) },
    );
    expect(editorWarning.status).toBe(200);

    await setRole(adaOrg, "admin");
    const adminError = await ignoreIssue(
      jsonRequest(`/api/v1/validation/issues/${titleIssue?.id}/ignore`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ issueId: titleIssue?.id ?? "" }) },
    );
    expect(adminError.status).toBe(200);

    await db.insert(productVariants).values({
      organizationId: adaOrg,
      productId: otherId,
      sku: "OK-1",
    });
    const rerun = await startRun(
      jsonRequest("/api/v1/validation/runs", { scope: "selection", productIds: [productId] }, {
        cookie: ada.cookie,
        orgId: adaOrg,
      }),
    );
    expect(rerun.status).toBe(202);
    const criticalList = await listIssuesRoute(
      jsonRequest("/api/v1/validation/issues?status=open&ruleCode=duplicate_sku&productId=" + productId, null, {
        cookie: ada.cookie,
        orgId: adaOrg,
        method: "GET",
      }),
    );
    const critical = ((await criticalList.json()) as { issues: Array<{ id: string }> }).issues[0];
    expect(critical).toBeTruthy();
    await setRole(adaOrg, "owner");
    const ignoredCritical = await ignoreIssue(
      jsonRequest(`/api/v1/validation/issues/${critical?.id}/ignore`, {}, { cookie: ada.cookie, orgId: adaOrg }),
      { params: Promise.resolve({ issueId: critical?.id ?? "" }) },
    );
    expect(ignoredCritical.status).toBe(403);

    const hidden = await ignoreIssue(
      jsonRequest(`/api/v1/validation/issues/${imageIssue?.id}/ignore`, {}, { cookie: grace.cookie, orgId: graceOrg }),
      { params: Promise.resolve({ issueId: imageIssue?.id ?? "" }) },
    );
    expect(hidden.status).toBe(404);

    const tooLow = await patchRule(
      jsonRequest(
        "/api/v1/validation/rules/missing_title",
        { severity: "info" },
        { cookie: ada.cookie, orgId: adaOrg, method: "PATCH" },
      ),
      { params: Promise.resolve({ code: "missing_title" }) },
    );
    expect(tooLow.status).toBe(400);
    const allowed = await patchRule(
      jsonRequest(
        "/api/v1/validation/rules/missing_title",
        { severity: "warning" },
        { cookie: ada.cookie, orgId: adaOrg, method: "PATCH" },
      ),
      { params: Promise.resolve({ code: "missing_title" }) },
    );
    expect(allowed.status).toBe(200);
  });

  it("runs validation after a completed import", async () => {
    const ada = await registerUser("ada.quality-import@example.com", "Ada");
    const orgId = await makeOrg(ada.cookie, "Ada Import Quality");
    const form = new FormData();
    form.set("file", new File(["sku,title\nHOOK-1,\n"], "catalog.csv", { type: "text/csv" }));
    const uploaded = await uploadImport(
      new Request(`${origin}/api/v1/imports/upload`, {
        method: "POST",
        headers: new Headers({ origin, cookie: ada.cookie, "x-organization-id": orgId }),
        body: form,
      }),
    );
    expect(uploaded.status).toBe(201);
    const importId = ((await uploaded.json()) as { import: { id: string } }).import.id;
    const context = { params: Promise.resolve({ importId }) };
    expect(
      (
        await saveMapping(
          jsonRequest(
            `/api/v1/imports/${importId}/mapping`,
            {
              mode: "create",
              mappings: [
                { sourceColumn: "sku", targetField: "sku" },
                { sourceColumn: "title", targetField: "title" },
              ],
            },
            { cookie: ada.cookie, orgId, method: "PUT" },
          ),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (await previewImport(jsonRequest(`/api/v1/imports/${importId}/preview`, { limit: 20 }, { cookie: ada.cookie, orgId }), context)).status,
    ).toBe(200);
    const confirmed = await confirmImport(
      jsonRequest(`/api/v1/imports/${importId}/confirm`, {}, {
        cookie: ada.cookie,
        orgId,
        idempotencyKey: `idem-${importId}`,
      }),
      context,
    );
    expect(confirmed.status).toBe(202);
    const confirmedBody = (await confirmed.json()) as { import: { status: string } };
    expect(confirmedBody.import.status).toBe("completed");

    const issues = await listIssuesRoute(
      jsonRequest("/api/v1/validation/issues?status=open&ruleCode=missing_title", null, {
        cookie: ada.cookie,
        orgId,
        method: "GET",
      }),
    );
    const body = (await issues.json()) as { issues: Array<{ sku: string }> };
    expect(body.issues.map((issue) => issue.sku)).toContain("HOOK-1");
  });
});
