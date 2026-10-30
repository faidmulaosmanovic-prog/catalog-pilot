import { z } from "zod";

import { auth } from "@/server/auth/auth";
import { GENERIC_REGISTER_MESSAGE } from "@/server/auth/email";
import {
  assertTrustedOrigin,
  enforceAuthRateLimit,
  jsonOk,
  readJson,
} from "@/server/http/api";

const schema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  const limited = enforceAuthRateLimit(request);
  if (limited) return limited;
  const originError = assertTrustedOrigin(request);
  if (originError) return originError;

  try {
    const data = schema.parse(await readJson(request));
    await auth.api.requestPasswordReset({
      body: { email: data.email },
      headers: request.headers,
    });
  } catch {
    // Always respond the same way so callers cannot tell whether the email exists.
  }

  return jsonOk({ message: GENERIC_REGISTER_MESSAGE }, 202);
}
