import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { listChannels } from "@/server/services/exports";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(await listChannels(db));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
