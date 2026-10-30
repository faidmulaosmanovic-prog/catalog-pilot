import { ORG_COOKIE } from "@/server/auth/email";
import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireVerifiedSession,
  serviceErrorResponse,
} from "@/server/http/api";
import {
  createOrganization,
  listOrganizationsForUser,
} from "@/server/services/organizations";

function withOrgCookie(response: Response, organizationId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "set-cookie",
    `${ORG_COOKIE}=${organizationId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
  );
  return response;
}

export async function GET(request: Request) {
  const authResult = await requireVerifiedSession(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  const organizations = await listOrganizationsForUser(db, authResult.session.user.id);
  return jsonOk({ organizations });
}

export async function POST(request: Request) {
  const authResult = await requireVerifiedSession(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  try {
    const organization = await createOrganization(
      db,
      authResult.session.user.id,
      await readJson(request),
    );
    return withOrgCookie(jsonOk({ organization }, 201), organization.id);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
