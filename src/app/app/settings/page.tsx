import { headers } from "next/headers";
import { Suspense } from "react";

import { ProfileForm } from "@/components/account-forms";
import { auth } from "@/server/auth/auth";

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading profile…</p>}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return (
    <section className="flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-sm text-zinc-500">{session.user.email}</p>
      <ProfileForm name={session.user.name} />
    </section>
  );
}
