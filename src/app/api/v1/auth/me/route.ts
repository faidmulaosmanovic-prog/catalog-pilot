import { z } from "zod";

import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import {
  jsonOk,
  publicUser,
  readJson,
  requireSession,
  serviceErrorResponse,
} from "@/server/http/api";
import { listOrganizationsForUser } from "@/server/services/organizations";

export async function GET(request: Request) {
  const authResult = await requireSession(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  const organizations = await listOrganizationsForUser(db, authResult.session.user.id);
  return jsonOk({
    user: publicUser(authResult.session.user),
    organizations,
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function PATCH(request: Request) {
  const authResult = await requireSession(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  try {
    const data = patchSchema.parse(await readJson(request));
    await auth.api.updateUser({
      body: { name: data.name },
      headers: request.headers,
    });
    return jsonOk({
      user: publicUser({ ...authResult.session.user, name: data.name }),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
