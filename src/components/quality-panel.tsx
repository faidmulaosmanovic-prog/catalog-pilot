"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

async function send(url: string, organizationId: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-organization-id": organizationId,
    },
    credentials: "include",
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: { message?: string } }) : {};
  return { ok: response.ok, data };
}

export function RunValidationButton({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError("");
    const result = await send("/api/v1/validation/runs", organizationId, { scope: "all" });
    setPending(false);
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not run validation");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button className={buttonClass} disabled={pending} type="button" onClick={() => void onClick()}>
        {pending ? "Running…" : "Run validation"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function IgnoreIssueButton({
  organizationId,
  issueId,
}: {
  organizationId: string;
  issueId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    const result = await send(`/api/v1/validation/issues/${issueId}/ignore`, organizationId);
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not ignore this issue");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button className="text-sm underline" type="button" onClick={() => void onClick()}>
        Ignore
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

export function RuleEditor({
  organizationId,
  code,
  severity,
  isEnabled,
  minSeverity,
  maxSeverity,
}: {
  organizationId: string;
  code: string;
  severity: string;
  isEnabled: boolean;
  minSeverity: string;
  maxSeverity: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const ranks = ["info", "warning", "error", "critical"];
  const options = ranks.filter(
    (item) => ranks.indexOf(item) >= ranks.indexOf(minSeverity) && ranks.indexOf(item) <= ranks.indexOf(maxSeverity),
  );

  async function save(next: { isEnabled?: boolean; severity?: string }) {
    setError("");
    const response = await fetch(`/api/v1/validation/rules/${code}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-organization-id": organizationId,
      },
      credentials: "include",
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: { message?: string } };
      setError(data.error?.message ?? "Could not update the rule");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="w-40 font-medium">{code}</span>
      <select
        className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        defaultValue={severity}
        onChange={(event) => void save({ severity: event.target.value })}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          defaultChecked={isEnabled}
          onChange={(event) => void save({ isEnabled: event.target.checked })}
        />
        Enabled
      </label>
      {error ? <span className="text-red-600">{error}</span> : null}
    </div>
  );
}
