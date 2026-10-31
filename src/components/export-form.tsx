"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const fieldClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

type ProductChoice = { id: string; sku: string; title: string | null };
type ChannelChoice = { code: string; name: string; templates: Array<{ version: string; name: string }> };

export function ExportForm({
  organizationId,
  products,
  channels,
  filter,
}: {
  organizationId: string;
  products: ProductChoice[];
  channels: ChannelChoice[];
  filter: { q?: string; status?: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [channelCode, setChannelCode] = useState(channels[0]?.code ?? "shopify");
  const channel = channels.find((item) => item.code === channelCode) ?? channels[0];
  const [templateVersion, setTemplateVersion] = useState(channel?.templates[0]?.version ?? "2026.1");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const countLabel = selectAllMatching ? "all matching products" : `${selected.length} product${selected.length === 1 ? "" : "s"}`;

  async function onExport() {
    setPending(true);
    setError("");
    const response = await fetch("/api/v1/exports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-organization-id": organizationId,
      },
      credentials: "include",
      body: JSON.stringify({
        channelCode,
        templateVersion,
        selectAllMatching,
        productIds: selectAllMatching ? undefined : selected,
        filter: selectAllMatching ? { q: filter.q, status: filter.status || undefined } : undefined,
      }),
    });
    const data = (await response.json()) as { export?: { id: string }; error?: { message?: string } };
    setPending(false);
    if (!response.ok || !data.export) {
      setError(data.error?.message ?? "Could not start the export");
      return;
    }
    router.push(`/app/exports/${data.export.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={selectAllMatching} onChange={(event) => setSelectAllMatching(event.target.checked)} />
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
                    event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id),
                  )
                }
              />
              <span className="font-medium">{product.sku}</span>
              <span className="text-zinc-500">{product.title}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          className={fieldClass}
          value={channelCode}
          onChange={(event) => {
            const next = channels.find((item) => item.code === event.target.value);
            setChannelCode(event.target.value);
            setTemplateVersion(next?.templates[0]?.version ?? "2026.1");
          }}
        >
          {channels.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        <select className={fieldClass} value={templateVersion} onChange={(event) => setTemplateVersion(event.target.value)}>
          {(channel?.templates ?? []).map((template) => (
            <option key={template.version} value={template.version}>
              {template.name} {template.version}
            </option>
          ))}
        </select>
      </div>
      {channelCode === "amazon" ? (
        <p className="text-sm text-zinc-500">
          Amazon generic inventory template (CatalogPilot). Category-specific Amazon flat files come later.
        </p>
      ) : null}
      <button
        className={buttonClass}
        disabled={pending || (!selectAllMatching && selected.length === 0)}
        type="button"
        onClick={() => void onExport()}
      >
        {pending ? "Exporting…" : `Export ${countLabel}`}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function DownloadExportButton({ organizationId, exportId }: { organizationId: string; exportId: string }) {
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    const response = await fetch(`/api/v1/exports/${exportId}/download`, {
      headers: { "x-organization-id": organizationId },
      credentials: "include",
    });
    if (!response.ok) {
      setError("Could not download this export");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `export-${exportId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <button className={buttonClass} type="button" onClick={() => void onClick()}>
        Download CSV
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
