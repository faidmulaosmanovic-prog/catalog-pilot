import Link from "next/link";
import { Suspense } from "react";

import { DownloadErrorsButton, RollbackImportButton } from "@/components/import-wizard";
import { canManageMembers } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { getImport } from "@/server/services/imports";
import { ServiceError } from "@/server/services/organizations";

export default function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm">Loading import…</p>}>
      <ImportDetail params={params} />
    </Suspense>
  );
}

async function ImportDetail({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await activeWorkspace();
  const { id } = await params;
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization first.</p>;
  }
  let item: Awaited<ReturnType<typeof getImport>>["import"] | null = null;
  let error = "";
  try {
    item = (await getImport(db, workspace.active.id, id)).import;
  } catch (caught) {
    error = caught instanceof ServiceError ? caught.message : "Could not load this import.";
  }
  if (!item) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{item.fileName}</h1>
      <p className="text-sm">
        {item.status} · {item.mode}
        {item.totalRows !== null ? ` · ${item.totalRows} rows` : ""}
        {item.successRows !== null ? ` · ${item.successRows} written` : ""}
        {item.failedRows ? ` · ${item.failedRows} failed` : ""}
      </p>
      {item.failedRows ? (
        <DownloadErrorsButton organizationId={workspace.active.id} importId={item.id} />
      ) : null}
      {item.status === "completed" && canManageMembers(workspace.active.role) ? (
        <RollbackImportButton organizationId={workspace.active.id} importId={item.id} />
      ) : null}
      <Link className="text-sm underline" href="/app/imports">
        Back to imports
      </Link>
    </section>
  );
}
