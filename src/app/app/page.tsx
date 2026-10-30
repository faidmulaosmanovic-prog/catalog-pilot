import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";

import { ORG_COOKIE } from "@/server/auth/email";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { listOrganizationsForUser } from "@/server/services/organizations";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading organizations…</p>}>
      <WorkspaceHome />
    </Suspense>
  );
}

async function WorkspaceHome() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const organizations = await listOrganizationsForUser(db, session.user.id);
  const activeId = (await cookies()).get(ORG_COOKIE)?.value;
  const active = organizations.find((org) => org.id === activeId) ?? organizations[0];

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Workspace</h1>
      {active ? (
        <p className="text-sm">
          Active organization: <span className="font-medium">{active.name}</span> ({active.role}).{" "}
          <Link className="underline" href="/app/products">
            Open products
          </Link>
        </p>
      ) : (
        <p className="text-sm">
          You do not have an organization yet.{" "}
          <Link className="underline" href="/app/organizations/new">
            Create one
          </Link>
        </p>
      )}
    </section>
  );
}
