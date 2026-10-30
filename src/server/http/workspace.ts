import { cookies, headers } from "next/headers";

import { ORG_COOKIE } from "@/server/auth/email";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { listOrganizationsForUser } from "@/server/services/organizations";

export async function activeWorkspace() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) {
    return null;
  }
  const organizations = await listOrganizationsForUser(db, session.user.id);
  const activeId = (await cookies()).get(ORG_COOKIE)?.value;
  const active = organizations.find((organization) => organization.id === activeId) ?? organizations[0] ?? null;
  return { session, active };
}
