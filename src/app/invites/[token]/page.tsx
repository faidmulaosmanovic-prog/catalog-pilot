import Link from "next/link";
import { Suspense } from "react";

import { AcceptInviteButton } from "@/components/account-forms";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm">Loading invite…</p>}>
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Organization invite</h1>
      <p className="text-sm">Sign in with the invited email, then accept.</p>
      <AcceptInviteButton token={token} />
      <Link className="text-sm underline" href="/login">
        Sign in
      </Link>
    </main>
  );
}
