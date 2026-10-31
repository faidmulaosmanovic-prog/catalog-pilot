import Link from "next/link";
import { Suspense } from "react";

import { ExportForm } from "@/components/export-form";
import { canMutateCatalog } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listChannels } from "@/server/services/exports";
import { listProducts } from "@/server/services/products";

export default function NewExportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm">Loading products…</p>}>
      <NewExport searchParams={searchParams} />
    </Suspense>
  );
}

async function NewExport({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before exporting a catalog.</p>;
  }
  if (!canMutateCatalog(workspace.active.role)) {
    return <p className="text-sm">You need editor access to export.</p>;
  }
  const query = await searchParams;
  const status = query.status === "draft" || query.status === "active" || query.status === "archived" ? query.status : undefined;
  let products: Awaited<ReturnType<typeof listProducts>>["data"] = [];
  let channels: Awaited<ReturnType<typeof listChannels>>["channels"] = [];
  let error = "";
  try {
    products = (await listProducts(db, workspace.active.id, { q: query.q, status, limit: 100 })).data;
    channels = (await listChannels(db)).channels;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load products";
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New export</h1>
      <form className="flex flex-wrap gap-2" method="get">
        <input
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="q"
          placeholder="Search SKU or title"
          defaultValue={query.q ?? ""}
        />
        <select
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="status"
          defaultValue={status ?? ""}
        >
          <option value="">Any status</option>
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" type="submit">
          Filter
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ExportForm
        organizationId={workspace.active.id}
        products={products.map((product) => ({ id: product.id, sku: product.sku, title: product.title }))}
        channels={channels.map((channel) => ({
          code: channel.code,
          name: channel.name,
          templates: channel.templates.map((template) => ({ version: template.version, name: template.name })),
        }))}
        filter={{ q: query.q, status }}
      />
      <Link className="text-sm underline" href="/app/exports">
        Back to exports
      </Link>
    </section>
  );
}
