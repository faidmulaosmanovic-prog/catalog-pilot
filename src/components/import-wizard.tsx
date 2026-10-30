"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700";
const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

const TARGETS = [
  "sku",
  "title",
  "description",
  "brand",
  "price",
  "currency",
  "quantity",
  "barcode",
  "image_url",
  "status",
] as const;

type Suggestion = { sourceColumn: string; targetField: string; confidence: number };
type PreviewRow = {
  rowNumber: number;
  values: { sku?: string; title?: string };
  errors: string[];
  warnings: string[];
};

async function send(url: string, organizationId: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "x-organization-id": organizationId,
    },
    credentials: "include",
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  return { ok: response.ok, data };
}

export function ImportWizard({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [importId, setImportId] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState("create");
  const [warning, setWarning] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState("");

  async function onUpload(file: File) {
    setPending(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    const result = await send("/api/v1/imports/upload", organizationId, { method: "POST", body: form });
    setPending(false);
    if (!result.ok) {
      const message = (result.data.error as { message?: string } | undefined)?.message;
      setError(message ?? "Could not upload the file");
      return;
    }
    const body = result.data.import as {
      id: string;
      detection: { headers: string[] };
      suggestedMappings: Suggestion[];
      warnings?: string[];
    };
    const next: Record<string, string> = {};
    for (const suggestion of body.suggestedMappings) {
      next[suggestion.sourceColumn] = suggestion.targetField;
    }
    setImportId(body.id);
    setHeaders(body.detection.headers);
    setMapping(next);
    setWarning(body.warnings?.[0] ?? "");
  }

  async function onPreview() {
    setPending(true);
    setError("");
    const mappings = Object.entries(mapping)
      .filter(([, target]) => target)
      .map(([sourceColumn, targetField]) => ({ sourceColumn, targetField }));
    const saved = await send(`/api/v1/imports/${importId}/mapping`, organizationId, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mappings, mode }),
    });
    if (!saved.ok) {
      setPending(false);
      setError((saved.data.error as { message?: string } | undefined)?.message ?? "Could not save the mapping");
      return;
    }
    const result = await send(`/api/v1/imports/${importId}/preview`, organizationId, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 50 }),
    });
    setPending(false);
    if (!result.ok) {
      setError((result.data.error as { message?: string } | undefined)?.message ?? "Could not preview the import");
      return;
    }
    const rows = result.data.preview as PreviewRow[];
    const counts = result.data.summary as { fileRows: number; blockingCount: number };
    setPreview(rows);
    setSummary(`${counts.fileRows} rows in the file, ${counts.blockingCount} blocking in this preview.`);
  }

  async function onConfirm() {
    setPending(true);
    setError("");
    const result = await send(`/api/v1/imports/${importId}/confirm`, organizationId, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
    });
    setPending(false);
    if (!result.ok) {
      setError((result.data.error as { message?: string } | undefined)?.message ?? "Could not confirm the import");
      return;
    }
    router.push(`/app/imports/${importId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        CSV file
        <input
          className={fieldClass}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void onUpload(file);
            }
          }}
        />
      </label>
      {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}
      {headers.length > 0 ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Mode
            <select className={fieldClass} value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="create">create</option>
              <option value="upsert">upsert</option>
            </select>
          </label>
          {headers.map((header) => (
            <label key={header} className="flex flex-col gap-1 text-sm">
              {header}
              <select
                className={fieldClass}
                value={mapping[header] ?? ""}
                onChange={(event) => setMapping((current) => ({ ...current, [header]: event.target.value }))}
              >
                <option value="">Ignore</option>
                {TARGETS.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button className={buttonClass} disabled={pending} type="button" onClick={() => void onPreview()}>
            {pending ? "Working…" : "Preview"}
          </button>
        </div>
      ) : null}
      {summary ? <p className="text-sm">{summary}</p> : null}
      {preview.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1 text-sm">
            {preview.map((row) => (
              <li key={row.rowNumber}>
                Row {row.rowNumber}: {row.values.sku || "(no sku)"} {row.values.title || ""}
                {row.errors.length ? ` — ${row.errors.join(", ")}` : ""}
              </li>
            ))}
          </ul>
          <button className={buttonClass} disabled={pending} type="button" onClick={() => void onConfirm()}>
            {pending ? "Importing…" : "Confirm import"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function DownloadErrorsButton({
  organizationId,
  importId,
}: {
  organizationId: string;
  importId: string;
}) {
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    const response = await fetch(`/api/v1/imports/${importId}/errors`, {
      headers: { "x-organization-id": organizationId },
      credentials: "include",
    });
    if (!response.ok) {
      setError("Could not download the error report");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-errors.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <button className="text-left text-sm underline" type="button" onClick={() => void onClick()}>
        Download error report
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function RollbackImportButton({
  organizationId,
  importId,
}: {
  organizationId: string;
  importId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError("");
    const result = await send(`/api/v1/imports/${importId}/rollback`, organizationId, { method: "POST" });
    setPending(false);
    if (!result.ok) {
      setError((result.data.error as { message?: string } | undefined)?.message ?? "Could not roll back");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button className={buttonClass} disabled={pending} type="button" onClick={() => void onClick()}>
        {pending ? "Rolling back…" : "Roll back import"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
