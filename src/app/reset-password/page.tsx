import Link from "next/link";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/account-forms";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm">Loading…</p>}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <ResetPasswordForm token={params.token ?? ""} />
      <Link className="text-sm underline" href="/login">
        Back to sign in
      </Link>
    </main>
  );
}
