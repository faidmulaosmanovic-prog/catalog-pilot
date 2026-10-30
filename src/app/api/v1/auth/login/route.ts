import { z } from "zod";

import { auth } from "@/server/auth/auth";
import { passwordError } from "@/server/auth/password";
import {
  assertTrustedOrigin,
  enforceAuthRateLimit,
  jsonError,
  publicUser,
  readJson,
  serviceErrorResponse,
} from "@/server/http/api";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const limited = enforceAuthRateLimit(request);
  if (limited) return limited;
  const originError = assertTrustedOrigin(request);
  if (originError) return originError;

  try {
    const data = loginSchema.parse(await readJson(request));
    const problem = passwordError(data.password);
    if (problem) {
      return jsonError(401, "UNAUTHENTICATED", "Email or password is incorrect");
    }
    const response = await auth.api.signInEmail({
      body: { email: data.email, password: data.password },
      headers: request.headers,
      asResponse: true,
    });
    const payload = (await response.json()) as {
      user?: { id: string; email: string; name: string; emailVerified: boolean };
      message?: string;
    };
    if (!response.ok || !payload.user) {
      const status = response.status === 403 ? 403 : 401;
      return jsonError(
        status,
        status === 403 ? "FORBIDDEN" : "UNAUTHENTICATED",
        payload.message ?? "Email or password is incorrect",
      );
    }
    const headers = new Headers({ "content-type": "application/json" });
    for (const cookie of response.headers.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
    return new Response(JSON.stringify({ user: publicUser(payload.user) }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
