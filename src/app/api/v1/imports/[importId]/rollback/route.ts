import { db } from "@/server/db/client";
import { jsonError, jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { canManageMembers } from "@/server/auth/roles";
import { rollbackImport } from "@/server/services/imports";

type Context = { params: Promise<{ importId: string }> };

export async function POST(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  if (!canManageMembers(access.membership.role)) {
    return jsonError(403, "FORBIDDEN", "You do not have access to do that");
  }
  try {
    const { importId } = await context.params;
    const result = await rollbackImport(
      db,
      access.session.user.id,
      access.membership.organizationId,
      importId,
    );
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
