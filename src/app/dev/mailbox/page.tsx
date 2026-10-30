import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { listAuthEmails } from "@/server/auth/email";

export default function MailboxPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm">Loading mailbox…</p>}>
      <Mailbox />
    </Suspense>
  );
}

async function Mailbox() {
  await connection();
  const emails = listAuthEmails();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Local mailbox</h1>
      <p className="text-sm text-zinc-500">
        Development only. Verification, reset, and invite links sent by this server.
      </p>
      {emails.length === 0 ? <p className="text-sm">No emails yet.</p> : null}
      <ul className="flex flex-col gap-3">
        {emails.map((email) => (
          <li key={`${email.sentAt}-${email.url}`} className="text-sm">
            <p>
              {email.kind} · {email.to}
            </p>
            <Link className="underline" href={email.url.replace(/^https?:\/\/[^/]+/, "")}>
              {email.subject}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
