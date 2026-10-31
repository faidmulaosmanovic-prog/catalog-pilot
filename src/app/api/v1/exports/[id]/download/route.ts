import { db } from "@/server/db/client";
import { requireCatalogAccess, serviceErrorResponse } from "@/server/http/api";
import { verifyExportDownload } from "@/server/exports/download-token";
import { readExportFile, readExportFileById } from "@/server/services/exports";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const url = new URL(request.url);
  try {
    const file = verifyExportDownload(id, url.searchParams.get("expires"), url.searchParams.get("token"))
      ? await readExportFileById(db, id)
      : await authorizedFile(request, id);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      return error.response;
    }
    return serviceErrorResponse(error);
  }
}

async function authorizedFile(request: Request, id: string) {
  const access = await requireCatalogAccess(request, false);
  if (!access.ok) {
    throw new ResponseError(access.response);
  }
  return readExportFile(db, access.membership.organizationId, id);
}

class ResponseError extends Error {
  constructor(readonly response: Response) {
    super("Export download was denied");
  }
}
