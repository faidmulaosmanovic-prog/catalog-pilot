import Link from "next/link";
import { Suspense } from "react";

import { db } from "@/server/db/client";
import { canMutateCatalog } from "@/server/auth/roles";
import { activeWorkspace } from "@/server/http/workspace";
import { listImports } from "@/server/services/imports";

export default function ImportsPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading imports…</p>}>
      <ImportList />
    </Suspense>
  );
}

async function ImportList() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before importing a catalog.</p>;
  }
  let rows: Awaited<ReturnType<typeof listImports>> = [];
  let error = "";
  try {
    rows = await listImports(db, workspace.active.id);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load imports";
  }
  const canEdit = canMutateCatalog(workspace.active.role);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Imports</h1>
        {canEdit ? (
          <Link className="text-sm underline" href="/app/imports/new">
            New import
          </Link>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <p className="text-sm">
          No imports yet.
          {canEdit ? (
            <>
              {" "}
              <Link className="underline" href="/app/imports/new">
                Upload a CSV
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <Link className="font-medium underline" href={`/app/imports/${item.id}`}>
                  {item.fileName}
                </Link>
                <p className="text-zinc-500">
                  {item.status}
                  {item.successRows !== null ? ` · ${item.successRows} written` : ""}
                  {item.failedRows ? ` · ${item.failedRows} failed` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
