import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { listEffectiveRules } from "@/server/services/quality";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const rules = await listEffectiveRules(db, access.membership.organizationId);
    return jsonOk({ rules });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
