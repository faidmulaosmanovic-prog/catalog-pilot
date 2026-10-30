import { z } from "zod";

import { auth } from "@/server/auth/auth";
import { GENERIC_REGISTER_MESSAGE } from "@/server/auth/email";
import { passwordError } from "@/server/auth/password";
import {
  assertTrustedOrigin,
  enforceAuthRateLimit,
  jsonError,
  jsonOk,
  publicUser,
  readJson,
  serviceErrorResponse,
} from "@/server/http/api";

const registerSchema = z.object({
  email: z.email(),
  password: z.string(),
  name: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const limited = enforceAuthRateLimit(request);
  if (limited) return limited;
  const originError = assertTrustedOrigin(request);
  if (originError) return originError;

  try {
    const data = registerSchema.parse(await readJson(request));
    const problem = passwordError(data.password);
    if (problem) {
      return jsonError(400, "VALIDATION_FAILED", problem, [
        { field: "password", message: problem, code: "custom" },
      ]);
    }
    const result = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
      headers: request.headers,
    });
    return jsonOk(
      {
        user: publicUser(result.user),
        message: GENERIC_REGISTER_MESSAGE,
      },
      201,
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
