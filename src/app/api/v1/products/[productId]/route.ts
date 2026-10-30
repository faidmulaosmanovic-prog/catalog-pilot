import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { getProduct, softDeleteProduct, updateProduct } from "@/server/services/products";
import { ServiceError } from "@/server/services/organizations";

type Context = { params: Promise<{ productId: string }> };

export async function GET(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { productId } = await context.params;
    const product = await getProduct(db, access.membership.organizationId, productId);
    if (!product) {
      throw new ServiceError(404, "NOT_FOUND", "Product not found");
    }
    return jsonOk({ product });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { productId } = await context.params;
    const product = await updateProduct(
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

export async function DELETE(request: Request, context: Context) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const { productId } = await context.params;
    await softDeleteProduct(
      db,
      access.session.user.id,
      access.membership.organizationId,
      productId,
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
