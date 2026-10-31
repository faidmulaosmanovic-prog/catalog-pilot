import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { createProduct, listProducts } from "@/server/services/products";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  const url = new URL(request.url);
  try {
    const result = await listProducts(db, access.membership.organizationId, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      brand: url.searchParams.get("brand") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      minScore: url.searchParams.get("minScore") ?? undefined,
      maxScore: url.searchParams.get("maxScore") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      hasIssues: url.searchParams.get("hasIssues") ?? undefined,
    });
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const product = await createProduct(
      db,
      access.session.user.id,
      access.membership.organizationId,
      await readJson(request),
    );
    return jsonOk({ product }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
