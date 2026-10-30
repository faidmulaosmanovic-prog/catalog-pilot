import { Suspense } from "react";

import { ProductForm } from "@/components/product-forms";
import { canMutateCatalog } from "@/server/auth/roles";
import { activeWorkspace } from "@/server/http/workspace";

export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading form…</p>}>
      <NewProduct />
    </Suspense>
  );
}

async function NewProduct() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization first.</p>;
  }
  if (!canMutateCatalog(workspace.active.role)) {
    return <p className="text-sm">Your role can view products and cannot create them.</p>;
  }
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New product</h1>
      <ProductForm
        organizationId={workspace.active.id}
        canEdit
        initial={{
          sku: "",
          title: "",
          description: "",
          brand: "",
          price: "",
          currency: workspace.active.defaultCurrency,
          quantity: "",
          status: "draft",
          imageUrl: "",
        }}
      />
    </section>
  );
}
