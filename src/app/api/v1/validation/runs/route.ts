import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { runValidation } from "@/server/services/quality";

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const result = await runValidation(
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
