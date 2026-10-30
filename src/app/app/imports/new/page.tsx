import { Suspense } from "react";

import { ImportWizard } from "@/components/import-wizard";
import { canMutateCatalog } from "@/server/auth/roles";
import { activeWorkspace } from "@/server/http/workspace";

export default function NewImportPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading import…</p>}>
      <NewImport />
    </Suspense>
  );
}

async function NewImport() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization first.</p>;
  }
  if (!canMutateCatalog(workspace.active.role)) {
    return <p className="text-sm">Your role can view imports and cannot upload a file.</p>;
  }
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Import CSV</h1>
      <ImportWizard organizationId={workspace.active.id} />
    </section>
  );
}
