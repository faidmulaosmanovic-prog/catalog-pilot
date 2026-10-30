import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { getImport } from "@/server/services/imports";

type Context = { params: Promise<{ importId: string }> };

export async function GET(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { importId } = await context.params;
    return jsonOk(await getImport(db, access.membership.organizationId, importId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
