import { Suspense } from "react";

import { BillingActions } from "@/components/billing-actions";
import { canManageBilling } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { getSubscription, getUsage, listPlans } from "@/server/services/billing";

const LIMIT_LABELS: Record<string, string> = {
  max_products: "Products",
  max_import_export_jobs_monthly: "Import and export jobs / month",
  max_members: "Members",
  export_templates: "Export templates",
  trial_days: "Trial days",
};

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading billing…</p>}>
      <BillingContent />
    </Suspense>
  );
}

async function BillingContent() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before opening billing.</p>;
  }

  let subscription: Awaited<ReturnType<typeof getSubscription>> | null = null;
  let usage: Awaited<ReturnType<typeof getUsage>> | null = null;
  let plans: Awaited<ReturnType<typeof listPlans>>["plans"] = [];
  let error = "";
  try {
    [subscription, usage, plans] = await Promise.all([
      getSubscription(db, workspace.active.id),
      getUsage(db, workspace.active.id),
      listPlans(db).then((result) => result.plans),
    ]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load billing";
  }

  const owner = canManageBilling(workspace.active.role);

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-sm text-zinc-500">
        File exports stay on your plan limits. CatalogPilot does not charge per marketplace API.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {subscription ? (
        <>
          <p className="text-sm">
            {subscription.subscription.planName} · {subscription.subscription.status}
            {subscription.subscription.trialEndsAt
              ? ` · trial ends ${subscription.subscription.trialEndsAt.slice(0, 10)}`
              : ""}
          </p>
          {usage ? (
            <ul className="flex flex-col gap-1 text-sm">
              {usage.metrics.map((metric) => (
                <li key={metric.metric}>
                  {metric.metric === "products" ? "Products" : "Import and export jobs this month"}:{" "}
                  {metric.quantity}
                  {metric.limit === null ? "" : ` / ${metric.limit}`}
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="flex flex-col gap-1 text-sm text-zinc-600">
            {subscription.limits
              .filter((limit) => LIMIT_LABELS[limit.key])
              .map((limit) => (
                <li key={limit.key}>
                  {LIMIT_LABELS[limit.key]}: {limit.valueInteger ?? "—"}
                </li>
              ))}
          </ul>
          {owner ? (
            <BillingActions
              currentPlanCode={subscription.subscription.planCode}
              hasStripeCustomer={subscription.subscription.hasStripeCustomer}
              organizationId={workspace.active.id}
              plans={plans.map((plan) => ({ code: plan.code, name: plan.name }))}
            />
          ) : (
            <p className="text-sm">Only the owner can change the plan.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
