import { z } from "zod";

import { auth } from "@/server/auth/auth";
import { passwordError } from "@/server/auth/password";
import {
  assertTrustedOrigin,
  enforceAuthRateLimit,
  jsonError,
  readJson,
  serviceErrorResponse,
} from "@/server/http/api";

const schema = z.object({
  token: z.string().min(1),
  password: z.string(),
});

export async function POST(request: Request) {
  const limited = enforceAuthRateLimit(request);
  if (limited) return limited;
  const originError = assertTrustedOrigin(request);
  if (originError) return originError;

  try {
    const data = schema.parse(await readJson(request));
    const problem = passwordError(data.password);
    if (problem) {
      return jsonError(400, "VALIDATION_FAILED", problem, [
        { field: "password", message: problem, code: "custom" },
      ]);
    }
    await auth.api.resetPassword({
      body: { token: data.token, newPassword: data.password },
      headers: request.headers,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
