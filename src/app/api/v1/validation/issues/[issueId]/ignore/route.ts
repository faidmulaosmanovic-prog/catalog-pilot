import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { ignoreIssue } from "@/server/services/quality";

type Context = { params: Promise<{ issueId: string }> };

export async function POST(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { issueId } = await context.params;
    const result = await ignoreIssue(
      db,
      access.membership.organizationId,
      issueId,
      access.membership.role,
    );
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
