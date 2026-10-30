import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { getProductHistory } from "@/server/services/products";

type Context = { params: Promise<{ productId: string }> };

export async function GET(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { productId } = await context.params;
    const history = await getProductHistory(db, access.membership.organizationId, productId);
    return jsonOk(history);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
