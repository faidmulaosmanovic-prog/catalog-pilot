import { Suspense } from "react";

import { FeedbackForm, FeedbackStatusControl } from "@/components/feedback-form";
import { canManageMembers } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listFeedback } from "@/server/services/feedback";

export default function FeedbackPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading feedback…</p>}>
      <FeedbackBoard />
    </Suspense>
  );
}

async function FeedbackBoard() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before leaving feedback.</p>;
  }
  let items: Awaited<ReturnType<typeof listFeedback>>["items"] = [];
  let error = "";
  try {
    items = (await listFeedback(db, workspace.active.id)).items;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load notes";
  }
  const canTriage = canManageMembers(workspace.active.role);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="max-w-xl text-sm text-zinc-500">
          Leave product feedback or report a bug. Owners and admins move notes through open, triaged, resolved, and wont_fix.
        </p>
      </div>
      <FeedbackForm organizationId={workspace.active.id} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {items.length === 0 && !error ? <p className="text-sm">No notes yet.</p> : null}
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <p className="font-medium">
              {item.kind} · {item.title}
            </p>
            <p className="whitespace-pre-wrap">{item.body}</p>
            <p className="text-zinc-500">{item.createdAt.slice(0, 10)}</p>
            {canTriage ? (
              <FeedbackStatusControl itemId={item.id} organizationId={workspace.active.id} status={item.status} />
            ) : (
              <p className="text-zinc-500">Status: {item.status}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
