import { db } from "@/server/db/client";
import { jsonError, jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { canManageMembers } from "@/server/auth/roles";
import { rollbackBulkEdit } from "@/server/services/bulk";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  if (!canManageMembers(access.membership.role)) {
    return jsonError(403, "FORBIDDEN", "You do not have access to do that");
  }
  try {
    const { id } = await context.params;
    return jsonOk(
      await rollbackBulkEdit(db, access.session.user.id, access.membership.organizationId, id),
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
