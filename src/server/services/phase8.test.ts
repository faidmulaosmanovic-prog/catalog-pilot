import { createHmac } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { POST as checkout } from "@/app/api/v1/billing/checkout-session/route";
import { GET as listPlansRoute } from "@/app/api/v1/billing/plans/route";
import { POST as portal } from "@/app/api/v1/billing/portal-session/route";
import { GET as getSubscriptionRoute } from "@/app/api/v1/billing/subscription/route";
import { POST as stripeWebhook } from "@/app/api/v1/billing/webhooks/stripe/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as inviteMember } from "@/app/api/v1/organizations/[orgId]/invites/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { GET as getUsageRoute } from "@/app/api/v1/usage/route";
import { clearAuthEmails, listAuthEmails } from "@/server/auth/email";
import { createDb, createPostgresClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/reset-database";
import { planLimits, plans, subscriptions, usageRecords } from "@/server/db/schema/billing";
import { organizationMembers, users } from "@/server/db/schema/identity";
import { resetRateLimits } from "@/server/http/rate-limit";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const origin = "http://localhost:3000";
const webhookSecret = "whsec_phase8_test";

function jsonRequest(
  path: string,
  body: unknown,
  options?: { cookie?: string; orgId?: string; method?: string; headers?: HeadersInit },
) {
  const headers = new Headers({ origin, "content-type": "application/json" });
  if (options?.cookie) headers.set("cookie", options.cookie);
  if (options?.orgId) headers.set("x-organization-id", options.orgId);
  if (options?.headers) {
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  }
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

function signStripe(payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe.skipIf(!hasDatabaseUrl)("DB-8 billing and usage", () => {
  const client = createPostgresClient();
  const db = createDb(client);
  const previousStripeKey = process.env.STRIPE_SECRET_KEY;
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(async () => {
    await resetDatabase(db);
    clearAuthEmails();
    resetRateLimits();
    await restoreBillingSeeds();
    if (previousStripeKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = previousStripeKey;
    }
    if (previousWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
    }
    vi.unstubAllGlobals();
  });

  afterEach(async () => {
    await restoreBillingSeeds();
    vi.unstubAllGlobals();
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

  async function starterPlan() {
    const [plan] = await db.select().from(plans).where(eq(plans.code, "starter"));
    if (!plan) {
      throw new Error("starter plan missing");
    }
    return plan;
  }

  async function restoreBillingSeeds() {
    const [starter] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, "starter"));
    if (!starter) {
      return;
    }
    await db
      .update(planLimits)
      .set({ valueInteger: 2000 })
      .where(and(eq(planLimits.planId, starter.id), eq(planLimits.key, "max_products")));
    await db
      .update(planLimits)
      .set({ valueInteger: 2 })
      .where(and(eq(planLimits.planId, starter.id), eq(planLimits.key, "max_members")));
    await db.update(plans).set({ stripePriceIdMonthly: null }).where(eq(plans.code, "growth"));
  }

  it("seeds plans, starts a trial, gates products, and applies a webhook once", async () => {
    const seeded = await db.select({ code: plans.code }).from(plans).orderBy(plans.sortOrder);
    expect(seeded.map((plan) => plan.code)).toEqual(["starter", "growth", "pro"]);

    const owner = await registerUser("faid.billing@example.com", "Faid Billing");
    const orgId = await makeOrg(owner.cookie, "Billing Commerce");
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("trialing");

    const plansResponse = await listPlansRoute(jsonRequest("/api/v1/billing/plans", null, { cookie: owner.cookie, method: "GET" }));
    expect(plansResponse.status).toBe(200);
    const listed = (await plansResponse.json()) as { plans: Array<{ code: string; limits: Array<{ key: string; valueInteger: number | null }> }> };
    const starterLimits = listed.plans.find((plan) => plan.code === "starter")?.limits ?? [];
    expect(starterLimits.find((limit) => limit.key === "max_products")?.valueInteger).toBe(2000);
    expect(starterLimits.find((limit) => limit.key === "max_ai_credits_monthly")?.valueInteger).toBe(0);

    const subscriptionResponse = await getSubscriptionRoute(
      jsonRequest("/api/v1/billing/subscription", null, { cookie: owner.cookie, orgId, method: "GET" }),
    );
    expect(subscriptionResponse.status).toBe(200);
    const subscriptionBody = (await subscriptionResponse.json()) as { subscription: { planCode: string } };
    expect(subscriptionBody.subscription.planCode).toBe("starter");

    const created = await createProduct(
      jsonRequest("/api/v1/products", { sku: "TEE-1", title: "Blue Tee", price: "10.00" }, { cookie: owner.cookie, orgId }),
    );
    expect(created.status).toBe(201);
    const again = await createProduct(
      jsonRequest("/api/v1/products", { sku: "TEE-2", title: "Green Tee", price: "12.00" }, { cookie: owner.cookie, orgId }),
    );
    expect(again.status).toBe(201);
    const usageRows = await db
      .select()
      .from(usageRecords)
      .where(and(eq(usageRecords.organizationId, orgId), eq(usageRecords.metric, "products")));
    expect(usageRows).toHaveLength(1);
    expect(usageRows[0]?.quantity).toBe(2);

    const usageResponse = await getUsageRoute(
      jsonRequest("/api/v1/usage", null, { cookie: owner.cookie, orgId, method: "GET" }),
    );
    expect(usageResponse.status).toBe(200);
    const usage = (await usageResponse.json()) as { metrics: Array<{ metric: string; quantity: number; limit: number | null }> };
    expect(usage.metrics.find((metric) => metric.metric === "products")).toMatchObject({ quantity: 2, limit: 2000 });

    const starter = await starterPlan();
    await db
      .update(planLimits)
      .set({ valueInteger: 2 })
      .where(and(eq(planLimits.planId, starter.id), eq(planLimits.key, "max_products")));
    const blocked = await createProduct(
      jsonRequest("/api/v1/products", { sku: "TEE-3", title: "Red Tee" }, { cookie: owner.cookie, orgId }),
    );
    expect(blocked.status).toBe(402);
    const blockedBody = (await blocked.json()) as { error: { message: string } };
    expect(blockedBody.error.message).toContain("Upgrade in Billing");
    await db
      .update(planLimits)
      .set({ valueInteger: 2000 })
      .where(and(eq(planLimits.planId, starter.id), eq(planLimits.key, "max_products")));

    await db
      .update(planLimits)
      .set({ valueInteger: 1 })
      .where(and(eq(planLimits.planId, starter.id), eq(planLimits.key, "max_members")));
    const invite = await inviteMember(
      jsonRequest(`/api/v1/organizations/${orgId}/invites`, { email: "editor.billing@example.com", role: "editor" }, { cookie: owner.cookie, orgId }),
      { params: Promise.resolve({ orgId }) },
    );
    expect(invite.status).toBe(402);
    await db
      .update(planLimits)
      .set({ valueInteger: 2 })
      .where(and(eq(planLimits.planId, starter.id), eq(planLimits.key, "max_members")));

    const other = await registerUser("other.billing@example.com", "Other Billing");
    const foreign = await getSubscriptionRoute(
      jsonRequest("/api/v1/billing/subscription", null, { cookie: other.cookie, orgId, method: "GET" }),
    );
    expect(foreign.status).toBe(404);

    await db.update(organizationMembers).set({ role: "editor" }).where(eq(organizationMembers.organizationId, orgId));
    const editorCheckout = await checkout(
      jsonRequest("/api/v1/billing/checkout-session", { planCode: "growth", interval: "month" }, { cookie: owner.cookie, orgId }),
    );
    expect(editorCheckout.status).toBe(403);
    await db.update(organizationMembers).set({ role: "owner" }).where(eq(organizationMembers.userId, owner.userId));

    const missingPrice = await checkout(
      jsonRequest("/api/v1/billing/checkout-session", { planCode: "growth", interval: "month" }, { cookie: owner.cookie, orgId }),
    );
    expect(missingPrice.status).toBe(503);

    process.env.STRIPE_SECRET_KEY = "sk_test_phase8";
    const unpriced = await checkout(
      jsonRequest("/api/v1/billing/checkout-session", { planCode: "growth", interval: "month" }, { cookie: owner.cookie, orgId }),
    );
    expect(unpriced.status).toBe(409);
    await db.update(plans).set({ stripePriceIdMonthly: "price_growth_month" }).where(eq(plans.code, "growth"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test" }), { status: 200 })),
    );
    const session = await checkout(
      jsonRequest("/api/v1/billing/checkout-session", { planCode: "growth", interval: "month" }, { cookie: owner.cookie, orgId }),
    );
    expect(session.status).toBe(200);
    expect(((await session.json()) as { url: string }).url).toContain("checkout.stripe.com");
    await db.update(plans).set({ stripePriceIdMonthly: null }).where(eq(plans.code, "growth"));

    const portalResponse = await portal(
      jsonRequest("/api/v1/billing/portal-session", {}, { cookie: owner.cookie, orgId }),
    );
    expect(portalResponse.status).toBe(409);

    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const payload = JSON.stringify({
      id: "evt_phase8",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_phase8",
          customer: "cus_phase8",
          status: "active",
          cancel_at_period_end: false,
          metadata: { organizationId: orgId, planCode: "growth" },
        },
      },
    });
    const signed = new Request(`${origin}/api/v1/billing/webhooks/stripe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signStripe(payload),
      },
      body: payload,
    });
    const first = await stripeWebhook(signed);
    const second = await stripeWebhook(
      new Request(`${origin}/api/v1/billing/webhooks/stripe`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signStripe(payload),
        },
        body: payload,
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { duplicate: boolean }).duplicate).toBe(true);
    const updated = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId));
    expect(updated).toHaveLength(1);
    expect(updated[0]?.status).toBe("active");
    expect(updated[0]?.stripeSubscriptionId).toBe("sub_phase8");
    const growth = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, "growth"));
    expect(updated[0]?.planId).toBe(growth[0]?.id);
  });
});
