import { auth } from "@/server/auth/auth";
import {
  assertTrustedOrigin,
  enforceAuthRateLimit,
  serviceErrorResponse,
} from "@/server/http/api";

export async function POST(request: Request) {
  const limited = enforceAuthRateLimit(request);
  if (limited) return limited;
  const originError = assertTrustedOrigin(request);
  if (originError) return originError;

  try {
    const response = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    const headers = new Headers();
    for (const cookie of response.headers.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
