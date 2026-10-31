import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { listIssues } from "@/server/services/quality";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  const url = new URL(request.url);
  try {
    const result = await listIssues(db, access.membership.organizationId, {
      severity: url.searchParams.get("severity") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      ruleCode: url.searchParams.get("ruleCode") ?? undefined,
      productId: url.searchParams.get("productId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    });
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
