import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { getValidationRun } from "@/server/services/quality";

type Context = { params: Promise<{ runId: string }> };

export async function GET(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { runId } = await context.params;
    return jsonOk(await getValidationRun(db, access.membership.organizationId, runId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
