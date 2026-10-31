import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { LogoutButton, OrganizationSwitcher } from "@/components/account-forms";
import { ORG_COOKIE } from "@/server/auth/email";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { listOrganizationsForUser } from "@/server/services/organizations";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-sm">Loading workspace…</p>}>
      <WorkspaceFrame>{children}</WorkspaceFrame>
    </Suspense>
  );
}

async function WorkspaceFrame({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  if (!session.user.emailVerified) {
    redirect("/verify-email");
  }

  const organizations = await listOrganizationsForUser(db, session.user.id);
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ORG_COOKIE)?.value ?? organizations[0]?.id ?? "";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{session.user.email}</p>
          <Link className="text-lg font-semibold" href="/app">
            CatalogPilot
          </Link>
        </div>
        <OrganizationSwitcher organizations={organizations} activeId={activeId} />
        <nav className="flex items-center gap-3 text-sm">
          <Link className="underline" href="/app/products">
            Products
          </Link>
          <Link className="underline" href="/app/imports">
            Imports
          </Link>
          <Link className="underline" href="/app/quality">
            Quality
          </Link>
          <Link className="underline" href="/app/bulk">
            Bulk edit
          </Link>
          <Link className="underline" href="/app/organizations/new">
            New organization
          </Link>
          <Link className="underline" href="/app/settings">
            Profile
          </Link>
          <Link className="underline" href="/app/settings/members">
            Members
          </Link>
          <LogoutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
