import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { confirmImport } from "@/server/services/imports";

type Context = { params: Promise<{ importId: string }> };

export async function POST(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { importId } = await context.params;
    const result = await confirmImport(
      db,
      access.session.user.id,
      access.membership.organizationId,
      importId,
      request.headers.get("idempotency-key"),
    );
    return jsonOk(result, 202);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
