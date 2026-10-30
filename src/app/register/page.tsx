import Link from "next/link";
import { Suspense } from "react";

import { RegisterForm } from "@/components/account-forms";

export default function RegisterPage() {
  return (
    <Suspense>
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <RegisterForm />
        <Link className="text-sm underline" href="/login">
          Already have an account? Sign in
        </Link>
      </main>
    </Suspense>
  );
}
