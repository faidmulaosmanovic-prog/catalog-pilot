import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { DELETE as deleteProduct, GET as getProductRoute, PATCH as patchProduct } from "@/app/api/v1/products/[productId]/route";
import { POST as createProduct, GET as listProductsRoute } from "@/app/api/v1/products/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { productRevisions, products } from "@/server/db/schema";
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

describe.skipIf(!hasDatabaseUrl)("DB-3 catalog", () => {
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
      jsonRequest("/api/v1/auth/register", {
        email,
        name,
        password: "Correct-horse-1",
      }),
    );
    expect(response.status).toBe(201);
    const emailMessage = [...listAuthEmails()].reverse().find((item) => item.kind === "verify");
    const token = new URL(emailMessage?.url ?? "http://localhost/verify-email").searchParams.get("token");
    const verified = await verifyEmail(jsonRequest("/api/v1/auth/verify-email", { token }));
    expect(verified.status).toBe(204);
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

  it("rejects a duplicate SKU, records a revision, soft-deletes, and hides other organizations", async () => {
    const ada = await registerUser("ada.catalog@example.com", "Ada");
    const grace = await registerUser("grace.catalog@example.com", "Grace");
    const adaOrg = await makeOrg(ada.cookie, "Ada Goods");
    const graceOrg = await makeOrg(grace.cookie, "Grace Goods");

    const created = await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "MUG-1", title: "Mug", price: "12.50", images: [{ url: "https://example.com/mug.jpg" }] },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { product: { id: string; imageCount: number } };
    expect(createdBody.product.imageCount).toBe(1);
    const listedWithImage = await listProductsRoute(
      jsonRequest("/api/v1/products?q=Mug", null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
    );
    expect(listedWithImage.status).toBe(200);
    const listedWithImageBody = (await listedWithImage.json()) as {
      data: Array<{ sku: string; imageCount: number }>;
    };
    expect(listedWithImageBody.data.find((item) => item.sku === "MUG-1")?.imageCount).toBe(1);

    const duplicate = await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "MUG-1", title: "Another mug" },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(duplicate.status).toBe(409);

    const sameSkuOtherOrg = await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "MUG-1", title: "Grace mug" },
        { cookie: grace.cookie, orgId: graceOrg },
      ),
    );
    expect(sameSkuOtherOrg.status).toBe(201);

    const updated = await patchProduct(
      jsonRequest(
        `/api/v1/products/${createdBody.product.id}`,
        { title: "Blue mug" },
        { cookie: ada.cookie, orgId: adaOrg, method: "PATCH" },
      ),
      { params: Promise.resolve({ productId: createdBody.product.id }) },
    );
    expect(updated.status).toBe(200);
    const revisions = await db
      .select()
      .from(productRevisions)
      .where(eq(productRevisions.productId, createdBody.product.id));
    expect(revisions.length).toBeGreaterThanOrEqual(2);

    const crossOrg = await getProductRoute(
      jsonRequest(`/api/v1/products/${createdBody.product.id}`, null, {
        cookie: grace.cookie,
        orgId: graceOrg,
        method: "GET",
      }),
      { params: Promise.resolve({ productId: createdBody.product.id }) },
    );
    expect(crossOrg.status).toBe(404);

    const removed = await deleteProduct(
      jsonRequest(`/api/v1/products/${createdBody.product.id}`, null, {
        cookie: ada.cookie,
        orgId: adaOrg,
        method: "DELETE",
      }),
      { params: Promise.resolve({ productId: createdBody.product.id }) },
    );
    expect(removed.status).toBe(204);
    const [row] = await db.select().from(products).where(eq(products.id, createdBody.product.id));
    expect(row?.deletedAt).toBeInstanceOf(Date);

    const reused = await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "MUG-1", title: "Mug again" },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(reused.status).toBe(201);

    const listed = await listProductsRoute(
      jsonRequest("/api/v1/products?q=Mug", null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { data: Array<{ sku: string }> };
    expect(listBody.data.some((item) => item.sku === "MUG-1")).toBe(true);
  });

  it("blocks viewers from creating products", async () => {
    const owner = await registerUser("owner.catalog@example.com", "Owner");
    const viewer = await registerUser("viewer.catalog@example.com", "Viewer");
    const orgId = await makeOrg(owner.cookie, "Shared Catalog");
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: viewer.userId,
      role: "viewer",
    });

    const response = await createProduct(
      jsonRequest(
        "/api/v1/products",
        { sku: "VIEW-1", title: "Nope" },
        { cookie: viewer.cookie, orgId },
      ),
    );
    expect(response.status).toBe(403);
  });
});
