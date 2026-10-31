import { db } from "@/server/db/client";
import { jsonOk, serviceErrorResponse } from "@/server/http/api";
import { handleStripeWebhook } from "@/server/services/billing";

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    return jsonOk(await handleStripeWebhook(db, payload, request.headers.get("stripe-signature")));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
