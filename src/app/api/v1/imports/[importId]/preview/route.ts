import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { previewImport } from "@/server/services/imports";

type Context = { params: Promise<{ importId: string }> };

export async function POST(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { importId } = await context.params;
    const result = await previewImport(
      db,
      access.membership.organizationId,
      importId,
      await readJson(request),
    );
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
