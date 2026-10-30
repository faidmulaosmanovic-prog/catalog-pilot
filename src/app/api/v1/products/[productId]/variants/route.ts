import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { replaceVariants } from "@/server/services/products";

type Context = { params: Promise<{ productId: string }> };

export async function PUT(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { productId } = await context.params;
    const product = await replaceVariants(
      db,
      access.session.user.id,
      access.membership.organizationId,
      productId,
      await readJson(request),
    );
    return jsonOk({ product });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
