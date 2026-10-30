import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireOrgAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { canManageMembers } from "@/server/auth/roles";
import {
  getOrganizationForMember,
  updateOrganization,
} from "@/server/services/organizations";

type Context = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: Context) {
  const { orgId } = await context.params;
  const access = await requireOrgAccess(request, orgId, () => true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const organization = await getOrganizationForMember(
      db,
      access.session.user.id,
      orgId,
    );
    return jsonOk({ organization });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const { orgId } = await context.params;
  const access = await requireOrgAccess(request, orgId, canManageMembers);
  if (!access.ok) {
    return access.response;
  }
  try {
    const organization = await updateOrganization(
      db,
      access.session.user.id,
      orgId,
      access.membership.role,
      await readJson(request),
    );
    return jsonOk({ organization });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
