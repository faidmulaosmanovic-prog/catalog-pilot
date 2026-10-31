import { db } from "@/server/db/client";
import { jsonOk, readJson, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { updateFeedbackStatus } from "@/server/services/feedback";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  const { id } = await context.params;
  try {
    const result = await updateFeedbackStatus(
      db,
      { userId: access.session.user.id, role: access.membership.role },
      access.membership.organizationId,
      id,
      await readJson(request),
    );
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
