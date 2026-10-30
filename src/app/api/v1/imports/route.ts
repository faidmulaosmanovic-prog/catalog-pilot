import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { listImports } from "@/server/services/imports";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const imports = await listImports(db, access.membership.organizationId);
    return jsonOk({ imports });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
