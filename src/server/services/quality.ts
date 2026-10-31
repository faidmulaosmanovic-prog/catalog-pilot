import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/server/db/client";
import {
  productAttributes,
  productImages,
  productVariants,
  products,
} from "@/server/db/schema/catalog";
import {
  SEVERITIES,
  SEVERITY_RANK,
  VALIDATION_SCOPES,
  type IssueStatus,
  type MemberRole,
  type Severity,
  type ValidationScope,
} from "@/server/db/schema/constants";
import { validationIssues, validationRules, validationRuns } from "@/server/db/schema/quality";
import { evaluateProduct, qualityScore, type Finding, type RuleView } from "@/server/quality/rules";
import { recordActivity } from "@/server/services/activity-log";
import { createJobRun, updateJobRunStatus } from "@/server/services/job-runs";
import { ServiceError } from "@/server/services/organizations";

const runSchema = z.object({
  scope: z.enum(VALIDATION_SCOPES).default("all"),
  productIds: z.array(z.uuid()).max(500).optional(),
});

const rulePatchSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    severity: z.enum(SEVERITIES).optional(),
  })
  .refine((value) => value.isEnabled !== undefined || value.severity !== undefined, {
    message: "Nothing to update",
  });

type RuleRow = typeof validationRules.$inferSelect;

function boundsOf(config: RuleRow["configJson"]) {
  const min = config?.minSeverity;
  const max = config?.maxSeverity;
  if (!min || !max || !(min in SEVERITY_RANK) || !(max in SEVERITY_RANK)) {
    return { min: "info" as Severity, max: "critical" as Severity };
  }
  return { min: min as Severity, max: max as Severity };
}

function severityAllowed(severity: Severity, config: RuleRow["configJson"]) {
  const bounds = boundsOf(config);
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[bounds.min] && SEVERITY_RANK[severity] <= SEVERITY_RANK[bounds.max];
}

function publicRule(rule: RuleRow, source: "system" | "organization") {
  const bounds = boundsOf(rule.configJson);
  return {
    code: rule.code,
    name: rule.name,
    description: rule.description,
    severity: rule.severity,
    isEnabled: rule.isEnabled,
    minSeverity: bounds.min,
    maxSeverity: bounds.max,
    source,
  };
}

async function loadRuleRows(db: Database, organizationId: string) {
  return db
    .select()
    .from(validationRules)
    .where(or(isNull(validationRules.organizationId), eq(validationRules.organizationId, organizationId)));
}

export async function listEffectiveRules(db: Database, organizationId: string) {
  const rows = await loadRuleRows(db, organizationId);
  const byCode = new Map<string, { rule: RuleRow; source: "system" | "organization" }>();
  for (const rule of rows) {
    if (rule.organizationId === null) {
      byCode.set(rule.code, { rule, source: "system" });
    }
  }
  for (const rule of rows) {
    if (rule.organizationId === organizationId) {
      byCode.set(rule.code, { rule, source: "organization" });
    }
  }
  return [...byCode.values()]
    .map((entry) => publicRule(entry.rule, entry.source))
    .sort((left, right) => left.code.localeCompare(right.code));
}

export async function updateRule(
  db: Database,
  organizationId: string,
  code: string,
  input: unknown,
) {
  const data = rulePatchSchema.parse(input);
  const rows = await loadRuleRows(db, organizationId);
  const system = rows.find((rule) => rule.organizationId === null && rule.code === code);
  const override = rows.find((rule) => rule.organizationId === organizationId && rule.code === code);
  const base = override ?? system;
  if (!base) {
    throw new ServiceError(404, "NOT_FOUND", "Rule not found");
  }
  const nextSeverity = (data.severity ?? base.severity) as Severity;
  if (!severityAllowed(nextSeverity, system?.configJson ?? base.configJson)) {
    throw new ServiceError(400, "BAD_REQUEST", "Severity is outside the allowed range for this rule");
  }
  if (override) {
    await db
      .update(validationRules)
      .set({
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
        severity: nextSeverity,
      })
      .where(eq(validationRules.id, override.id));
  } else if (system) {
    await db.insert(validationRules).values({
      organizationId,
      code: system.code,
      name: system.name,
      description: system.description,
      severity: nextSeverity,
      isEnabled: data.isEnabled ?? system.isEnabled,
      configJson: system.configJson,
    });
  }
  const [updated] = (await listEffectiveRules(db, organizationId)).filter((rule) => rule.code === code);
  return { rule: updated };
}

async function syncProductIssues(
  db: Database,
  organizationId: string,
  productId: string,
  runId: string,
  findings: Finding[],
  existing: Array<typeof validationIssues.$inferSelect>,
) {
  const byCode = new Map(findings.map((finding) => [finding.ruleCode, finding]));
  const ignored = new Set(
    existing
      .filter((issue) => issue.status === "ignored" && byCode.has(issue.ruleCode))
      .map((issue) => issue.ruleCode),
  );
  for (const issue of existing) {
    const finding = byCode.get(issue.ruleCode);
    if (!finding) {
      if (issue.status !== "resolved") {
        await db
          .update(validationIssues)
          .set({ status: "resolved", resolvedAt: new Date(), runId })
          .where(eq(validationIssues.id, issue.id));
      }
      continue;
    }
    if (issue.status === "open") {
      await db
        .update(validationIssues)
        .set({
          severity: finding.severity,
          message: finding.message,
          field: finding.field,
          runId,
        })
        .where(eq(validationIssues.id, issue.id));
    }
    byCode.delete(issue.ruleCode);
  }
  const fresh = [...byCode.values()];
  if (fresh.length > 0) {
    await db.insert(validationIssues).values(
      fresh.map((finding) => ({
        organizationId,
        productId,
        ruleCode: finding.ruleCode,
        severity: finding.severity,
        message: finding.message,
        field: finding.field,
        status: "open" as const,
        runId,
      })),
    );
  }
  return qualityScore(findings.filter((finding) => !ignored.has(finding.ruleCode)));
}

export async function runValidation(db: Database, actorUserId: string, organizationId: string, input: unknown) {
  const data = runSchema.parse(input);
  if (data.scope === "selection" && (!data.productIds || data.productIds.length === 0)) {
    throw new ServiceError(400, "BAD_REQUEST", "Choose at least one product");
  }
  const rules = await listEffectiveRules(db, organizationId);
  const ruleViews: RuleView[] = rules.map((rule) => ({
    code: rule.code,
    severity: rule.severity as Severity,
    isEnabled: rule.isEnabled,
  }));
  const active = await db
    .select({
      id: products.id,
      sku: products.sku,
      title: products.title,
      description: products.description,
      brand: products.brand,
      price: products.price,
      barcode: products.barcode,
    })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), isNull(products.deletedAt)));
  const target =
    data.scope === "all"
      ? active
      : active.filter((product) => data.productIds?.includes(product.id));
  if (data.scope === "selection" && target.length === 0) {
    throw new ServiceError(404, "NOT_FOUND", "Product not found");
  }
  const [run] = await db
    .insert(validationRuns)
    .values({
      organizationId,
      status: "processing",
      scope: data.scope,
      createdBy: actorUserId,
      productCount: target.length,
    })
    .returning();
  if (!run) {
    throw new ServiceError(500, "INTERNAL", "Could not start validation");
  }
  const job = await createJobRun(db, {
    organizationId,
    type: "validation.run",
    payload: { runId: run.id, scope: data.scope },
  });

  const ids = active.map((product) => product.id);
  const variants = ids.length
    ? await db
        .select({ productId: productVariants.productId, sku: productVariants.sku })
        .from(productVariants)
        .where(inArray(productVariants.productId, ids))
    : [];
  const images = target.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(inArray(productImages.productId, target.map((product) => product.id)))
    : [];
  const attributes = target.length
    ? await db
        .select({ productId: productAttributes.productId })
        .from(productAttributes)
        .where(inArray(productAttributes.productId, target.map((product) => product.id)))
    : [];

  const skuOwners = new Map<string, Set<string>>();
  const barcodeOwners = new Map<string, Set<string>>();
  function own(map: Map<string, Set<string>>, key: string, ownerId: string) {
    const current = map.get(key) ?? new Set<string>();
    current.add(ownerId);
    map.set(key, current);
  }
  for (const product of active) {
    own(skuOwners, product.sku, product.id);
    if (product.barcode) {
      own(barcodeOwners, product.barcode, product.id);
    }
  }
  for (const variant of variants) {
    own(skuOwners, variant.sku, variant.productId);
  }

  const targetIds = target.map((product) => product.id);
  const existingIssues = targetIds.length
    ? await db
        .select()
        .from(validationIssues)
        .where(
          and(
            eq(validationIssues.organizationId, organizationId),
            inArray(validationIssues.productId, targetIds),
            inArray(validationIssues.status, ["open", "ignored"]),
          ),
        )
    : [];

  let issueCount = 0;
  for (const product of target) {
    const findings = evaluateProduct(
      {
        ...product,
        imageUrls: images.filter((image) => image.productId === product.id).map((image) => image.url),
        attributeCount: attributes.filter((attribute) => attribute.productId === product.id).length,
        variantSkus: variants.filter((variant) => variant.productId === product.id).map((variant) => variant.sku),
      },
      ruleViews,
      { skuOwners, barcodeOwners },
    );
    const score = await syncProductIssues(
      db,
      organizationId,
      product.id,
      run.id,
      findings,
      existingIssues.filter((issue) => issue.productId === product.id),
    );
    issueCount += findings.length;
    await db.update(products).set({ qualityScore: score }).where(eq(products.id, product.id));
  }

  if (data.scope === "all") {
    const activeIds = new Set(active.map((product) => product.id));
    const openIssues = await db
      .select({ id: validationIssues.id, productId: validationIssues.productId })
      .from(validationIssues)
      .where(
        and(eq(validationIssues.organizationId, organizationId), eq(validationIssues.status, "open")),
      );
    const staleIds = openIssues
      .filter((issue) => !activeIds.has(issue.productId))
      .map((issue) => issue.id);
    if (staleIds.length > 0) {
      await db
        .update(validationIssues)
        .set({ status: "resolved", resolvedAt: new Date(), runId: run.id })
        .where(inArray(validationIssues.id, staleIds));
    }
  }

  await db
    .update(validationRuns)
    .set({ status: "completed", issueCount, finishedAt: new Date() })
    .where(eq(validationRuns.id, run.id));
  await updateJobRunStatus(db, { id: job.id, organizationId, status: "completed" });
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "validation_run",
    entityId: run.id,
    action: "completed",
    metadata: { scope: data.scope, productCount: target.length, issueCount },
  });
  return getValidationRun(db, organizationId, run.id);
}

export async function getValidationRun(db: Database, organizationId: string, runId: string) {
  const [run] = await db
    .select()
    .from(validationRuns)
    .where(and(eq(validationRuns.id, runId), eq(validationRuns.organizationId, organizationId)))
    .limit(1);
  if (!run) {
    throw new ServiceError(404, "NOT_FOUND", "Validation run not found");
  }
  return {
    run: {
      id: run.id,
      status: run.status,
      scope: run.scope as ValidationScope,
      productCount: run.productCount,
      issueCount: run.issueCount,
      createdAt: run.createdAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    },
  };
}

const issueQuerySchema = z.object({
  severity: z.enum(SEVERITIES).optional(),
  status: z.enum(["open", "ignored", "resolved"]).optional(),
  ruleCode: z.string().trim().max(80).optional(),
  productId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

export async function listIssues(db: Database, organizationId: string, input: unknown) {
  const query = issueQuerySchema.parse(input);
  const filters = [eq(validationIssues.organizationId, organizationId)];
  if (query.severity) filters.push(eq(validationIssues.severity, query.severity));
  if (query.status) filters.push(eq(validationIssues.status, query.status));
  if (query.ruleCode) filters.push(eq(validationIssues.ruleCode, query.ruleCode));
  if (query.productId) filters.push(eq(validationIssues.productId, query.productId));
  const rows = await db
    .select({
      issue: validationIssues,
      sku: products.sku,
      title: products.title,
    })
    .from(validationIssues)
    .innerJoin(products, eq(products.id, validationIssues.productId))
    .where(and(...filters))
    .orderBy(desc(validationIssues.createdAt), asc(validationIssues.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
  return {
    issues: rows.map((row) => ({
      id: row.issue.id,
      productId: row.issue.productId,
      sku: row.sku,
      title: row.title,
      ruleCode: row.issue.ruleCode,
      severity: row.issue.severity,
      message: row.issue.message,
      field: row.issue.field,
      status: row.issue.status as IssueStatus,
      createdAt: row.issue.createdAt.toISOString(),
    })),
  };
}

async function rescoreProduct(db: Database, organizationId: string, productId: string) {
  const open = await db
    .select({ severity: validationIssues.severity })
    .from(validationIssues)
    .where(
      and(
        eq(validationIssues.organizationId, organizationId),
        eq(validationIssues.productId, productId),
        eq(validationIssues.status, "open"),
      ),
    );
  await db
    .update(products)
    .set({ qualityScore: qualityScore(open.map((issue) => ({ severity: issue.severity as Severity }))) })
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)));
}

export async function ignoreIssue(
  db: Database,
  organizationId: string,
  issueId: string,
  role: MemberRole,
) {
  const [issue] = await db
    .select()
    .from(validationIssues)
    .where(and(eq(validationIssues.id, issueId), eq(validationIssues.organizationId, organizationId)))
    .limit(1);
  if (!issue) {
    throw new ServiceError(404, "NOT_FOUND", "Issue not found");
  }
  if (issue.status !== "open") {
    throw new ServiceError(409, "CONFLICT", "Only an open issue can be ignored");
  }
  const severity = issue.severity as Severity;
  if (severity === "critical" || (severity === "error" && role !== "owner" && role !== "admin")) {
    throw new ServiceError(403, "FORBIDDEN", "This issue is too severe to ignore");
  }
  await db
    .update(validationIssues)
    .set({ status: "ignored" })
    .where(eq(validationIssues.id, issue.id));
  await rescoreProduct(db, organizationId, issue.productId);
  return { issueId: issue.id, status: "ignored" as const };
}

export async function bulkResolveIssues(db: Database, organizationId: string, input: unknown) {
  const data = z.object({ issueIds: z.array(z.uuid()).min(1).max(200) }).parse(input);
  const rows = await db
    .select()
    .from(validationIssues)
    .where(
      and(
        eq(validationIssues.organizationId, organizationId),
        inArray(validationIssues.id, data.issueIds),
        eq(validationIssues.status, "open"),
      ),
    );
  if (rows.length === 0) {
    throw new ServiceError(404, "NOT_FOUND", "Issue not found");
  }
  await db
    .update(validationIssues)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(inArray(validationIssues.id, rows.map((row) => row.id)));
  const productIds = [...new Set(rows.map((row) => row.productId))];
  for (const productId of productIds) {
    await rescoreProduct(db, organizationId, productId);
  }
  return { resolved: rows.length };
}

export async function validationSummary(db: Database, organizationId: string) {
  const scored = await db
    .select({ score: products.qualityScore })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), isNull(products.deletedAt)));
  const distribution = { low: 0, mid: 0, high: 0, unscored: 0 };
  let total = 0;
  let counted = 0;
  for (const row of scored) {
    if (row.score === null) {
      distribution.unscored += 1;
      continue;
    }
    total += row.score;
    counted += 1;
    if (row.score < 50) distribution.low += 1;
    else if (row.score < 80) distribution.mid += 1;
    else distribution.high += 1;
  }
  const open = await db
    .select({
      severity: validationIssues.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(validationIssues)
    .where(and(eq(validationIssues.organizationId, organizationId), eq(validationIssues.status, "open")))
    .groupBy(validationIssues.severity);
  const openBySeverity = { critical: 0, error: 0, warning: 0, info: 0 };
  for (const row of open) {
    if (row.severity in openBySeverity) {
      openBySeverity[row.severity as Severity] = Number(row.count);
    }
  }
  return {
    summary: {
      averageScore: counted === 0 ? null : Math.round(total / counted),
      productCount: scored.length,
      distribution,
      openBySeverity,
    },
  };
}
