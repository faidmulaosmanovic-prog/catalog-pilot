import { canManageMembers } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireOrgAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { createInvite, listPendingInvites } from "@/server/services/organizations";

type Context = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, context: Context) {
  const { orgId } = await context.params;
  const access = await requireOrgAccess(request, orgId, () => true);
  if (!access.ok) {
    return access.response;
  }
  const invites = await listPendingInvites(db, orgId);
  return jsonOk({ invites });
}

export async function POST(request: Request, context: Context) {
  const { orgId } = await context.params;
  const access = await requireOrgAccess(request, orgId, canManageMembers);
  if (!access.ok) {
    return access.response;
  }
  try {
    const invite = await createInvite(
      db,
      { userId: access.session.user.id, role: access.membership.role },
      orgId,
      await readJson(request),
    );
    return jsonOk({ invite }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
