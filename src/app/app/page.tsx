import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { and, eq, isNull, sql } from "drizzle-orm";

import { ORG_COOKIE } from "@/server/auth/email";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { products } from "@/server/db/schema/catalog";
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
  const [countRow] = active
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(eq(products.organizationId, active.id), isNull(products.deletedAt)))
    : [{ count: 0 }];
  const productCount = Number(countRow?.count ?? 0);

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Workspace</h1>
      {active ? (
        <>
          <p className="text-sm">
            Active organization: <span className="font-medium">{active.name}</span> ({active.role}).{" "}
            <Link className="underline" href="/app/products">
              Open products
            </Link>
          </p>
          {productCount === 0 ? (
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              <li>
                <a className="underline" href="/samples/catalog-sample.csv">
                  Download the sample CSV
                </a>
              </li>
              <li>
                <Link className="underline" href="/app/imports/new">
                  Import it
                </Link>
              </li>
              <li>
                <Link className="underline" href="/app/quality">
                  Review data quality
                </Link>
              </li>
              <li>
                <Link className="underline" href="/app/exports/new">
                  Export a Shopify or Amazon CSV
                </Link>
              </li>
            </ol>
          ) : (
            <p className="text-sm">{productCount} product{productCount === 1 ? "" : "s"} in this catalog.</p>
          )}
        </>
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
