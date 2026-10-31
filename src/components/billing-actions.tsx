"use client";

import { useState } from "react";

const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

export function BillingActions({
  organizationId,
  plans,
  currentPlanCode,
  hasStripeCustomer,
}: {
  organizationId: string;
  plans: Array<{ code: string; name: string }>;
  currentPlanCode: string;
  hasStripeCustomer: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  async function openSession(path: string, body?: unknown, key?: string) {
    setPending(key ?? path);
    setError("");
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-organization-id": organizationId,
      },
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json()) as { url?: string; error?: { message?: string } };
    setPending("");
    if (!response.ok || !payload.url) {
      setError(payload.error?.message ?? "Could not open billing");
      return;
    }
    window.location.assign(payload.url);
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {plans
          .filter((plan) => plan.code !== currentPlanCode)
          .map((plan) => (
            <button
              className={buttonClass}
              disabled={pending.length > 0}
              key={plan.code}
              onClick={() =>
                openSession(
                  "/api/v1/billing/checkout-session",
                  { planCode: plan.code, interval: "month" },
                  plan.code,
                )
              }
              type="button"
            >
              {pending === plan.code ? "Opening Checkout…" : `Upgrade to ${plan.name}`}
            </button>
          ))}
        {hasStripeCustomer ? (
          <button
            className={buttonClass}
            disabled={pending.length > 0}
            onClick={() => openSession("/api/v1/billing/portal-session", {}, "portal")}
            type="button"
          >
            {pending === "portal" ? "Opening portal…" : "Manage billing"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
