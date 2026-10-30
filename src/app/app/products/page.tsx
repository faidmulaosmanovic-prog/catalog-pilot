import Link from "next/link";
import { Suspense } from "react";

import { db } from "@/server/db/client";
import { canMutateCatalog } from "@/server/auth/roles";
import { activeWorkspace } from "@/server/http/workspace";
import { listProducts } from "@/server/services/products";

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm">Loading products…</p>}>
      <ProductList searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return (
      <p className="text-sm">
        Create an organization before adding products.{" "}
        <Link className="underline" href="/app/organizations/new">
          New organization
        </Link>
      </p>
    );
  }

  const query = await searchParams;
  let products: Awaited<ReturnType<typeof listProducts>>["data"] = [];
  let error = "";
  try {
    const result = await listProducts(db, workspace.active.id, {
      q: query.q,
      status: query.status || undefined,
      limit: 50,
    });
    products = result.data;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load products";
  }

  const canEdit = canMutateCatalog(workspace.active.role);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        {canEdit ? (
          <Link className="text-sm underline" href="/app/products/new">
            New product
          </Link>
        ) : null}
      </div>
      <form className="flex flex-wrap gap-2" method="get">
        <input
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="q"
          placeholder="Search title or SKU"
          defaultValue={query.q ?? ""}
        />
        <select
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="status"
          defaultValue={query.status ?? ""}
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
          No products yet.
          {canEdit ? (
            <>
              {" "}
              <Link className="underline" href="/app/products/new">
                Add the first product
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {products.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <Link className="font-medium underline" href={`/app/products/${product.id}`}>
                  {product.title || product.sku}
                </Link>
                <p className="text-zinc-500">
                  {product.sku} · {product.status}
                  {product.price ? ` · ${product.price} ${product.currency}` : ""}
                  {product.imageCount ? ` · ${product.imageCount} image` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
