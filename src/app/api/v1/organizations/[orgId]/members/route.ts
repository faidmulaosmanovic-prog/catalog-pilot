import { db } from "@/server/db/client";
import { jsonOk, requireOrgAccess, serviceErrorResponse } from "@/server/http/api";
import { listMembers } from "@/server/services/organizations";

type Context = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: Context) {
  const { orgId } = await context.params;
  const access = await requireOrgAccess(request, orgId, () => true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const members = await listMembers(db, orgId);
    return jsonOk({ members });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
