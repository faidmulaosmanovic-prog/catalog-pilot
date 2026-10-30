import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/server/db/client";
import { postgresErrorCode } from "@/server/db/postgres-error";
import { importRows, productImages, productRevisions, products } from "@/server/db/schema/catalog";
import {
  IMPORT_MODES,
  IMPORT_TARGET_FIELDS,
  PRODUCT_STATUSES,
  type ImportTargetField,
} from "@/server/db/schema/constants";
import { importMappings, imports } from "@/server/db/schema/imports";
import { readCatalogTable, suggestMappings } from "@/server/imports/csv";
import {
  MAX_IMPORT_BYTES,
  importObjectKey,
  putImportObject,
  readImportObject,
  sha256,
} from "@/server/imports/object-store";
import { recordActivity } from "@/server/services/activity-log";
import { createJobRun, updateJobRunStatus } from "@/server/services/job-runs";
import { ServiceError } from "@/server/services/organizations";
import {
  captureProductRevision,
  createProduct,
  findActiveProductBySku,
  softDeleteProduct,
  updateProduct,
} from "@/server/services/products";

const BATCH_SIZE = 200;
const ROLLBACK_WINDOW_MS = 72 * 60 * 60 * 1000;
const ACTIVE = ["queued", "processing"] as const;

const mappingSchema = z.object({
  mappings: z
    .array(
      z.object({
        sourceColumn: z.string().trim().min(1).max(200),
        targetField: z.enum(IMPORT_TARGET_FIELDS),
        transform: z.string().trim().max(80).nullable().optional(),
      }),
    )
    .max(40),
  mode: z.enum(IMPORT_MODES).default("create"),
});

type Mapping = {
  sourceColumn: string;
  targetField: ImportTargetField;
  transform: string | null;
};

type MappedRow = Partial<Record<ImportTargetField, string>>;

function publicImport(row: typeof imports.$inferSelect, extras?: Record<string, unknown>) {
  return {
    id: row.id,
    status: row.status,
    fileName: row.fileName,
    encoding: row.encoding,
    delimiter: row.delimiter,
    mode: row.mode,
    totalRows: row.totalRows,
    successRows: row.successRows,
    failedRows: row.failedRows,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    ...extras,
  };
}

async function loadImport(db: Database, organizationId: string, importId: string) {
  const [row] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, importId), eq(imports.organizationId, organizationId)))
    .limit(1);
  if (!row) {
    throw new ServiceError(404, "NOT_FOUND", "Import not found");
  }
  return row;
}

async function loadMappings(db: Database, importId: string): Promise<Mapping[]> {
  const rows = await db.select().from(importMappings).where(eq(importMappings.importId, importId));
  return rows.map((row) => ({
    sourceColumn: row.sourceColumn,
    targetField: row.targetField as ImportTargetField,
    transform: row.transform,
  }));
}

function applyMapping(headers: string[], cells: string[], mappings: Mapping[]): MappedRow {
  const mapped: MappedRow = {};
  for (const mapping of mappings) {
    const index = headers.indexOf(mapping.sourceColumn);
    if (index >= 0) {
      mapped[mapping.targetField] = (cells[index] ?? "").trim();
    }
  }
  return mapped;
}

function validateRow(row: MappedRow, seen: Set<string>) {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!row.sku) {
    blocking.push("SKU is required");
  } else if (seen.has(row.sku)) {
    blocking.push("Duplicate SKU in this file");
  }
  if (row.price && !/^\d+(\.\d{1,2})?$/.test(row.price)) {
    blocking.push("Price must be a decimal with up to 2 places");
  }
  if (row.quantity && !/^\d+$/.test(row.quantity)) {
    blocking.push("Quantity must be a whole number");
  }
  if (row.currency && !/^[A-Za-z]{3}$/.test(row.currency)) {
    blocking.push("Currency must be 3 letters");
  }
  if (row.status && !PRODUCT_STATUSES.includes(row.status as (typeof PRODUCT_STATUSES)[number])) {
    blocking.push("Status must be draft, active, or archived");
  }
  if (row.image_url && !z.url().safeParse(row.image_url).success) {
    warnings.push("Image URL was skipped");
  }
  if (!row.title) {
    warnings.push("Title is empty");
  }
  if (row.sku) {
    seen.add(row.sku);
  }
  return { blocking, warnings };
}

function productInput(row: MappedRow, mappedFields: Set<string>) {
  const input: Record<string, unknown> = {};
  if (mappedFields.has("sku")) input.sku = row.sku;
  if (mappedFields.has("title")) input.title = row.title || null;
  if (mappedFields.has("description")) input.description = row.description || null;
  if (mappedFields.has("brand")) input.brand = row.brand || null;
  if (mappedFields.has("price")) input.price = row.price || null;
  if (mappedFields.has("currency") && row.currency) input.currency = row.currency.toUpperCase();
  if (mappedFields.has("quantity")) input.quantity = row.quantity ? Number(row.quantity) : null;
  if (mappedFields.has("status") && row.status) input.status = row.status;
  if (mappedFields.has("barcode")) input.barcode = row.barcode || null;
  if (mappedFields.has("image_url") && row.image_url && z.url().safeParse(row.image_url).success) {
    input.images = [{ url: row.image_url, position: 0, altText: row.title || row.sku }];
  }
  return input;
}

export async function uploadImport(
  db: Database,
  actorUserId: string,
  organizationId: string,
  file: { name: string; type: string; bytes: Buffer },
) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new ServiceError(400, "BAD_REQUEST", "Upload a .csv file");
  }
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    throw new ServiceError(400, "BAD_REQUEST", "Upload a .csv file");
  }
  if (file.bytes.length === 0) {
    throw new ServiceError(400, "BAD_REQUEST", "The file is empty");
  }
  if (file.bytes.length > MAX_IMPORT_BYTES) {
    throw new ServiceError(400, "BAD_REQUEST", "The file is larger than 20 MB");
  }

  const catalog = readCatalogTable(file.bytes);
  if (catalog.headers.length === 0) {
    throw new ServiceError(400, "BAD_REQUEST", "The file has no header row");
  }
  const hash = sha256(file.bytes);
  const [created] = await db
    .insert(imports)
    .values({
      organizationId,
      createdBy: actorUserId,
      fileName: file.name,
      fileR2Key: "pending",
      fileSizeBytes: file.bytes.length,
      fileContentHash: hash,
      status: "uploaded",
      encoding: catalog.encoding,
      delimiter: catalog.delimiter,
    })
    .returning();
  if (!created) {
    throw new ServiceError(500, "INTERNAL", "Could not create import");
  }
  const key = importObjectKey(organizationId, created.id, "source.csv");
  putImportObject(key, file.bytes);
  const [saved] = await db
    .update(imports)
    .set({ fileR2Key: key })
    .where(eq(imports.id, created.id))
    .returning();
  const [duplicate] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(
      and(
        eq(imports.organizationId, organizationId),
        eq(imports.fileContentHash, hash),
        sql`${imports.id} <> ${created.id}`,
      ),
    )
    .limit(1);
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "import",
    entityId: created.id,
    action: "uploaded",
    metadata: { fileName: file.name },
  });
  return {
    import: publicImport(saved ?? created, {
      detection: {
        encoding: catalog.encoding,
        delimiter: catalog.delimiter,
        headers: catalog.headers,
      },
      suggestedMappings: suggestMappings(catalog.headers),
      warnings: duplicate ? ["This file matches an earlier import"] : [],
    }),
  };
}

export async function saveImportMapping(
  db: Database,
  organizationId: string,
  importId: string,
  input: unknown,
) {
  const data = mappingSchema.parse(input);
  const row = await loadImport(db, organizationId, importId);
  if (!["uploaded", "mapping", "validated"].includes(row.status)) {
    throw new ServiceError(409, "CONFLICT", "This import can no longer be mapped");
  }
  const targets = new Set<string>();
  for (const mapping of data.mappings) {
    if (targets.has(mapping.targetField)) {
      throw new ServiceError(400, "BAD_REQUEST", "Each catalog field can be mapped once");
    }
    targets.add(mapping.targetField);
  }
  const catalog = readCatalogTable(readImportObject(row.fileR2Key));
  for (const mapping of data.mappings) {
    if (!catalog.headers.includes(mapping.sourceColumn)) {
      throw new ServiceError(400, "BAD_REQUEST", `Column ${mapping.sourceColumn} is not in the file`);
    }
  }
  await db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    await database.delete(importMappings).where(eq(importMappings.importId, importId));
    if (data.mappings.length > 0) {
      await database.insert(importMappings).values(
        data.mappings.map((mapping) => ({
          importId,
          organizationId,
          sourceColumn: mapping.sourceColumn,
          targetField: mapping.targetField,
          transform: mapping.transform ?? null,
        })),
      );
    }
    await database
      .update(imports)
      .set({ status: "mapping", mode: data.mode })
      .where(eq(imports.id, importId));
  });
  return { import: publicImport(await loadImport(db, organizationId, importId)) };
}

export async function previewImport(
  db: Database,
  organizationId: string,
  importId: string,
  input: unknown,
) {
  const limit = z.object({ limit: z.number().int().min(1).max(50).default(50) }).parse(input ?? {});
  const row = await loadImport(db, organizationId, importId);
  const mappings = await loadMappings(db, importId);
  if (!mappings.some((mapping) => mapping.targetField === "sku")) {
    throw new ServiceError(400, "BAD_REQUEST", "Map a column to SKU before preview");
  }
  const catalog = readCatalogTable(readImportObject(row.fileR2Key));
  const seen = new Set<string>();
  const mappedFields = new Set(mappings.map((mapping) => mapping.targetField));
  const preview = [];
  let blockingCount = 0;
  for (const [offset, cells] of catalog.rows.slice(0, limit.limit).entries()) {
    const mapped = applyMapping(catalog.headers, cells, mappings);
    const result = validateRow(mapped, seen);
    if (result.blocking.length === 0 && mapped.sku && row.mode === "create") {
      const existing = await findActiveProductBySku(db, organizationId, mapped.sku);
      if (existing) {
        result.blocking.push("SKU already exists");
      }
    }
    if (result.blocking.length > 0) {
      blockingCount += 1;
    }
    preview.push({
      rowNumber: offset + 2,
      values: productInput(mapped, mappedFields),
      errors: result.blocking,
      warnings: result.warnings,
    });
  }
  await db.update(imports).set({ status: "validated" }).where(eq(imports.id, importId));
  return {
    import: publicImport(await loadImport(db, organizationId, importId)),
    preview,
    summary: { previewed: preview.length, fileRows: catalog.rows.length, blockingCount },
  };
}

async function recordFailure(
  db: Database,
  organizationId: string,
  importId: string,
  rowNumber: number,
  raw: Record<string, unknown>,
  message: string,
) {
  await db.insert(importRows).values({
    organizationId,
    importId,
    rowNumber,
    rawJson: raw,
    status: "failed",
    errorMessage: message,
  });
}

async function recordSuccess(
  db: Database,
  organizationId: string,
  importId: string,
  rowNumber: number,
  productId: string,
  action: "created" | "upserted",
) {
  await db.insert(importRows).values({
    organizationId,
    importId,
    rowNumber,
    rawJson: { action },
    status: "success",
    productId,
  });
}

async function processImport(
  db: Database,
  actorUserId: string,
  organizationId: string,
  importId: string,
) {
  const row = await loadImport(db, organizationId, importId);
  const job = await createJobRun(db, {
    organizationId,
    type: "import.process",
    payload: { importId },
  });
  await db
    .update(imports)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(imports.id, importId));
  const mappings = await loadMappings(db, importId);
  const catalog = readCatalogTable(readImportObject(row.fileR2Key));
  const mappedFields = new Set(mappings.map((mapping) => mapping.targetField));
  const seen = new Set<string>();
  let successRows = 0;
  let failedRows = 0;
  const failures: Array<{ rowNumber: number; sku: string; message: string }> = [];

  try {
    for (let offset = 0; offset < catalog.rows.length; offset += BATCH_SIZE) {
      const batch = catalog.rows.slice(offset, offset + BATCH_SIZE);
      for (const [index, cells] of batch.entries()) {
        const rowNumber = offset + index + 2;
        const mapped = applyMapping(catalog.headers, cells, mappings);
        const result = validateRow(mapped, seen);
        if (result.blocking.length > 0) {
          failedRows += 1;
          const message = result.blocking.join("; ");
          failures.push({ rowNumber, sku: mapped.sku ?? "", message });
          await recordFailure(db, organizationId, importId, rowNumber, { ...mapped }, message);
          continue;
        }
        try {
          const existing = await findActiveProductBySku(db, organizationId, mapped.sku ?? "");
          if (existing && row.mode === "create") {
            throw new ServiceError(409, "DUPLICATE_SKU", "SKU already exists");
          }
          const input = productInput(mapped, mappedFields);
          if (existing && row.mode === "upsert") {
            await captureProductRevision(
              db,
              organizationId,
              existing.id,
              actorUserId,
              `import-before:${importId}`,
            );
            await updateProduct(db, actorUserId, organizationId, existing.id, input, {
              changeSource: "import",
            });
            await recordSuccess(db, organizationId, importId, rowNumber, existing.id, "upserted");
          } else {
            const created = await createProduct(db, actorUserId, organizationId, input, {
              sourceImportId: importId,
              changeSource: "import",
            });
            if (!created) {
              throw new ServiceError(500, "INTERNAL", "Could not create product");
            }
            await recordSuccess(db, organizationId, importId, rowNumber, created.id, "created");
          }
          successRows += 1;
        } catch (error) {
          failedRows += 1;
          const message = error instanceof ServiceError ? error.message : "Could not write this row";
          failures.push({ rowNumber, sku: mapped.sku ?? "", message });
          await recordFailure(db, organizationId, importId, rowNumber, { ...mapped }, message);
        }
      }
    }
  } catch (error) {
    await db
      .update(imports)
      .set({ status: "failed", finishedAt: new Date(), successRows, failedRows })
      .where(eq(imports.id, importId));
    await updateJobRunStatus(db, {
      id: job.id,
      organizationId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Import failed",
    });
    throw error;
  }

  const errorKey = failures.length ? importObjectKey(organizationId, importId, "errors.csv") : null;
  if (errorKey) {
    const lines = ["row_number,sku,error"];
    for (const failure of failures) {
      lines.push(
        `${failure.rowNumber},"${failure.sku.replaceAll('"', '""')}","${failure.message.replaceAll('"', '""')}"`,
      );
    }
    putImportObject(errorKey, Buffer.from(`${lines.join("\n")}\n`, "utf8"));
  }
  const status = successRows === 0 ? "failed" : "completed";
  await db
    .update(imports)
    .set({
      status,
      totalRows: catalog.rows.length,
      successRows,
      failedRows,
      errorR2Key: errorKey,
      finishedAt: new Date(),
    })
    .where(eq(imports.id, importId));
  await updateJobRunStatus(db, {
    id: job.id,
    organizationId,
    status: status === "failed" ? "failed" : "completed",
  });
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "import",
    entityId: importId,
    action: status,
    metadata: { successRows, failedRows },
  });
}

export async function confirmImport(
  db: Database,
  actorUserId: string,
  organizationId: string,
  importId: string,
  idempotencyKey: string | null,
) {
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new ServiceError(400, "BAD_REQUEST", "Idempotency-Key is required");
  }
  const row = await loadImport(db, organizationId, importId);
  if (row.idempotencyKey === idempotencyKey) {
    return { import: publicImport(row) };
  }
  if (row.status !== "validated") {
    throw new ServiceError(409, "CONFLICT", "Preview the import before confirming it");
  }
  const mappings = await loadMappings(db, importId);
  if (!mappings.some((mapping) => mapping.targetField === "sku")) {
    throw new ServiceError(400, "BAD_REQUEST", "Map a column to SKU before confirming");
  }

  try {
    await db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      const active = await database
        .select({ id: imports.id })
        .from(imports)
        .where(
          and(
            eq(imports.organizationId, organizationId),
            inArray(imports.status, [...ACTIVE]),
            sql`${imports.id} <> ${importId}`,
          ),
        )
        .limit(1);
      if (active.length > 0) {
        throw new ServiceError(409, "CONFLICT", "Another import is already running for this organization");
      }
      await database
        .update(imports)
        .set({ status: "queued", idempotencyKey })
        .where(eq(imports.id, importId));
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23505") {
      throw new ServiceError(409, "CONFLICT", "Idempotency-Key was already used");
    }
    throw error;
  }

  await processImport(db, actorUserId, organizationId, importId);
  return { import: publicImport(await loadImport(db, organizationId, importId)) };
}

export async function listImports(db: Database, organizationId: string) {
  const rows = await db
    .select()
    .from(imports)
    .where(eq(imports.organizationId, organizationId))
    .orderBy(desc(imports.createdAt));
  return rows.map((row) => publicImport(row));
}

export async function getImport(db: Database, organizationId: string, importId: string) {
  return { import: publicImport(await loadImport(db, organizationId, importId)) };
}

export async function importErrorsCsv(db: Database, organizationId: string, importId: string) {
  const row = await loadImport(db, organizationId, importId);
  if (!row.errorR2Key) {
    return "row_number,sku,error\n";
  }
  return readImportObject(row.errorR2Key).toString("utf8");
}

export async function rollbackImport(
  db: Database,
  actorUserId: string,
  organizationId: string,
  importId: string,
) {
  const row = await loadImport(db, organizationId, importId);
  if (row.status !== "completed" || !row.finishedAt) {
    throw new ServiceError(409, "CONFLICT", "Only a completed import can be rolled back");
  }
  if (Date.now() - row.finishedAt.getTime() > ROLLBACK_WINDOW_MS) {
    throw new ServiceError(409, "CONFLICT", "The rollback window for this import has closed");
  }
  const successes = await db
    .select()
    .from(importRows)
    .where(and(eq(importRows.importId, importId), eq(importRows.status, "success")));
  let deleted = 0;
  let restored = 0;
  let skipped = 0;
  for (const success of successes) {
    if (!success.productId) {
      skipped += 1;
      continue;
    }
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, success.productId), eq(products.organizationId, organizationId)))
      .limit(1);
    if (!product || product.deletedAt || product.updatedAt.getTime() > row.finishedAt.getTime()) {
      skipped += 1;
      continue;
    }
    const action = (success.rawJson as { action?: string } | null)?.action;
    if (action === "upserted") {
      const [revision] = await db
        .select()
        .from(productRevisions)
        .where(
          and(
            eq(productRevisions.productId, product.id),
            eq(productRevisions.changeSource, `import-before:${importId}`),
          ),
        )
        .limit(1);
      const snapshot = revision?.snapshotJson as {
        product?: {
          title: string | null;
          description: string | null;
          brand: string | null;
          price: string | null;
          currency: string;
          quantity: number | null;
          status: string;
          barcode: string | null;
          barcodeType: string | null;
          attributesJson: Record<string, unknown>;
          categoryId: string | null;
        };
        images?: Array<{ url: string; position: number; altText: string | null }>;
      };
      if (!snapshot?.product) {
        skipped += 1;
        continue;
      }
      await db
        .update(products)
        .set({
          title: snapshot.product.title,
          description: snapshot.product.description,
          brand: snapshot.product.brand,
          price: snapshot.product.price,
          currency: snapshot.product.currency,
          quantity: snapshot.product.quantity,
          status: snapshot.product.status,
          barcode: snapshot.product.barcode,
          barcodeType: snapshot.product.barcodeType,
          attributesJson: snapshot.product.attributesJson ?? {},
          categoryId: snapshot.product.categoryId,
          updatedAt: new Date(),
        })
        .where(eq(products.id, product.id));
      await db.delete(productImages).where(eq(productImages.productId, product.id));
      const images = snapshot.images ?? [];
      if (images.length > 0) {
        await db.insert(productImages).values(
          images.map((image) => ({
            organizationId,
            productId: product.id,
            url: image.url,
            position: image.position,
            altText: image.altText,
            status: "valid" as const,
          })),
        );
      }
      restored += 1;
    } else if (product.sourceImportId === importId) {
      await softDeleteProduct(db, actorUserId, organizationId, product.id);
      deleted += 1;
    } else {
      skipped += 1;
    }
  }
  await db.update(imports).set({ status: "rolled_back" }).where(eq(imports.id, importId));
  await recordActivity(db, {
    organizationId,
    actorUserId,
    entityType: "import",
    entityId: importId,
    action: "rolled_back",
    metadata: { deleted, restored, skipped },
  });
  return {
    import: publicImport(await loadImport(db, organizationId, importId)),
    rollback: { deleted, restored, skipped },
  };
}
