import { ORG_COOKIE } from "@/server/auth/email";
import { db } from "@/server/db/client";
import { jsonOk, requireVerifiedSession, serviceErrorResponse } from "@/server/http/api";
import { getOrganizationForMember } from "@/server/services/organizations";

type Context = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: Context) {
  const authResult = await requireVerifiedSession(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  const { orgId } = await context.params;
  try {
    const organization = await getOrganizationForMember(
      db,
      authResult.session.user.id,
      orgId,
    );
    const response = jsonOk({ organization });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.append(
      "set-cookie",
      `${ORG_COOKIE}=${organization.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
    );
    return response;
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
