import { cookies, headers } from "next/headers";
import { Suspense } from "react";

import { InviteForm } from "@/components/account-forms";
import { ORG_COOKIE } from "@/server/auth/email";
import { canManageMembers } from "@/server/auth/roles";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import {
  getMembership,
  listMembers,
  listPendingInvites,
} from "@/server/services/organizations";

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading members…</p>}>
      <MembersContent />
    </Suspense>
  );
}

async function MembersContent() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const organizationId = (await cookies()).get(ORG_COOKIE)?.value;
  if (!organizationId) {
    return <p className="text-sm">Create or switch to an organization first.</p>;
  }
  const membership = await getMembership(db, session.user.id, organizationId);
  if (!membership) {
    return <p className="text-sm">That organization is not available.</p>;
  }
  const members = await listMembers(db, organizationId);
  const invites = await listPendingInvites(db, organizationId);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Members</h1>
      <ul className="flex flex-col gap-2 text-sm">
        {members.map((member) => (
          <li key={member.id}>
            {member.name} · {member.email} · {member.role}
          </li>
        ))}
      </ul>
      {invites.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm">
          <h2 className="font-medium">Pending invites</h2>
          <ul>
            {invites.map((invite) => (
              <li key={invite.id}>
                {invite.email} · {invite.role}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {canManageMembers(membership.role) ? (
        <InviteForm organizationId={organizationId} />
      ) : (
        <p className="text-sm">You can view members. Only owners and admins can invite.</p>
      )}
    </section>
  );
}
