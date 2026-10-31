import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { GET as listChannelsRoute } from "@/app/api/v1/channels/route";
import { GET as downloadExport } from "@/app/api/v1/exports/[id]/download/route";
import { GET as getExportRoute } from "@/app/api/v1/exports/[id]/route";
import { POST as createExport } from "@/app/api/v1/exports/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { channelListings, channels, marketplaceTemplates } from "@/server/db/schema/channels";
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

describe.skipIf(!hasDatabaseUrl)("DB-7 channels and export", () => {
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

  it("seeds both channels, blocks a broken product, and downloads a Shopify CSV", async () => {
    const seeded = await db
      .select({ code: channels.code, version: marketplaceTemplates.version })
      .from(channels)
      .innerJoin(marketplaceTemplates, eq(marketplaceTemplates.channelId, channels.id));
    expect(seeded).toEqual(
      expect.arrayContaining([
        { code: "shopify", version: "2026.1" },
        { code: "amazon", version: "2026.1" },
      ]),
    );

    const ada = await registerUser("ada.export@example.com", "Ada");
    const grace = await registerUser("grace.export@example.com", "Grace");
    const adaOrg = await makeOrg(ada.cookie, "Ada Export");
    const graceOrg = await makeOrg(grace.cookie, "Grace Export");
    const channelsResponse = await listChannelsRoute(
      jsonRequest("/api/v1/channels", null, { cookie: ada.cookie, orgId: adaOrg, method: "GET" }),
    );
    expect(channelsResponse.status).toBe(200);
    const channelBody = (await channelsResponse.json()) as { channels: Array<{ code: string }> };
    expect(channelBody.channels.map((channel) => channel.code).sort()).toEqual(["amazon", "shopify"]);

    const bare = await createProduct(jsonRequest("/api/v1/products", { sku: "BARE-1" }, { cookie: ada.cookie, orgId: adaOrg }));
    const bareId = ((await bare.json()) as { product: { id: string } }).product.id;
    const blocked = await createExport(
      jsonRequest(
        "/api/v1/exports",
        { channelCode: "shopify", templateVersion: "2026.1", productIds: [bareId] },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(blocked.status).toBe(202);
    const blockedBody = (await blocked.json()) as { export: { id: string; status: string; errorReport: { errors: Array<{ code: string }> } } };
    expect(blockedBody.export.status).toBe("failed");
    expect(blockedBody.export.errorReport.errors.map((issue) => issue.code)).toContain("missing_title");

    const ready = await createProduct(
      jsonRequest(
        "/api/v1/products",
        {
          sku: "TEE-1",
          title: "Blue Tee",
          price: "10.00",
          description: "Soft cotton",
          brand: "Ada",
          status: "active",
          images: [{ url: "https://example.com/tee.jpg" }],
        },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    const productId = ((await ready.json()) as { product: { id: string } }).product.id;

    await db.update(organizationMembers).set({ role: "viewer" }).where(eq(organizationMembers.organizationId, adaOrg));
    const denied = await createExport(
      jsonRequest(
        "/api/v1/exports",
        { channelCode: "shopify", productIds: [productId] },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(denied.status).toBe(403);
    await db.update(organizationMembers).set({ role: "owner" }).where(eq(organizationMembers.organizationId, adaOrg));

    const hidden = await createExport(
      jsonRequest(
        "/api/v1/exports",
        { channelCode: "shopify", productIds: [productId] },
        { cookie: grace.cookie, orgId: graceOrg },
      ),
    );
    expect(hidden.status).toBe(404);

    const exported = await createExport(
      jsonRequest(
        "/api/v1/exports",
        { channelCode: "shopify", templateVersion: "2026.1", productIds: [productId] },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(exported.status).toBe(202);
    const exportedBody = (await exported.json()) as { export: { id: string; status: string; downloadUrl: string } };
    expect(exportedBody.export.status).toBe("completed");
    expect(exportedBody.export.downloadUrl).toContain("token=");

    const file = await downloadExport(
      jsonRequest(`/api/v1/exports/${exportedBody.export.id}/download`, null, {
        cookie: ada.cookie,
        orgId: adaOrg,
        method: "GET",
      }),
      { params: Promise.resolve({ id: exportedBody.export.id }) },
    );
    expect(file.status).toBe(200);
    expect(await file.text()).toContain("Blue Tee");

    const signed = new URL(exportedBody.export.downloadUrl, origin);
    const publicFile = await downloadExport(
      new Request(signed, { method: "GET" }),
      { params: Promise.resolve({ id: exportedBody.export.id }) },
    );
    expect(publicFile.status).toBe(200);

    const listings = await db.select({ status: channelListings.status }).from(channelListings).where(eq(channelListings.productId, productId));
    expect(listings.map((listing) => listing.status)).toContain("exported");

    const other = await getExportRoute(
      jsonRequest(`/api/v1/exports/${exportedBody.export.id}`, null, { cookie: grace.cookie, orgId: graceOrg, method: "GET" }),
      { params: Promise.resolve({ id: exportedBody.export.id }) },
    );
    expect(other.status).toBe(404);

    const empty = await createExport(
      jsonRequest(
        "/api/v1/exports",
        { channelCode: "amazon", templateVersion: "2026.1", selectAllMatching: true, filter: { status: "archived" } },
        { cookie: ada.cookie, orgId: adaOrg },
      ),
    );
    expect(empty.status).toBe(202);
    const emptyBody = (await empty.json()) as { export: { status: string; productCount: number } };
    expect(emptyBody.export.status).toBe("completed");
    expect(emptyBody.export.productCount).toBe(0);
  });
});
