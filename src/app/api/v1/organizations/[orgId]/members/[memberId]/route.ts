import { canManageMembers } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireOrgAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { removeMember, updateMemberRole } from "@/server/services/organizations";

type Context = { params: Promise<{ orgId: string; memberId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { orgId, memberId } = await context.params;
  const access = await requireOrgAccess(request, orgId, canManageMembers);
  if (!access.ok) {
    return access.response;
  }
  try {
    const member = await updateMemberRole(
      db,
      { userId: access.session.user.id, role: access.membership.role },
      orgId,
      memberId,
      await readJson(request),
    );
    return jsonOk({ member });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const { orgId, memberId } = await context.params;
  const access = await requireOrgAccess(request, orgId, canManageMembers);
  if (!access.ok) {
    return access.response;
  }
  try {
    await removeMember(
      db,
      { userId: access.session.user.id, role: access.membership.role },
      orgId,
      memberId,
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
