import { z } from "zod";

import { auth } from "@/server/auth/auth";
import {
  assertTrustedOrigin,
  enforceAuthRateLimit,
  readJson,
  serviceErrorResponse,
} from "@/server/http/api";

const schema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const limited = enforceAuthRateLimit(request);
  if (limited) return limited;
  const originError = assertTrustedOrigin(request);
  if (originError) return originError;

  try {
    const data = schema.parse(await readJson(request));
    await auth.api.verifyEmail({
      query: { token: data.token },
      headers: request.headers,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
