import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/account-forms";

export default function LoginPage() {
  return (
    <Suspense>
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <LoginForm />
        <Link className="text-sm underline" href="/forgot-password">
          Forgot password
        </Link>
        <Link className="text-sm underline" href="/register">
          Create an account
        </Link>
      </main>
    </Suspense>
  );
}
