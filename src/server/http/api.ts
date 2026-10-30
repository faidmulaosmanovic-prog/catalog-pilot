import { APIError } from "better-auth/api";
import { ZodError } from "zod";

import { auth } from "@/server/auth/auth";
import type { MemberRole } from "@/server/db/schema/constants";
import { db } from "@/server/db/client";
import { clientIp, hitRateLimit } from "@/server/http/rate-limit";
import { getMembership, ServiceError } from "@/server/services/organizations";

export function jsonError(
  status: number,
  code: string,
  message: string,
  details: Array<{ field?: string; message: string; code?: string }> = [],
) {
  return Response.json(
    {
      error: {
        code,
        message,
        details,
        requestId: `req_${crypto.randomUUID()}`,
      },
    },
    { status },
  );
}

export function jsonOk(body: unknown, status = 200, extraHeaders?: Headers) {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new ServiceError(400, "BAD_REQUEST", "Request body must be JSON");
  }
}

export function serviceErrorResponse(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.status, error.code, error.message);
  }
  if (error instanceof APIError) {
    const status = error.statusCode || 400;
    const code =
      status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST";
    return jsonError(status, code, error.message || "Request failed");
  }
  if (error instanceof ZodError) {
    return jsonError(
      400,
      "VALIDATION_FAILED",
      "Check the highlighted fields",
      error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    );
  }
  console.error(error);
  return jsonError(500, "INTERNAL", "Something went wrong");
}

export function enforceAuthRateLimit(request: Request) {
  const result = hitRateLimit(`auth:${clientIp(request)}`, 10, 60_000);
  if (!result.limited) {
    return null;
  }
  const response = jsonError(429, "RATE_LIMITED", "Too many attempts. Try again soon.");
  response.headers.set("retry-after", String(result.retryAfter));
  return response;
}

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }
  const expected = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  if (origin === expected) {
    return null;
  }
  return jsonError(403, "FORBIDDEN", "Origin is not allowed");
}

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { ok: false as const, response: jsonError(401, "UNAUTHENTICATED", "Sign in required") };
  }
  return { ok: true as const, session };
}

export async function requireVerifiedSession(request: Request) {
  const result = await requireSession(request);
  if (!result.ok) {
    return result;
  }
  if (!result.session.user.emailVerified) {
    return {
      ok: false as const,
      response: jsonError(403, "FORBIDDEN", "Verify your email before continuing"),
    };
  }
  return result;
}

export async function requireOrgAccess(
  request: Request,
  organizationId: string,
  allow: (role: MemberRole) => boolean,
) {
  const authResult = await requireVerifiedSession(request);
  if (!authResult.ok) {
    return authResult;
  }
  const headerOrg = request.headers.get("x-organization-id");
  if (headerOrg !== organizationId) {
    return {
      ok: false as const,
      response: jsonError(400, "BAD_REQUEST", "X-Organization-Id does not match the organization"),
    };
  }
  const membership = await getMembership(db, authResult.session.user.id, organizationId);
  if (!membership) {
    return {
      ok: false as const,
      response: jsonError(404, "NOT_FOUND", "Organization not found"),
    };
  }
  if (!allow(membership.role)) {
    return {
      ok: false as const,
      response: jsonError(403, "FORBIDDEN", "You do not have access to do that"),
    };
  }
  return { ok: true as const, session: authResult.session, membership };
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  };
}
