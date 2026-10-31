import Link from "next/link";
import { Suspense } from "react";

import { canMutateCatalog } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listBulkEdits } from "@/server/services/bulk";

export default function BulkPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading bulk edits…</p>}>
      <BulkList />
    </Suspense>
  );
}

async function BulkList() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before editing products in bulk.</p>;
  }
  let jobs: Awaited<ReturnType<typeof listBulkEdits>>["jobs"] = [];
  let error = "";
  try {
    jobs = (await listBulkEdits(db, workspace.active.id)).jobs;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load bulk edits";
  }
  const canEdit = canMutateCatalog(workspace.active.role);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Bulk edits</h1>
        {canEdit ? (
          <Link className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950" href="/app/bulk/new">
            New bulk edit
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {jobs.length === 0 && !error ? <p className="text-sm">No bulk edits yet.</p> : null}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <Link className="underline" href={`/app/bulk/${job.id}`}>
              {job.operation}
            </Link>
            <span className="text-zinc-500">
              {job.status} · {job.productCount} product{job.productCount === 1 ? "" : "s"}
              {job.canRollback ? " · can undo" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
