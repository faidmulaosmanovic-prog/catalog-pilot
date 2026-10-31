import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/server/db/client";
import { categories, productImages, productVariants, products } from "@/server/db/schema/catalog";
import { channelListings, channels, exportJobs, marketplaceTemplates } from "@/server/db/schema/channels";
import { PRODUCT_STATUSES, type ExportJobStatus } from "@/server/db/schema/constants";
import { validationIssues } from "@/server/db/schema/quality";
import {
  applyRules,
  getAdapter,
  type AdapterIssue,
  type ProductSnapshot,
} from "@/server/exports/adapters";
import { toCsv } from "@/server/exports/csv";
import { signExportDownload } from "@/server/exports/download-token";
import type { TemplateSchema } from "@/server/exports/templates";
import { exportObjectKey, putImportObject, readImportObject } from "@/server/imports/object-store";
import { recordActivity } from "@/server/services/activity-log";
import { createJobRun, updateJobRunStatus } from "@/server/services/job-runs";
import { assertCanExportChannel, recordImportExportJob } from "@/server/services/billing";
import { ServiceError } from "@/server/services/organizations";
import { runValidation } from "@/server/services/quality";

const MAX_PRODUCTS = 500;

const requestSchema = z.object({
  channelCode: z.string().trim().min(1).max(40),
  templateVersion: z.string().trim().max(40).optional(),
  productIds: z.array(z.uuid()).max(MAX_PRODUCTS).optional(),
  selectAllMatching: z.boolean().default(false),
  filter: z
    .object({
      q: z.string().trim().max(200).optional(),
      status: z.enum(PRODUCT_STATUSES).optional(),
      brand: z.string().trim().max(120).optional(),
    })
    .optional(),
});

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function blocking(issues: AdapterIssue[]) {
  return issues.filter((issue) => issue.severity === "critical" || issue.severity === "error");
}

async function loadTargets(db: Database, organizationId: string, data: z.infer<typeof requestSchema>) {
  const filters = [eq(products.organizationId, organizationId), isNull(products.deletedAt)];
  if (data.selectAllMatching) {
    if (data.filter?.status) filters.push(eq(products.status, data.filter.status));
    if (data.filter?.brand) filters.push(eq(products.brand, data.filter.brand));
    if (data.filter?.q) {
      const pattern = `%${escapeLike(data.filter.q)}%`;
      filters.push(or(ilike(products.title, pattern), ilike(products.sku, pattern))!);
    }
    const rows = await db
      .select()
      .from(products)
      .where(and(...filters))
      .orderBy(desc(products.updatedAt))
      .limit(MAX_PRODUCTS + 1);
    if (rows.length > MAX_PRODUCTS) {
      throw new ServiceError(400, "BAD_REQUEST", "Narrow the filter to 500 products or fewer");
    }
    return rows;
  }
  if (!data.productIds || data.productIds.length === 0) {
    throw new ServiceError(400, "BAD_REQUEST", "Choose at least one product");
  }
  const rows = await db
    .select()
    .from(products)
    .where(and(...filters, inArray(products.id, data.productIds)));
  if (rows.length !== data.productIds.length) {
    throw new ServiceError(404, "NOT_FOUND", "Product not found");
  }
  return rows;
}

export async function listChannels(db: Database) {
  const channelRows = await db.select().from(channels).where(eq(channels.isActive, true)).orderBy(channels.name);
  const templates = await db.select().from(marketplaceTemplates).orderBy(marketplaceTemplates.version);
  return {
    channels: channelRows.map((channel) => ({
      id: channel.id,
      code: channel.code,
      name: channel.name,
      type: channel.type,
      templates: templates
        .filter((template) => template.channelId === channel.id)
        .map((template) => ({
          id: template.id,
          version: template.version,
          name: template.name,
          isDefault: template.isDefault,
          headers: (template.mappingSchema as TemplateSchema).headers,
        })),
    })),
  };
}

function publicJob(row: typeof exportJobs.$inferSelect) {
  const download = row.status === "completed" && row.fileR2Key ? signExportDownload(row.id) : null;
  return {
    id: row.id,
    status: row.status as ExportJobStatus,
    productCount: row.productCount ?? 0,
    errorReport: row.errorReportJson,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    downloadUrl: download?.url ?? null,
  };
}

export async function createExport(db: Database, actorUserId: string, organizationId: string, input: unknown) {
  const data = requestSchema.parse(input);
  let adapter;
  try {
    adapter = getAdapter(data.channelCode);
  } catch {
    throw new ServiceError(400, "BAD_REQUEST", "Unknown channel");
  }
  const version = data.templateVersion || adapter.getDefaultTemplateVersion();
  const [channel] = await db.select().from(channels).where(eq(channels.code, data.channelCode)).limit(1);
  if (!channel || !channel.isActive) {
    throw new ServiceError(404, "NOT_FOUND", "Channel not found");
  }
  const [template] = await db
    .select()
    .from(marketplaceTemplates)
    .where(and(eq(marketplaceTemplates.channelId, channel.id), eq(marketplaceTemplates.version, version)))
    .limit(1);
  if (!template) {
    throw new ServiceError(404, "NOT_FOUND", "Template not found");
  }
  const targets = await loadTargets(db, organizationId, data);
  const schema = template.mappingSchema as TemplateSchema;

  let jobId = "";
  await db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const active = await database
      .select({ id: exportJobs.id })
      .from(exportJobs)
      .where(and(eq(exportJobs.organizationId, organizationId), inArray(exportJobs.status, ["queued", "processing"])))
      .limit(1);
    if (active.length > 0) {
      throw new ServiceError(409, "CONFLICT", "Another export is already running for this organization");
    }
    await assertCanExportChannel(database, organizationId, data.channelCode);
    await recordImportExportJob(database, organizationId);
    const [job] = await database
      .insert(exportJobs)
      .values({
        organizationId,
        createdBy: actorUserId,
        channelId: channel.id,
        templateId: template.id,
        status: "processing",
        productCount: targets.length,
      })
      .returning();
    if (!job) {
      throw new ServiceError(500, "INTERNAL", "Could not start the export");
    }
    jobId = job.id;
  });

  const jobRun = await createJobRun(db, {
    organizationId,
    type: "export.generate",
    payload: { jobId, channelCode: channel.code, templateVersion: version },
  });

  try {
    const issues: AdapterIssue[] = [];
    if (targets.length > 0) {
      await runValidation(db, actorUserId, organizationId, {
        scope: "selection",
        productIds: targets.map((product) => product.id),
      });
      const open = await db
        .select({
          sku: products.sku,
          field: validationIssues.field,
          ruleCode: validationIssues.ruleCode,
          severity: validationIssues.severity,
          message: validationIssues.message,
        })
        .from(validationIssues)
        .innerJoin(products, eq(products.id, validationIssues.productId))
        .where(
          and(
            eq(validationIssues.organizationId, organizationId),
            inArray(validationIssues.productId, targets.map((product) => product.id)),
            eq(validationIssues.status, "open"),
            inArray(validationIssues.severity, ["critical", "error"]),
          ),
        );
      for (const issue of open) {
        issues.push({
          sku: issue.sku,
          field: issue.field ?? undefined,
          code: issue.ruleCode,
          severity: issue.severity as AdapterIssue["severity"],
          message: issue.message,
        });
      }
    }

    const ids = targets.map((product) => product.id);
    const variants = ids.length
      ? await db.select().from(productVariants).where(inArray(productVariants.productId, ids))
      : [];
    const images = ids.length
      ? await db.select().from(productImages).where(inArray(productImages.productId, ids))
      : [];
    const categoryIds = targets.flatMap((product) => (product.categoryId ? [product.categoryId] : []));
    const categoryRows = categoryIds.length
      ? await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds))
      : [];
    const categoryName = new Map(categoryRows.map((category) => [category.id, category.name]));

    const records: Array<Record<string, string>> = [];
    for (const product of targets) {
      const snapshot: ProductSnapshot = {
        id: product.id,
        sku: product.sku,
        title: product.title,
        description: product.description,
        brand: product.brand,
        categoryName: product.categoryId ? (categoryName.get(product.categoryId) ?? null) : null,
        price: product.price,
        currency: product.currency.trim(),
        quantity: product.quantity,
        barcode: product.barcode,
        status: product.status,
        attributes: (product.attributesJson ?? {}) as Record<string, unknown>,
        images: images
          .filter((image) => image.productId === product.id)
          .map((image) => ({ url: image.url, position: image.position })),
        variants: variants
          .filter((variant) => variant.productId === product.id)
          .map((variant) => ({
            sku: variant.sku,
            price: variant.price,
            quantity: variant.quantity,
            barcode: variant.barcode,
            option1Name: variant.option1Name,
            option1Value: variant.option1Value,
          })),
      };
      const expanded = adapter.expand(snapshot);
      issues.push(...adapter.validate(expanded, schema, snapshot));
      records.push(...expanded.map((row) => applyRules(row, schema.mappingRules)));
    }

    const errors = blocking(issues);
    const warnings = issues.filter((issue) => issue.severity === "warning" || issue.severity === "info");
    const report = { errors, warnings };
    if (errors.length > 0) {
      await db
        .update(exportJobs)
        .set({ status: "failed", errorReportJson: report, finishedAt: new Date() })
        .where(eq(exportJobs.id, jobId));
      await markListings(db, organizationId, channel.id, targets.map((product) => product.id), "error", errors[0]?.message ?? "Export failed");
      await updateJobRunStatus(db, { id: jobRun.id, organizationId, status: "failed", errorMessage: "Export failed validation" });
      await recordActivity(db, {
        organizationId,
        actorUserId,
        entityType: "export_job",
        entityId: jobId,
        action: "failed",
        metadata: { channelCode: channel.code, errors: errors.length },
      });
      return getExport(db, organizationId, jobId);
    }

    const csv = toCsv(schema.headers, records);
    const key = exportObjectKey(organizationId, jobId);
    putImportObject(key, Buffer.from(csv, "utf8"));
    await db
      .update(exportJobs)
      .set({ status: "completed", fileR2Key: key, errorReportJson: report, finishedAt: new Date() })
      .where(eq(exportJobs.id, jobId));
    await markListings(db, organizationId, channel.id, targets.map((product) => product.id), "exported", null);
    await updateJobRunStatus(db, { id: jobRun.id, organizationId, status: "completed" });
    await recordActivity(db, {
      organizationId,
      actorUserId,
      entityType: "export_job",
      entityId: jobId,
      action: "completed",
      metadata: { channelCode: channel.code, productCount: targets.length },
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    await db
      .update(exportJobs)
      .set({ status: "failed", finishedAt: new Date(), errorReportJson: { errors: [{ message: "Export failed" }], warnings: [] } })
      .where(eq(exportJobs.id, jobId));
    await updateJobRunStatus(db, {
      id: jobRun.id,
      organizationId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Export failed",
    });
    throw error;
  }

  return getExport(db, organizationId, jobId);
}

async function markListings(
  db: Database,
  organizationId: string,
  channelId: string,
  productIds: string[],
  status: "exported" | "error",
  lastError: string | null,
) {
  if (productIds.length === 0) return;
  const now = new Date();
  for (const productId of productIds) {
    await db
      .insert(channelListings)
      .values({
        organizationId,
        productId,
        channelId,
        status,
        lastExportedAt: status === "exported" ? now : null,
        lastError,
      })
      .onConflictDoUpdate({
        target: [channelListings.productId, channelListings.channelId],
        set: {
          status,
          lastExportedAt: status === "exported" ? now : null,
          lastError,
        },
      });
  }
}

export async function listExports(db: Database, organizationId: string) {
  const rows = await db
    .select({ job: exportJobs, channelCode: channels.code })
    .from(exportJobs)
    .innerJoin(channels, eq(channels.id, exportJobs.channelId))
    .where(eq(exportJobs.organizationId, organizationId))
    .orderBy(desc(exportJobs.createdAt))
    .limit(50);
  return {
    exports: rows.map((row) => ({ ...publicJob(row.job), channelCode: row.channelCode })),
  };
}

export async function getExport(db: Database, organizationId: string, exportId: string) {
  const [row] = await db
    .select({ job: exportJobs, channelCode: channels.code, templateVersion: marketplaceTemplates.version })
    .from(exportJobs)
    .innerJoin(channels, eq(channels.id, exportJobs.channelId))
    .leftJoin(marketplaceTemplates, eq(marketplaceTemplates.id, exportJobs.templateId))
    .where(and(eq(exportJobs.id, exportId), eq(exportJobs.organizationId, organizationId)))
    .limit(1);
  if (!row) {
    throw new ServiceError(404, "NOT_FOUND", "Export not found");
  }
  return {
    export: {
      ...publicJob(row.job),
      channelCode: row.channelCode,
      templateVersion: row.templateVersion,
    },
  };
}

export async function readExportFile(db: Database, organizationId: string, exportId: string) {
  const loaded = await getExport(db, organizationId, exportId);
  return readCompletedFile(db, organizationId, exportId, loaded.export.channelCode, loaded.export.status);
}

export async function readExportFileById(db: Database, exportId: string) {
  const [job] = await db
    .select({ organizationId: exportJobs.organizationId })
    .from(exportJobs)
    .where(eq(exportJobs.id, exportId))
    .limit(1);
  if (!job) {
    throw new ServiceError(404, "NOT_FOUND", "Export not found");
  }
  return readExportFile(db, job.organizationId, exportId);
}

async function readCompletedFile(
  db: Database,
  organizationId: string,
  exportId: string,
  channelCode: string,
  status: string,
) {
  if (status !== "completed") {
    throw new ServiceError(409, "CONFLICT", "This export is not ready to download");
  }
  const [job] = await db
    .select({ fileR2Key: exportJobs.fileR2Key })
    .from(exportJobs)
    .where(and(eq(exportJobs.id, exportId), eq(exportJobs.organizationId, organizationId)))
    .limit(1);
  if (!job?.fileR2Key) {
    throw new ServiceError(404, "NOT_FOUND", "Export file not found");
  }
  return { filename: `${channelCode}-${exportId}.csv`, bytes: readImportObject(job.fileR2Key) };
}
