import { db } from "@/server/db/client";
import { jsonOk, readJson, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { createFeedback, listFeedback } from "@/server/services/feedback";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    return jsonOk(await listFeedback(db, access.membership.organizationId));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const result = await createFeedback(
      db,
      access.session.user.id,
      access.membership.organizationId,
      await readJson(request),
    );
    return jsonOk(result, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
