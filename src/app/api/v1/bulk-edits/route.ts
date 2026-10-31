import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { applyBulkEdit, listBulkEdits } from "@/server/services/bulk";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(await listBulkEdits(db, access.membership.organizationId));
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
    const result = await applyBulkEdit(
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
