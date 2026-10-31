import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { getBulkEdit } from "@/server/services/bulk";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { id } = await context.params;
    return jsonOk(await getBulkEdit(db, access.membership.organizationId, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
