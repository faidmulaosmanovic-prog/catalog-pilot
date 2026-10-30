import { z } from "zod";

import { db } from "@/server/db/client";
import { jsonOk, requireVerifiedSession, serviceErrorResponse } from "@/server/http/api";
import { acceptInvite } from "@/server/services/organizations";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  const authResult = await requireVerifiedSession(request);
  if (!authResult.ok) {
    return authResult.response;
  }
  try {
    const { token } = await context.params;
    z.string().min(1).parse(token);
    const organization = await acceptInvite(db, authResult.session.user.id, token);
    return jsonOk({ organization });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
