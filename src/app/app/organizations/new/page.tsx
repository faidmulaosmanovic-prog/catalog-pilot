import { Suspense } from "react";

import { CreateOrganizationForm } from "@/components/account-forms";

export default function NewOrganizationPage() {
  return (
    <Suspense>
      <section className="flex max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold">New organization</h1>
        <CreateOrganizationForm />
      </section>
    </Suspense>
  );
}
