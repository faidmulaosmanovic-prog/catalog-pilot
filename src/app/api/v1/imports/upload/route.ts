import { db } from "@/server/db/client";
import { jsonOk, requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { ServiceError } from "@/server/services/organizations";
import { uploadImport } from "@/server/services/imports";

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, true);
  if (!access.ok) {
    return access.response;
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ServiceError(400, "BAD_REQUEST", "Choose a CSV file");
    }
    const result = await uploadImport(db, access.session.user.id, access.membership.organizationId, {
      name: file.name,
      type: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return jsonOk(result, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
