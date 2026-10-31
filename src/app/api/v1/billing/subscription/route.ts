import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { getSubscription } from "@/server/services/billing";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(await getSubscription(db, access.membership.organizationId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
