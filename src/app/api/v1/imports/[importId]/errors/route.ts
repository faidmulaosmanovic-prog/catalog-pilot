import { ORG_COOKIE } from "@/server/auth/email";
import { db } from "@/server/db/client";
import { requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { importErrorsCsv } from "@/server/services/imports";

type Context = { params: Promise<{ importId: string }> };

function withOrganization(request: Request) {
  if (request.headers.get("x-organization-id")) {
    return request;
  }
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ORG_COOKIE}=`));
  const organizationId = cookie ? decodeURIComponent(cookie.slice(ORG_COOKIE.length + 1)) : "";
  if (!organizationId) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("x-organization-id", organizationId);
  return new Request(request.url, { headers });
}

export async function GET(request: Request, context: Context) {
  const access = await requireCatalogAccess(withOrganization(request), false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { importId } = await context.params;
    const csv = await importErrorsCsv(db, access.membership.organizationId, importId);
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
