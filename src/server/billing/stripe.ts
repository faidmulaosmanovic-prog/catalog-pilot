import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  if (!header) {
    return false;
  }
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      timestamp = value ?? "";
    }
    if (key === "v1" && value) {
      signatures.push(value);
    }
  }
  const issued = Number(timestamp);
  if (!timestamp || !Number.isFinite(issued) || signatures.length === 0) {
    return false;
  }
  if (Math.abs(Date.now() / 1000 - issued) > TOLERANCE_SECONDS) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  return signatures.some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  });
}

export async function createStripeCheckoutSession(input: {
  secretKey: string;
  priceId: string;
  organizationId: string;
  planCode: string;
  customerId: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.organizationId,
    "metadata[organizationId]": input.organizationId,
    "metadata[planCode]": input.planCode,
    "subscription_data[metadata][organizationId]": input.organizationId,
    "subscription_data[metadata][planCode]": input.planCode,
  });
  if (input.customerId) {
    body.set("customer", input.customerId);
  }
  return stripeForm<{ url?: string }>(input.secretKey, "/v1/checkout/sessions", body);
}

export async function createStripePortalSession(input: {
  secretKey: string;
  customerId: string;
  returnUrl: string;
}) {
  const body = new URLSearchParams({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return stripeForm<{ url?: string }>(input.secretKey, "/v1/billing_portal/sessions", body);
}

async function stripeForm<T>(secretKey: string, path: string, body: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || "Stripe request failed");
  }
  return payload;
}
