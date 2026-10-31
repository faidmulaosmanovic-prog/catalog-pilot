import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import {
  planBulkChange,
  type AttributeValue,
  type BulkConfig,
  type BulkProduct,
  type PlanResult,
} from "@/server/bulk/operations";
import type { Database } from "@/server/db/client";
import { categories, products } from "@/server/db/schema/catalog";
import {
  BULK_OPERATIONS,
  BULK_TEXT_FIELDS,
  PRODUCT_STATUSES,
  type BulkJobStatus,
  type BulkOperation,
} from "@/server/db/schema/constants";
import { bulkEditChanges, bulkEditJobs } from "@/server/db/schema/bulk";
import { recordActivity } from "@/server/services/activity-log";
import { createJobRun, updateJobRunStatus } from "@/server/services/job-runs";
import { ServiceError } from "@/server/services/organizations";
import { updateProduct } from "@/server/services/products";

const MAX_PRODUCTS = 500;
const SAMPLE_LIMIT = 20;

const attributeValue = z.union([z.string().max(500), z.number().finite(), z.boolean()]);
const textField = z.enum(BULK_TEXT_FIELDS);

const requestSchema = z
  .object({
    productIds: z.array(z.uuid()).max(MAX_PRODUCTS).optional(),
    selectAllMatching: z.boolean().default(false),
    filter: z
      .object({
        q: z.string().trim().max(200).optional(),
        status: z.enum(PRODUCT_STATUSES).optional(),
        brand: z.string().trim().max(120).optional(),
        categoryId: z.uuid().optional(),
      })
      .optional(),
  })
  .and(
    z.discriminatedUnion("operation", [
      z.object({
        operation: z.literal("replace_text"),
        config: z.object({
          field: textField,
          find: z.string().min(1).max(500),
          replace: z.string().max(500),
        }),
      }),
      z.object({
        operation: z.literal("append_text"),
        config: z.object({ field: textField, text: z.string().min(1).max(500) }),
      }),
      z.object({
        operation: z.literal("prepend_text"),
        config: z.object({ field: textField, text: z.string().min(1).max(500) }),
      }),
      z.object({
        operation: z.literal("update_price"),
        config: z.object({
          mode: z.enum(["set", "percent", "delta"]),
          value: z.number().finite(),
        }),
      }),
      z.object({
        operation: z.literal("update_brand"),
        config: z.object({ brand: z.string().trim().max(120).nullable() }),
      }),
      z.object({
        operation: z.literal("update_category"),
        config: z.object({ categoryId: z.uuid().nullable() }),
      }),
      z.object({
        operation: z.literal("update_attributes"),
        config: z.object({
          mode: z.enum(["merge", "replace"]),
          attributes: z.record(z.string().min(1).max(80), attributeValue),
        }),
      }),
      z.object({
        operation: z.literal("normalize"),
        config: z.object({
          field: textField,
          trim: z.boolean().default(true),
          collapseWhitespace: z.boolean().default(true),
          case: z.enum(["none", "lower", "upper", "title"]).default("none"),
        }),
      }),
      z.object({
        operation: z.literal("update_status"),
        config: z.object({ status: z.enum(PRODUCT_STATUSES) }),
      }),
    ]),
  );

type RequestData = z.infer<typeof requestSchema>;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function attributesOf(value: unknown): Record<string, AttributeValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, AttributeValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      result[key] = item;
    }
  }
  return result;
}

function toBulkProduct(row: typeof products.$inferSelect): BulkProduct {
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    brand: row.brand,
    price: row.price,
    categoryId: row.categoryId,
    status: row.status,
    attributes: attributesOf(row.attributesJson),
  };
}

async function loadTargets(db: Database, organizationId: string, data: RequestData) {
  const filters = [eq(products.organizationId, organizationId), isNull(products.deletedAt)];
  if (data.selectAllMatching) {
    if (data.filter?.status) filters.push(eq(products.status, data.filter.status));
    if (data.filter?.brand) filters.push(eq(products.brand, data.filter.brand));
    if (data.filter?.categoryId) filters.push(eq(products.categoryId, data.filter.categoryId));
    if (data.filter?.q) {
      const pattern = `%${escapeLike(data.filter.q)}%`;
      filters.push(or(ilike(products.title, pattern), ilike(products.sku, pattern))!);
    }
    const rows = await db
      .select()
      .from(products)
      .where(and(...filters))
      .orderBy(desc(products.updatedAt), desc(products.id))
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

type Planned = {
  product: BulkProduct;
  result: PlanResult;
};

async function buildPlan(db: Database, organizationId: string, input: unknown) {
  const data = requestSchema.parse(input);
  if (!BULK_OPERATIONS.includes(data.operation)) {
    throw new ServiceError(400, "BAD_REQUEST", "Unknown operation");
  }
  if (data.operation === "update_category" && data.config.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, data.config.categoryId), eq(categories.organizationId, organizationId)))
      .limit(1);
    if (!category) {
      throw new ServiceError(400, "BAD_REQUEST", "Category was not found in this organization");
    }
  }
  if (data.operation === "update_price" && data.config.mode === "set" && data.config.value < 0) {
    throw new ServiceError(400, "BAD_REQUEST", "Price cannot be negative");
  }
  const rows = await loadTargets(db, organizationId, data);
  const planned: Planned[] = rows.map((row) => {
    const product = toBulkProduct(row);
    return { product, result: planBulkChange(product, data as BulkConfig) };
  });
  return { data, planned };
}

function publicPreview(planned: Planned[]) {
  const changes = planned.filter((item) => item.result.kind === "change");
  const skipped = planned.filter((item) => item.result.kind === "skipped");
  return {
    affectedCount: changes.length,
    unchangedCount: planned.filter((item) => item.result.kind === "unchanged").length,
    skippedCount: skipped.length,
    samples: changes.slice(0, SAMPLE_LIMIT).map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      before: item.result.kind === "change" ? item.result.change.before : {},
      after: item.result.kind === "change" ? item.result.change.after : {},
    })),
    skipped: skipped.slice(0, SAMPLE_LIMIT).map((item) => ({
      productId: item.product.id,
      sku: item.product.sku,
      reason: item.result.kind === "skipped" ? item.result.reason : "",
    })),
  };
}

export async function previewBulkEdit(db: Database, organizationId: string, input: unknown) {
  const { planned } = await buildPlan(db, organizationId, input);
  return { preview: publicPreview(planned) };
}

function publicJob(row: typeof bulkEditJobs.$inferSelect) {
  return {
    id: row.id,
    operation: row.operation as BulkOperation,
    status: row.status as BulkJobStatus,
    productCount: row.productCount ?? 0,
    canRollback: row.canRollback,
    config: row.operationConfig,
    preview: row.previewJson,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export async function applyBulkEdit(
  db: Database,
  actorUserId: string,
  organizationId: string,
  input: unknown,
) {
  const { data, planned } = await buildPlan(db, organizationId, input);
  const changes = planned.flatMap((item) =>
    item.result.kind === "change" ? [{ product: item.product, change: item.result.change }] : [],
  );
  if (changes.length === 0) {
    throw new ServiceError(400, "BAD_REQUEST", "Nothing to change");
  }
  const preview = publicPreview(planned);

  let jobId = "";
  await db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    const active = await database
      .select({ id: bulkEditJobs.id })
      .from(bulkEditJobs)
      .where(
        and(
          eq(bulkEditJobs.organizationId, organizationId),
          inArray(bulkEditJobs.status, ["queued", "processing"]),
        ),
      )
      .limit(1);
    if (active.length > 0) {
      throw new ServiceError(409, "CONFLICT", "Another bulk edit is already running for this organization");
    }
    const [job] = await database
      .insert(bulkEditJobs)
      .values({
        organizationId,
        createdBy: actorUserId,
        operation: data.operation,
        operationConfig: data.config,
        status: "processing",
        productCount: changes.length,
        previewJson: preview,
        canRollback: false,
      })
      .returning();
    if (!job) {
      throw new ServiceError(500, "INTERNAL", "Could not start the bulk edit");
    }
    jobId = job.id;
  });

  const jobRun = await createJobRun(db, {
    organizationId,
    type: "bulk_edit.apply",
    payload: { jobId, operation: data.operation },
  });

  try {
    for (const item of changes) {
      await updateProduct(db, actorUserId, organizationId, item.product.id, item.change.patch, {
        changeSource: `bulk:${jobId}`,
      });
      await db.insert(bulkEditChanges).values({
        bulkEditJobId: jobId,
        organizationId,
        productId: item.product.id,
        beforeJson: item.change.before,
        afterJson: item.change.after,
      });
    }
    await db
      .update(bulkEditJobs)
      .set({ status: "completed", canRollback: true, finishedAt: new Date() })
      .where(eq(bulkEditJobs.id, jobId));
    await updateJobRunStatus(db, { id: jobRun.id, organizationId, status: "completed" });
    await recordActivity(db, {
      organizationId,
      actorUserId,
      entityType: "bulk_edit_job",
      entityId: jobId,
      action: "completed",
      metadata: { operation: data.operation, productCount: changes.length },
    });
  } catch (error) {
    await db
      .update(bulkEditJobs)
      .set({ status: "failed", finishedAt: new Date() })
      .where(eq(bulkEditJobs.id, jobId));
    await updateJobRunStatus(db, {
      id: jobRun.id,
      organizationId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Bulk edit failed",
    });
    throw error;
  }

  return getBulkEdit(db, organizationId, jobId);
}

export async function listBulkEdits(db: Database, organizationId: string) {
  const rows = await db
    .select()
    .from(bulkEditJobs)
    .where(eq(bulkEditJobs.organizationId, organizationId))
    .orderBy(desc(bulkEditJobs.createdAt))
    .limit(50);
  return { jobs: rows.map(publicJob) };
}

export async function getBulkEdit(db: Database, organizationId: string, jobId: string) {
  const [job] = await db
    .select()
    .from(bulkEditJobs)
    .where(and(eq(bulkEditJobs.id, jobId), eq(bulkEditJobs.organizationId, organizationId)))
    .limit(1);
  if (!job) {
    throw new ServiceError(404, "NOT_FOUND", "Bulk edit not found");
  }
  const changes = await db
    .select({
      id: bulkEditChanges.id,
      productId: bulkEditChanges.productId,
      sku: products.sku,
      beforeJson: bulkEditChanges.beforeJson,
      afterJson: bulkEditChanges.afterJson,
    })
    .from(bulkEditChanges)
    .innerJoin(products, eq(products.id, bulkEditChanges.productId))
    .where(eq(bulkEditChanges.bulkEditJobId, job.id))
    .orderBy(bulkEditChanges.createdAt)
    .limit(50);
  return {
    job: publicJob(job),
    changes: changes.map((change) => ({
      id: change.id,
      productId: change.productId,
      sku: change.sku,
      before: change.beforeJson,
      after: change.afterJson,
    })),
  };
}

export async function rollbackBulkEdit(
  db: Database,
  actorUserId: string,
  organizationId: string,
  jobId: string,
) {
  const [job] = await db
    .select()
    .from(bulkEditJobs)
    .where(and(eq(bulkEditJobs.id, jobId), eq(bulkEditJobs.organizationId, organizationId)))
    .limit(1);
  if (!job) {
    throw new ServiceError(404, "NOT_FOUND", "Bulk edit not found");
  }
  if (job.status !== "completed" || !job.canRollback || !job.finishedAt) {
    throw new ServiceError(409, "CONFLICT", "This bulk edit cannot be rolled back");
  }
  const rows = await db
    .select({
      productId: bulkEditChanges.productId,
      beforeJson: bulkEditChanges.beforeJson,
      updatedAt: products.updatedAt,
      deletedAt: products.deletedAt,
    })
    .from(bulkEditChanges)
    .innerJoin(products, eq(products.id, bulkEditChanges.productId))
    .where(
      and(eq(bulkEditChanges.bulkEditJobId, job.id), eq(bulkEditChanges.organizationId, organizationId)),
    );
  let restored = 0;
  for (const row of rows) {
    if (row.deletedAt || row.updatedAt > job.finishedAt) {
      continue;
    }
    await updateProduct(db, actorUserId, organizationId, row.productId, row.beforeJson, {
      changeSource: `bulk-rollback:${job.id}`,
    });
    restored += 1;
  }
  if (restored === 0) {
    throw new ServiceError(409, "CONFLICT", "Products changed after this bulk edit");
  }
  await db
    .update(bulkEditJobs)
    .set({ status: "rolled_back", canRollback: false })
    .where(eq(bulkEditJobs.id, job.id));
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "bulk_edit_job",
    entityId: job.id,
    action: "rolled_back",
    metadata: { restored, skipped: rows.length - restored },
  });
  return getBulkEdit(db, organizationId, jobId);
}
