import Link from "next/link";
import { Suspense } from "react";

import { BulkEditor } from "@/components/bulk-editor";
import { canMutateCatalog } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listCategories, listProducts } from "@/server/services/products";

export default function NewBulkPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm">Loading products…</p>}>
      <NewBulk searchParams={searchParams} />
    </Suspense>
  );
}

async function NewBulk({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before editing products in bulk.</p>;
  }
  if (!canMutateCatalog(workspace.active.role)) {
    return <p className="text-sm">You need editor access to run a bulk edit.</p>;
  }
  const query = await searchParams;
  const status = query.status === "draft" || query.status === "active" || query.status === "archived" ? query.status : undefined;
  let products: Awaited<ReturnType<typeof listProducts>>["data"] = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let error = "";
  try {
    products = (await listProducts(db, workspace.active.id, { q: query.q, status, limit: 100 })).data;
    categories = await listCategories(db, workspace.active.id);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load products";
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New bulk edit</h1>
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
      {products.length === 0 && !error ? (
        <p className="text-sm">
          No products match. <Link className="underline" href="/app/products/new">Add a product</Link> first.
        </p>
      ) : null}
      <BulkEditor
        organizationId={workspace.active.id}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          title: product.title,
          status: product.status,
        }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        filter={{ q: query.q, status }}
      />
    </section>
  );
}
