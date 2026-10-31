import Link from "next/link";
import { Suspense } from "react";

import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listChannels } from "@/server/services/exports";

export default function ChannelsPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading channels…</p>}>
      <ChannelList />
    </Suspense>
  );
}

async function ChannelList() {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before viewing channels.</p>;
  }
  const { channels } = await listChannels(db);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Channels</h1>
      <p className="text-sm text-zinc-500">
        File export only. CatalogPilot does not connect to Shopify or Amazon APIs.
      </p>
      <ul className="space-y-4">
        {channels.map((channel) => (
          <li key={channel.id}>
            <h2 className="font-medium">
              {channel.name} · {channel.type}
            </h2>
            <ul className="mt-1 text-sm text-zinc-500">
              {channel.templates.map((template) => (
                <li key={template.id}>
                  {template.name} {template.version}
                  {template.isDefault ? " · default" : ""} · {template.headers.length} columns
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <Link className="text-sm underline" href="/app/exports/new">
        New export
      </Link>
    </section>
  );
}
