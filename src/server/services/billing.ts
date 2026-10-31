import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  createStripeCheckoutSession,
  createStripePortalSession,
  verifyStripeSignature,
} from "@/server/billing/stripe";
import type { Database } from "@/server/db/client";
import { planLimits, plans, subscriptions, usageRecords, type PlanLimitJson } from "@/server/db/schema/billing";
import { products } from "@/server/db/schema/catalog";
import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
  type UsageMetric,
} from "@/server/db/schema/constants";
import { organizationMembers } from "@/server/db/schema/identity";
import { activityLogs } from "@/server/db/schema/audit";
import { recordActivity } from "@/server/services/activity-log";
import { ServiceError } from "@/server/services/organizations";

const checkoutSchema = z.object({
  planCode: z.string().trim().min(1),
  interval: z.literal("month"),
});

const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.string(), z.json()),
  }),
});

function appBaseUrl() {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

function currentPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function findPlan(db: Database, code: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  return plan ?? null;
}

async function limitRow(db: Database, planId: string, key: string) {
  const [row] = await db
    .select()
    .from(planLimits)
    .where(and(eq(planLimits.planId, planId), eq(planLimits.key, key)))
    .limit(1);
  return row ?? null;
}

async function limitInteger(db: Database, planId: string, key: string) {
  const row = await limitRow(db, planId, key);
  return row?.valueInteger ?? null;
}

async function planLimitList(db: Database, planId: string) {
  const rows = await db.select().from(planLimits).where(eq(planLimits.planId, planId));
  return rows.map((row) => ({
    key: row.key,
    valueInteger: row.valueInteger,
    valueJson: row.valueJson,
  }));
}

export async function attachStarterSubscription(db: Database, organizationId: string) {
  const plan = await findPlan(db, "starter");
  if (!plan) {
    throw new ServiceError(500, "INTERNAL", "Starter plan is not seeded");
  }
  const trialDays = await limitInteger(db, plan.id, "trial_days");
  if (trialDays === null) {
    throw new ServiceError(500, "INTERNAL", "Starter plan is missing trial_days");
  }
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
  await db
    .insert(subscriptions)
    .values({
      organizationId,
      planId: plan.id,
      status: "trialing",
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
    })
    .onConflictDoNothing();
}

async function loadSubscription(db: Database, organizationId: string) {
  const [row] = await db
    .select({
      subscription: subscriptions,
      planCode: plans.code,
      planName: plans.name,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

function assertSubscriptionOpen(row: NonNullable<Awaited<ReturnType<typeof loadSubscription>>>) {
  const { subscription } = row;
  if (
    subscription.status === "trialing" &&
    subscription.trialEndsAt &&
    subscription.trialEndsAt.getTime() < Date.now()
  ) {
    throw new ServiceError(402, "PAYMENT_REQUIRED", "The trial has ended. Upgrade in Billing.");
  }
  if (subscription.status !== "trialing" && subscription.status !== "active") {
    throw new ServiceError(402, "PAYMENT_REQUIRED", "The subscription is not active. Upgrade in Billing.");
  }
  return row;
}

async function requireOpenSubscription(db: Database, organizationId: string) {
  const row = await loadSubscription(db, organizationId);
  if (!row) {
    throw new ServiceError(402, "PAYMENT_REQUIRED", "This organization has no subscription. Open Billing.");
  }
  return assertSubscriptionOpen(row);
}

async function countProducts(db: Database, organizationId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), isNull(products.deletedAt)));
  return Number(row?.count ?? 0);
}

async function countMembers(db: Database, organizationId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
  return Number(row?.count ?? 0);
}

async function upsertUsage(db: Database, organizationId: string, metric: UsageMetric, quantity: number) {
  const period = currentPeriod();
  await db
    .insert(usageRecords)
    .values({
      organizationId,
      periodStart: period.start,
      periodEnd: period.end,
      metric,
      quantity,
    })
    .onConflictDoUpdate({
      target: [usageRecords.organizationId, usageRecords.periodStart, usageRecords.metric],
      set: { quantity, periodEnd: period.end, updatedAt: new Date() },
    });
  return period;
}

export async function syncProductUsage(db: Database, organizationId: string) {
  const quantity = await countProducts(db, organizationId);
  await upsertUsage(db, organizationId, "products", quantity);
}

export async function assertCanAddProduct(db: Database, organizationId: string) {
  const row = await requireOpenSubscription(db, organizationId);
  const limit = await limitInteger(db, row.subscription.planId, "max_products");
  const quantity = await countProducts(db, organizationId);
  if (limit !== null && quantity >= limit) {
    throw new ServiceError(
      402,
      "PLAN_LIMIT",
      `This plan allows ${limit} product${limit === 1 ? "" : "s"}. Upgrade in Billing.`,
    );
  }
}

export async function assertCanInviteMember(db: Database, organizationId: string) {
  const row = await requireOpenSubscription(db, organizationId);
  const limit = await limitInteger(db, row.subscription.planId, "max_members");
  const quantity = await countMembers(db, organizationId);
  if (limit !== null && quantity >= limit) {
    throw new ServiceError(
      402,
      "PLAN_LIMIT",
      `This plan allows ${limit} member${limit === 1 ? "" : "s"}. Upgrade in Billing.`,
    );
  }
}

export async function assertCanExportChannel(db: Database, organizationId: string, channelCode: string) {
  const row = await requireOpenSubscription(db, organizationId);
  const limit = await limitRow(db, row.subscription.planId, "export_templates");
  const channels = limit?.valueJson?.channels;
  if (channels && channels.length > 0 && !channels.includes(channelCode)) {
    throw new ServiceError(
      402,
      "PLAN_LIMIT",
      "This plan does not include that export template. Upgrade in Billing.",
    );
  }
}

export async function recordImportExportJob(db: Database, organizationId: string) {
  const row = await requireOpenSubscription(db, organizationId);
  const limit = await limitInteger(db, row.subscription.planId, "max_import_export_jobs_monthly");
  const period = currentPeriod();
  const [existing] = await db
    .select({ quantity: usageRecords.quantity })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.organizationId, organizationId),
        eq(usageRecords.periodStart, period.start),
        eq(usageRecords.metric, "import_export_jobs"),
      ),
    )
    .limit(1);
  const quantity = Number(existing?.quantity ?? 0);
  if (limit !== null && quantity >= limit) {
    throw new ServiceError(
      402,
      "PLAN_LIMIT",
      `This plan allows ${limit} import and export job${limit === 1 ? "" : "s"} this month. Upgrade in Billing.`,
    );
  }
  await upsertUsage(db, organizationId, "import_export_jobs", quantity + 1);
}

export async function listPlans(db: Database) {
  const rows = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder);
  return {
    plans: await Promise.all(
      rows.map(async (plan) => ({
        code: plan.code,
        name: plan.name,
        sortOrder: plan.sortOrder,
        limits: await planLimitList(db, plan.id),
      })),
    ),
  };
}

export async function getSubscription(db: Database, organizationId: string) {
  const row = await loadSubscription(db, organizationId);
  if (!row) {
    throw new ServiceError(404, "NOT_FOUND", "Subscription not found");
  }
  return {
    subscription: {
      status: row.subscription.status as SubscriptionStatus,
      planCode: row.planCode,
      planName: row.planName,
      trialEndsAt: row.subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: row.subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row.subscription.cancelAtPeriodEnd,
      hasStripeCustomer: Boolean(row.subscription.stripeCustomerId),
    },
    limits: await planLimitList(db, row.subscription.planId),
  };
}

export async function getUsage(db: Database, organizationId: string) {
  const row = await loadSubscription(db, organizationId);
  if (!row) {
    throw new ServiceError(404, "NOT_FOUND", "Subscription not found");
  }
  const productQuantity = await countProducts(db, organizationId);
  const period = await upsertUsage(db, organizationId, "products", productQuantity);
  const [jobs] = await db
    .select({ quantity: usageRecords.quantity })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.organizationId, organizationId),
        eq(usageRecords.periodStart, period.start),
        eq(usageRecords.metric, "import_export_jobs"),
      ),
    )
    .limit(1);
  const productLimit = await limitInteger(db, row.subscription.planId, "max_products");
  const jobLimit = await limitInteger(db, row.subscription.planId, "max_import_export_jobs_monthly");
  return {
    period: { start: period.start, end: period.end },
    metrics: [
      { metric: "products", quantity: productQuantity, limit: productLimit },
      { metric: "import_export_jobs", quantity: Number(jobs?.quantity ?? 0), limit: jobLimit },
    ],
  };
}

export async function createCheckoutSession(db: Database, organizationId: string, input: unknown) {
  const data = checkoutSchema.parse(input);
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ServiceError(503, "STRIPE_NOT_CONFIGURED", "Add STRIPE_SECRET_KEY before opening Checkout");
  }
  const plan = await findPlan(db, data.planCode);
  if (!plan || !plan.isActive) {
    throw new ServiceError(404, "NOT_FOUND", "Plan not found");
  }
  if (!plan.stripePriceIdMonthly) {
    throw new ServiceError(409, "CONFLICT", "This plan has no Stripe price yet");
  }
  const current = await loadSubscription(db, organizationId);
  if (!current) {
    throw new ServiceError(404, "NOT_FOUND", "Subscription not found");
  }
  try {
    const session = await createStripeCheckoutSession({
      secretKey,
      priceId: plan.stripePriceIdMonthly,
      organizationId,
      planCode: plan.code,
      customerId: current.subscription.stripeCustomerId,
      successUrl: `${appBaseUrl()}/app/settings/billing?checkout=success`,
      cancelUrl: `${appBaseUrl()}/app/settings/billing?checkout=cancel`,
    });
    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }
    return { url: session.url };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Could not start Checkout";
    throw new ServiceError(502, "STRIPE_ERROR", message);
  }
}

export async function createPortalSession(db: Database, organizationId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ServiceError(503, "STRIPE_NOT_CONFIGURED", "Add STRIPE_SECRET_KEY before opening the billing portal");
  }
  const current = await loadSubscription(db, organizationId);
  if (!current?.subscription.stripeCustomerId) {
    throw new ServiceError(409, "CONFLICT", "Subscribe before opening the billing portal");
  }
  try {
    const session = await createStripePortalSession({
      secretKey,
      customerId: current.subscription.stripeCustomerId,
      returnUrl: `${appBaseUrl()}/app/settings/billing`,
    });
    if (!session.url) {
      throw new Error("Stripe did not return a portal URL");
    }
    return { url: session.url };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Could not open the billing portal";
    throw new ServiceError(502, "STRIPE_ERROR", message);
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mapStripeStatus(status: string | null): SubscriptionStatus {
  if (status && (SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
    return status as SubscriptionStatus;
  }
  if (status === "incomplete_expired" || status === "unpaid") {
    return status === "unpaid" ? "past_due" : "incomplete";
  }
  return "incomplete";
}

async function applyStripeObject(db: Database, type: string, object: Record<string, unknown>) {
  const metadata = asRecord(object.metadata);
  const organizationId = asString(metadata.organizationId) ?? asString(object.client_reference_id);
  const planCode = asString(metadata.planCode);
  const stripeSubscriptionId = asString(object.subscription) ?? (type.startsWith("customer.subscription") ? asString(object.id) : null);
  const stripeCustomerId = asString(object.customer);

  let row = organizationId ? await loadSubscription(db, organizationId) : null;
  if (!row && stripeSubscriptionId) {
    const [found] = await db
      .select({ organizationId: subscriptions.organizationId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    if (found) {
      row = await loadSubscription(db, found.organizationId);
    }
  }
  if (!row) {
    return null;
  }

  let planId = row.subscription.planId;
  if (planCode) {
    const plan = await findPlan(db, planCode);
    if (plan) {
      planId = plan.id;
    }
  }

  let status = row.subscription.status as SubscriptionStatus;
  if (type === "checkout.session.completed") {
    status = "active";
  } else if (type === "customer.subscription.deleted") {
    status = "canceled";
  } else if (type === "invoice.payment_failed") {
    status = "past_due";
  } else if (type.startsWith("customer.subscription")) {
    status = mapStripeStatus(asString(object.status));
  }

  const periodEndSeconds = typeof object.current_period_end === "number" ? object.current_period_end : null;
  const trialEndSeconds = typeof object.trial_end === "number" ? object.trial_end : null;
  await db
    .update(subscriptions)
    .set({
      planId,
      status,
      stripeCustomerId: stripeCustomerId ?? row.subscription.stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId ?? row.subscription.stripeSubscriptionId,
      cancelAtPeriodEnd:
        typeof object.cancel_at_period_end === "boolean"
          ? object.cancel_at_period_end
          : row.subscription.cancelAtPeriodEnd,
      currentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : row.subscription.currentPeriodEnd,
      trialEndsAt: trialEndSeconds ? new Date(trialEndSeconds * 1000) : row.subscription.trialEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, row.subscription.id));
  return row.subscription;
}

export async function handleStripeWebhook(db: Database, payload: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new ServiceError(503, "STRIPE_NOT_CONFIGURED", "Add STRIPE_WEBHOOK_SECRET before accepting webhooks");
  }
  if (!verifyStripeSignature(payload, signature, secret)) {
    throw new ServiceError(400, "BAD_REQUEST", "Stripe signature is invalid");
  }
  let event: z.infer<typeof stripeEventSchema>;
  try {
    event = stripeEventSchema.parse(JSON.parse(payload));
  } catch {
    throw new ServiceError(400, "BAD_REQUEST", "Stripe event is invalid");
  }
  const [seen] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(and(eq(activityLogs.action, "billing.webhook"), sql`${activityLogs.metadataJson}->>'eventId' = ${event.id}`))
    .limit(1);
  if (seen) {
    return { received: true, duplicate: true };
  }
  const subscription = await applyStripeObject(db, event.type, event.data.object);
  if (subscription) {
    await recordActivity(db, {
      organizationId: subscription.organizationId,
      entityType: "subscription",
      entityId: subscription.id,
      action: "billing.webhook",
      metadata: { eventId: event.id, type: event.type },
    });
  }
  return { received: true, duplicate: false };
}

export type { PlanLimitJson };
