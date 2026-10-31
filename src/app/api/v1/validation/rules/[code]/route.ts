import { db } from "@/server/db/client";
import {
  jsonError,
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { canManageMembers } from "@/server/auth/roles";
import { updateRule } from "@/server/services/quality";

type Context = { params: Promise<{ code: string }> };

export async function PATCH(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  if (!canManageMembers(access.membership.role)) {
    return jsonError(403, "FORBIDDEN", "You do not have access to do that");
  }
  try {
    const { code } = await context.params;
    const result = await updateRule(
      db,
      access.membership.organizationId,
      code,
      await readJson(request),
    );
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
