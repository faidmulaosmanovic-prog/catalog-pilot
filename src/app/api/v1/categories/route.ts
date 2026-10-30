import { db } from "@/server/db/client";
import {
  jsonOk,
  readJson,
  requireCatalogAccess,
  serviceErrorResponse,
} from "@/server/http/api";
import { createCategory, listCategories } from "@/server/services/products";
import { z } from "zod";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    return access.response;
  }
  try {
    const categories = await listCategories(db, access.membership.organizationId);
    return jsonOk({ categories });
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
    const body = z.object({ name: z.string() }).parse(await readJson(request));
    const category = await createCategory(db, access.membership.organizationId, body.name);
    return jsonOk({ category }, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
