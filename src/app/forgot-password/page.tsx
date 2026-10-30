import Link from "next/link";
import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/account-forms";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <ForgotPasswordForm />
        <Link className="text-sm underline" href="/login">
          Back to sign in
        </Link>
      </main>
    </Suspense>
  );
}
