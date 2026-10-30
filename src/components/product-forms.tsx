"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700";
const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

type ProductDraft = {
  sku: string;
  title: string;
  description: string;
  brand: string;
  price: string;
  currency: string;
  quantity: string;
  status: string;
  imageUrl: string;
};

async function sendJson(
  url: string,
  organizationId: string,
  body: unknown,
  method: string,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-organization-id": organizationId,
    },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text
    ? (JSON.parse(text) as { error?: { message?: string }; product?: { id: string } })
    : {};
  return { ok: response.ok, data };
}

function fieldsFromForm(form: FormData): ProductDraft {
  return {
    sku: String(form.get("sku") ?? ""),
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    brand: String(form.get("brand") ?? ""),
    price: String(form.get("price") ?? ""),
    currency: String(form.get("currency") ?? "USD"),
    quantity: String(form.get("quantity") ?? ""),
    status: String(form.get("status") ?? "draft"),
    imageUrl: String(form.get("imageUrl") ?? ""),
  };
}

function toPayload(draft: ProductDraft, includeImages: boolean) {
  return {
    sku: draft.sku,
    title: draft.title || null,
    description: draft.description || null,
    brand: draft.brand || null,
    price: draft.price || null,
    currency: draft.currency || "USD",
    quantity: draft.quantity === "" ? null : Number(draft.quantity),
    status: draft.status,
    ...(includeImages
      ? {
          images: draft.imageUrl
            ? [{ url: draft.imageUrl, position: 0, altText: draft.title || draft.sku }]
            : [],
        }
      : {}),
  };
}

export function ProductForm({
  organizationId,
  productId,
  initial,
  canEdit,
}: {
  organizationId: string;
  productId?: string;
  initial: ProductDraft;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setPending(true);
    setError("");
    const draft = fieldsFromForm(new FormData(event.currentTarget));
    const result = productId
      ? await sendJson(
          `/api/v1/products/${productId}`,
          organizationId,
          toPayload(draft, true),
          "PATCH",
        )
      : await sendJson("/api/v1/products", organizationId, toPayload(draft, true), "POST");
    setPending(false);
    if (!result.ok || !result.data.product) {
      setError(result.data.error?.message ?? "Could not save product");
      return;
    }
    router.push(`/app/products/${result.data.product.id}`);
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        SKU
        <input className={fieldClass} name="sku" defaultValue={initial.sku} required disabled={!canEdit} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input className={fieldClass} name="title" defaultValue={initial.title} disabled={!canEdit} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea className={fieldClass} name="description" defaultValue={initial.description} disabled={!canEdit} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Brand
        <input className={fieldClass} name="brand" defaultValue={initial.brand} disabled={!canEdit} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Price
          <input className={fieldClass} name="price" defaultValue={initial.price} disabled={!canEdit} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Currency
          <input className={fieldClass} name="currency" defaultValue={initial.currency} maxLength={3} disabled={!canEdit} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Quantity
        <input className={fieldClass} name="quantity" type="number" min={0} defaultValue={initial.quantity} disabled={!canEdit} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Status
        <select className={fieldClass} name="status" defaultValue={initial.status} disabled={!canEdit}>
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Image URL
        <input className={fieldClass} name="imageUrl" type="url" defaultValue={initial.imageUrl} disabled={!canEdit} />
      </label>
      {canEdit ? (
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Saving…" : productId ? "Save product" : "Create product"}
        </button>
      ) : (
        <p className="text-sm text-zinc-500">Viewers can read this product and cannot change it.</p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Link className="text-sm underline" href="/app/products">
        Back to products
      </Link>
    </form>
  );
}

export function DeleteProductButton({
  organizationId,
  productId,
}: {
  organizationId: string;
  productId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError("");
    const result = await sendJson(`/api/v1/products/${productId}`, organizationId, undefined, "DELETE");
    setPending(false);
    if (!result.ok && result.data.error) {
      setError(result.data.error.message ?? "Could not delete product");
      return;
    }
    router.push("/app/products");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button className={buttonClass} disabled={pending} type="button" onClick={onClick}>
        {pending ? "Deleting…" : "Delete product"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function VariantForm({
  organizationId,
  productId,
  initialSku,
  initialName,
  initialValue,
  initialPrice,
}: {
  organizationId: string;
  productId: string;
  initialSku: string;
  initialName: string;
  initialValue: string;
  initialPrice: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const sku = String(form.get("variantSku") ?? "").trim();
    const variants = sku
      ? [
          {
            sku,
            option1Name: String(form.get("optionName") ?? "") || null,
            option1Value: String(form.get("optionValue") ?? "") || null,
            price: String(form.get("variantPrice") ?? "") || null,
            status: "active",
          },
        ]
      : [];
    const result = await sendJson(
      `/api/v1/products/${productId}/variants`,
      organizationId,
      { variants },
      "PUT",
    );
    setPending(false);
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not save variants");
      return;
    }
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <h2 className="text-lg font-medium">Variant</h2>
      <input className={fieldClass} name="variantSku" placeholder="Variant SKU" defaultValue={initialSku} />
      <input className={fieldClass} name="optionName" placeholder="Option name" defaultValue={initialName} />
      <input className={fieldClass} name="optionValue" placeholder="Option value" defaultValue={initialValue} />
      <input className={fieldClass} name="variantPrice" placeholder="Variant price" defaultValue={initialPrice} />
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save variants"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
