"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const fieldClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

export function FeedbackForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("feedback");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/v1/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-organization-id": organizationId,
      },
      credentials: "include",
      body: JSON.stringify({ kind, title, body }),
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    setPending(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not save this note");
      return;
    }
    setTitle("");
    setBody("");
    router.refresh();
  }

  return (
    <form className="flex max-w-xl flex-col gap-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        Kind
        <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="feedback">Feedback</option>
          <option value="bug">Bug</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details
        <textarea className={fieldClass} value={body} onChange={(event) => setBody(event.target.value)} required maxLength={4000} rows={4} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}

const STATUSES = ["open", "triaged", "resolved", "wont_fix"] as const;

export function FeedbackStatusControl({
  organizationId,
  itemId,
  status,
}: {
  organizationId: string;
  itemId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onChange(next: string) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/v1/feedback/${itemId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-organization-id": organizationId,
      },
      credentials: "include",
      body: JSON.stringify({ status: next }),
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    setPending(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Could not update status");
      return;
    }
    router.refresh();
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      Status
      <select className={fieldClass} value={status} disabled={pending} onChange={(event) => onChange(event.target.value)}>
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      {error ? <span className="text-red-600">{error}</span> : null}
    </label>
  );
}
