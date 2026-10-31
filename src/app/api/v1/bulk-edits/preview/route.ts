import { db } from "@/server/db/client";
import { jsonOk, readJson, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { previewBulkEdit } from "@/server/services/bulk";

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(
      await previewBulkEdit(db, access.membership.organizationId, await readJson(request)),
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
