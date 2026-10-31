import { canManageBilling } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import {
  jsonError,
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { createCheckoutSession } from "@/server/services/billing";

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  if (!canManageBilling(access.membership.role)) {
    return jsonError(403, "FORBIDDEN", "Only the owner can change billing");
  }
  try {
    return jsonOk(
      await createCheckoutSession(db, access.membership.organizationId, await readJson(request)),
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
