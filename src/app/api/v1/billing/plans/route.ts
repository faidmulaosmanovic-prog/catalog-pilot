import { db } from "@/server/db/client";
import { jsonOk, requireVerifiedSession, serviceErrorResponse } from "@/server/http/api";
import { listPlans } from "@/server/services/billing";

export async function GET(request: Request) {
  const access = await requireVerifiedSession(request);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(await listPlans(db));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
