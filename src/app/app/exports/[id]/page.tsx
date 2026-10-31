import Link from "next/link";
import { Suspense } from "react";

import { DownloadExportButton } from "@/components/export-form";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { getExport } from "@/server/services/exports";
import { ServiceError } from "@/server/services/organizations";

export default function ExportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm">Loading export…</p>}>
      <ExportDetail params={params} />
    </Suspense>
  );
}

async function ExportDetail({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before reviewing exports.</p>;
  }
  const { id } = await params;
  let result: Awaited<ReturnType<typeof getExport>> | null = null;
  let error = "";
  try {
    result = await getExport(db, workspace.active.id, id);
  } catch (caught) {
    error = caught instanceof ServiceError ? caught.message : "Could not load this export";
  }
  const job = result?.export;
  const report = job?.errorReport as { errors?: Array<{ sku?: string; message: string }>; warnings?: unknown[] } | null;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{job ? `${job.channelCode} ${job.templateVersion ?? ""}` : "Export"}</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {job ? (
        <>
          <p className="text-sm">
            {job.status} · {job.productCount} product{job.productCount === 1 ? "" : "s"}
          </p>
          {report?.errors && report.errors.length > 0 ? (
            <ul className="space-y-1 text-sm text-red-600">
              {report.errors.map((issue, index) => (
                <li key={`${issue.sku}-${index}`}>
                  {issue.sku ? `${issue.sku}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          {job.status === "completed" ? (
            <DownloadExportButton organizationId={workspace.active.id} exportId={job.id} />
          ) : null}
        </>
      ) : null}
      <Link className="text-sm underline" href="/app/exports">
        Back to exports
      </Link>
    </section>
  );
}
