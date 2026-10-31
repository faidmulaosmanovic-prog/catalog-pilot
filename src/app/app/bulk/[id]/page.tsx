import Link from "next/link";
import { Suspense } from "react";

import { RollbackBulkButton } from "@/components/bulk-editor";
import { canManageMembers } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { getBulkEdit } from "@/server/services/bulk";
import { ServiceError } from "@/server/services/organizations";

export default function BulkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm">Loading bulk edit…</p>}>
      <BulkDetail params={params} />
    </Suspense>
  );
}

async function BulkDetail({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before reviewing bulk edits.</p>;
  }
  const { id } = await params;
  let result: Awaited<ReturnType<typeof getBulkEdit>> | null = null;
  let error = "";
  try {
    result = await getBulkEdit(db, workspace.active.id, id);
  } catch (caught) {
    error = caught instanceof ServiceError ? caught.message : "Could not load this bulk edit";
  }
  const job = result?.job;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{job?.operation ?? "Bulk edit"}</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {job ? (
        <>
          <p className="text-sm">
            {job.status} · {job.productCount} product{job.productCount === 1 ? "" : "s"}
            {job.canRollback ? " · undo available" : ""}
          </p>
          <ul className="space-y-2 text-sm">
            {result?.changes.map((change) => (
              <li key={change.id}>
                <Link className="underline" href={`/app/products/${change.productId}`}>
                  {change.sku}
                </Link>
                : {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
              </li>
            ))}
          </ul>
          {job.canRollback && canManageMembers(workspace.active.role) ? (
            <RollbackBulkButton organizationId={workspace.active.id} jobId={job.id} />
          ) : null}
        </>
      ) : null}
      <Link className="text-sm underline" href="/app/bulk">
        Back to bulk edits
      </Link>
    </section>
  );
}
