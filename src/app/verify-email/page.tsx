import Link from "next/link";
import { Suspense } from "react";

import { VerifyEmailForm } from "@/components/account-forms";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm">Loading…</p>}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Verify email</h1>
      <VerifyEmailForm token={params.token ?? ""} />
      <Link className="text-sm underline" href="/login">
        Sign in
      </Link>
      {process.env.NODE_ENV === "development" ? (
        <Link className="text-sm underline" href="/dev/mailbox">
          Open the local mailbox
        </Link>
      ) : null}
    </main>
  );
}
