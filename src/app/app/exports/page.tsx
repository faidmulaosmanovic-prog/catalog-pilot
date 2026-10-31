import Link from "next/link";
import { Suspense } from "react";

import { canMutateCatalog } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listExports } from "@/server/services/exports";

export default function ExportsPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading exports…</p>}>
      <ExportList />
    </Suspense>
  );
}

async function ExportList() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before exporting a catalog.</p>;
  }
  let exports: Awaited<ReturnType<typeof listExports>>["exports"] = [];
  let error = "";
  try {
    exports = (await listExports(db, workspace.active.id)).exports;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load exports";
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Exports</h1>
        {canMutateCatalog(workspace.active.role) ? (
          <Link className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950" href="/app/exports/new">
            New export
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-zinc-500">
        CSV templates for Shopify and Amazon. This does not sync with either marketplace.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {exports.length === 0 && !error ? <p className="text-sm">No exports yet.</p> : null}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {exports.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <Link className="underline" href={`/app/exports/${job.id}`}>
              {job.channelCode}
            </Link>
            <span className="text-zinc-500">
              {job.status} · {job.productCount} product{job.productCount === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      <Link className="text-sm underline" href="/app/channels">
        View channels
      </Link>
    </section>
  );
}
