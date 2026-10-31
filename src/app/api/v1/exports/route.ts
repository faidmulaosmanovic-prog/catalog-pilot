import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { createExport, listExports } from "@/server/services/exports";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(await listExports(db, access.membership.organizationId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const result = await createExport(
      db,
      access.session.user.id,
      access.membership.organizationId,
      await readJson(request),
    );
    return jsonOk(result, 202);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
