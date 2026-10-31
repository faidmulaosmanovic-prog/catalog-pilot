import Link from "next/link";
import { Suspense } from "react";

import { IgnoreIssueButton, RuleEditor, RunValidationButton } from "@/components/quality-panel";
import { canManageMembers, canMutateCatalog } from "@/server/auth/roles";
import { db } from "@/server/db/client";
import { activeWorkspace } from "@/server/http/workspace";
import { listEffectiveRules, listIssues, validationSummary } from "@/server/services/quality";

export default function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string; ruleCode?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm">Loading data quality…</p>}>
      <QualityScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function QualityScreen({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string; ruleCode?: string }>;
}) {
  const workspace = await activeWorkspace();
  if (!workspace?.active) {
    return <p className="text-sm">Create an organization before reviewing data quality.</p>;
  }
  const query = await searchParams;
  const status = query.status || "open";
  let error = "";
  let summary: Awaited<ReturnType<typeof validationSummary>>["summary"] | null = null;
  let issues: Awaited<ReturnType<typeof listIssues>>["issues"] = [];
  let rules: Awaited<ReturnType<typeof listEffectiveRules>> = [];
  try {
    summary = (await validationSummary(db, workspace.active.id)).summary;
    issues = (
      await listIssues(db, workspace.active.id, {
        severity: query.severity || undefined,
        status,
        ruleCode: query.ruleCode || undefined,
        limit: 50,
      })
    ).issues;
    rules = await listEffectiveRules(db, workspace.active.id);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load data quality";
  }
  const canEdit = canMutateCatalog(workspace.active.role);
  const canConfigure = canManageMembers(workspace.active.role);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Data quality</h1>
        {canEdit ? <RunValidationButton organizationId={workspace.active.id} /> : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {summary ? (
        <p className="text-sm">
          Average score {summary.averageScore ?? "—"} · {summary.openBySeverity.critical} critical ·{" "}
          {summary.openBySeverity.error} errors · {summary.openBySeverity.warning} warnings ·{" "}
          {summary.openBySeverity.info} info
        </p>
      ) : null}
      <form className="flex flex-wrap gap-2" method="get">
        <select
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="severity"
          defaultValue={query.severity ?? ""}
        >
          <option value="">Any severity</option>
          <option value="critical">critical</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
        <select
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="status"
          defaultValue={status}
        >
          <option value="open">open</option>
          <option value="ignored">ignored</option>
          <option value="resolved">resolved</option>
        </select>
        <input
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          name="ruleCode"
          placeholder="Rule code"
          defaultValue={query.ruleCode ?? ""}
        />
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" type="submit">
          Filter
        </button>
      </form>
      {issues.length === 0 && !error ? (
        <p className="text-sm">No issues match this filter.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <Link className="font-medium underline" href={`/app/products/${issue.productId}`}>
                  {issue.title || issue.sku}
                </Link>
                <p className="text-zinc-500">
                  {issue.severity} · {issue.ruleCode} · {issue.message}
                </p>
              </div>
              {canEdit && issue.status === "open" && issue.severity !== "critical" ? (
                <IgnoreIssueButton organizationId={workspace.active.id} issueId={issue.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canConfigure ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Rules</h2>
          {rules.map((rule) => (
            <RuleEditor
              key={rule.code}
              organizationId={workspace.active.id}
              code={rule.code}
              severity={rule.severity}
              isEnabled={rule.isEnabled}
              minSeverity={rule.minSeverity}
              maxSeverity={rule.maxSeverity}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
