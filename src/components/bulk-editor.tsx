"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const fieldClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

type ProductChoice = { id: string; sku: string; title: string | null; status: string };
type CategoryChoice = { id: string; name: string };

type Preview = {
  affectedCount: number;
  unchangedCount: number;
  skippedCount: number;
  samples: Array<{ productId: string; sku: string; before: Record<string, unknown>; after: Record<string, unknown> }>;
  skipped: Array<{ sku: string; reason: string }>;
};

const operations = [
  "replace_text",
  "append_text",
  "prepend_text",
  "update_price",
  "update_brand",
  "update_category",
  "update_attributes",
  "normalize",
  "update_status",
] as const;

export function BulkEditor({
  organizationId,
  products,
  categories,
  filter,
}: {
  organizationId: string;
  products: ProductChoice[];
  categories: CategoryChoice[];
  filter: { q?: string; status?: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [operation, setOperation] = useState<(typeof operations)[number]>("replace_text");
  const [field, setField] = useState("title");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [text, setText] = useState("");
  const [priceMode, setPriceMode] = useState("percent");
  const [priceValue, setPriceValue] = useState("10");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [attributeKey, setAttributeKey] = useState("");
  const [attributeValue, setAttributeValue] = useState("");
  const [status, setStatus] = useState("active");
  const [textCase, setTextCase] = useState("title");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const body = useMemo(() => {
    const config =
      operation === "replace_text"
        ? { field, find, replace }
        : operation === "append_text" || operation === "prepend_text"
          ? { field, text }
          : operation === "update_price"
            ? { mode: priceMode, value: Number(priceValue) }
            : operation === "update_brand"
              ? { brand: brand.trim() ? brand.trim() : null }
              : operation === "update_category"
                ? { categoryId: categoryId || null }
                : operation === "update_attributes"
                  ? { mode: "merge", attributes: attributeKey ? { [attributeKey]: attributeValue } : {} }
                  : operation === "normalize"
                    ? { field, trim: true, collapseWhitespace: true, case: textCase }
                    : { status };
    return {
      selectAllMatching,
      productIds: selectAllMatching ? undefined : selected,
      filter: selectAllMatching ? { q: filter.q, status: filter.status } : undefined,
      operation,
      config,
    };
  }, [
    attributeKey,
    attributeValue,
    brand,
    categoryId,
    field,
    filter.q,
    filter.status,
    find,
    operation,
    priceMode,
    priceValue,
    replace,
    selectAllMatching,
    selected,
    status,
    text,
    textCase,
  ]);

  const bodyKey = JSON.stringify(body);

  async function send(url: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-organization-id": organizationId,
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      preview?: Preview;
      job?: { id: string };
      error?: { message?: string };
    };
    return { ok: response.ok, data };
  }

  async function onPreview() {
    setPending(true);
    setError("");
    const result = await send("/api/v1/bulk-edits/preview");
    setPending(false);
    if (!result.ok || !result.data.preview) {
      setPreview(null);
      setError(result.data.error?.message ?? "Could not preview this edit");
      return;
    }
    setPreview(result.data.preview);
    setPreviewKey(bodyKey);
  }

  async function onApply() {
    setPending(true);
    setError("");
    const result = await send("/api/v1/bulk-edits");
    setPending(false);
    if (!result.ok || !result.data.job) {
      setError(result.data.error?.message ?? "Could not apply this edit");
      return;
    }
    router.push(`/app/bulk/${result.data.job.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={selectAllMatching}
          onChange={(event) => setSelectAllMatching(event.target.checked)}
        />
        All products matching this filter (up to 500)
      </label>
      {selectAllMatching ? null : (
        <ul className="max-h-64 divide-y divide-zinc-200 overflow-auto dark:divide-zinc-800">
          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-2 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(product.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, product.id]
                      : current.filter((id) => id !== product.id),
                  )
                }
              />
              <span className="font-medium">{product.sku}</span>
              <span className="text-zinc-500">{product.title || product.status}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <select className={fieldClass} value={operation} onChange={(event) => setOperation(event.target.value as (typeof operations)[number])}>
          {operations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {operation === "replace_text" || operation === "append_text" || operation === "prepend_text" || operation === "normalize" ? (
          <select className={fieldClass} value={field} onChange={(event) => setField(event.target.value)}>
            <option value="title">title</option>
            <option value="description">description</option>
            <option value="brand">brand</option>
          </select>
        ) : null}
        {operation === "replace_text" ? (
          <>
            <input className={fieldClass} placeholder="Find" value={find} onChange={(event) => setFind(event.target.value)} />
            <input className={fieldClass} placeholder="Replace" value={replace} onChange={(event) => setReplace(event.target.value)} />
          </>
        ) : null}
        {operation === "append_text" || operation === "prepend_text" ? (
          <input className={fieldClass} placeholder="Text" value={text} onChange={(event) => setText(event.target.value)} />
        ) : null}
        {operation === "update_price" ? (
          <>
            <select className={fieldClass} value={priceMode} onChange={(event) => setPriceMode(event.target.value)}>
              <option value="set">set</option>
              <option value="percent">percent</option>
              <option value="delta">delta</option>
            </select>
            <input className={fieldClass} value={priceValue} onChange={(event) => setPriceValue(event.target.value)} />
          </>
        ) : null}
        {operation === "update_brand" ? (
          <input className={fieldClass} placeholder="Brand" value={brand} onChange={(event) => setBrand(event.target.value)} />
        ) : null}
        {operation === "update_category" ? (
          <select className={fieldClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Clear category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}
        {operation === "update_attributes" ? (
          <>
            <input className={fieldClass} placeholder="Attribute" value={attributeKey} onChange={(event) => setAttributeKey(event.target.value)} />
            <input className={fieldClass} placeholder="Value" value={attributeValue} onChange={(event) => setAttributeValue(event.target.value)} />
          </>
        ) : null}
        {operation === "normalize" ? (
          <select className={fieldClass} value={textCase} onChange={(event) => setTextCase(event.target.value)}>
            <option value="none">case unchanged</option>
            <option value="lower">lower</option>
            <option value="upper">upper</option>
            <option value="title">title</option>
          </select>
        ) : null}
        {operation === "update_status" ? (
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button className={buttonClass} disabled={pending} type="button" onClick={() => void onPreview()}>
          Preview
        </button>
        <button
          className={buttonClass}
          disabled={pending || !preview || previewKey !== bodyKey || preview.affectedCount === 0}
          type="button"
          onClick={() => void onApply()}
        >
          {preview ? `Apply to ${preview.affectedCount} product${preview.affectedCount === 1 ? "" : "s"}` : "Apply"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {preview ? (
        <div className="text-sm">
          <p>
            {preview.affectedCount} would change · {preview.unchangedCount} unchanged · {preview.skippedCount} skipped
          </p>
          <ul className="mt-2 space-y-1">
            {preview.samples.map((sample) => (
              <li key={sample.productId}>
                {sample.sku}: {JSON.stringify(sample.before)} → {JSON.stringify(sample.after)}
              </li>
            ))}
            {preview.skipped.map((item) => (
              <li key={item.sku}>
                {item.sku}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link className="text-sm underline" href="/app/bulk">
        Back to bulk edits
      </Link>
    </div>
  );
}

export function RollbackBulkButton({ organizationId, jobId }: { organizationId: string; jobId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/v1/bulk-edits/${jobId}/rollback`, {
      method: "POST",
      headers: { "x-organization-id": organizationId },
      credentials: "include",
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: { message?: string } };
      setError(data.error?.message ?? "Could not undo this edit");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button className={buttonClass} disabled={pending} type="button" onClick={() => void onClick()}>
        {pending ? "Undoing…" : "Undo this edit"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
