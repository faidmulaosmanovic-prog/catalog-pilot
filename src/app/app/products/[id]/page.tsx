import { Suspense } from "react";

import { DeleteProductButton, ProductForm, VariantForm } from "@/components/product-forms";
import { canMutateCatalog } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { getProduct, getProductHistory } from "@/server/services/products";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm">Loading product…</p>}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await activeWorkspace();
  const { id } = await params;
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization first.</p>;
  }
  const product = await getProduct(db, workspace.active.id, id);
  if (!product) {
    return <p className="text-sm text-red-600">Product not found.</p>;
  }
  const history = await getProductHistory(db, workspace.active.id, id);
  const canEdit = canMutateCatalog(workspace.active.role);
  const firstVariant = product.variants[0];
  const firstImage = product.images[0];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{product.title || product.sku}</h1>
      {firstImage ? (
        // External catalog image URLs are stored as the merchant entered them.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={firstImage.altText ?? product.sku} className="h-40 w-40 rounded-md object-cover" src={firstImage.url} />
      ) : (
        <p className="text-sm text-zinc-500">No image yet.</p>
      )}
      <ProductForm
        organizationId={workspace.active.id}
        productId={product.id}
        canEdit={canEdit}
        initial={{
          sku: product.sku,
          title: product.title ?? "",
          description: product.description ?? "",
          brand: product.brand ?? "",
          price: product.price ?? "",
          currency: product.currency,
          quantity: product.quantity === null ? "" : String(product.quantity),
          status: product.status,
          imageUrl: firstImage?.url ?? "",
        }}
      />
      {canEdit ? (
        <VariantForm
          organizationId={workspace.active.id}
          productId={product.id}
          initialSku={firstVariant?.sku ?? ""}
          initialName={firstVariant?.option1Name ?? ""}
          initialValue={firstVariant?.option1Value ?? ""}
          initialPrice={firstVariant?.price ?? ""}
        />
      ) : null}
      {canEdit ? <DeleteProductButton organizationId={workspace.active.id} productId={product.id} /> : null}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">History</h2>
        {history.revisions.length === 0 ? (
          <p className="text-sm">No revisions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {history.revisions.map((revision) => (
              <li key={revision.id}>
                Revision {revision.revision} · {revision.changeSource ?? "manual"} · {revision.createdAt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
