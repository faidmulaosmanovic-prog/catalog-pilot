import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/server/db/client";
import { postgresErrorCode } from "@/server/db/postgres-error";
import {
  productAttributes,
  productImages,
  productRevisions,
  productVariants,
  products,
} from "@/server/db/schema/catalog";
import {
  BARCODE_TYPES,
  PRODUCT_STATUSES,
  type ProductStatus,
} from "@/server/db/schema/constants";
import { categories } from "@/server/db/schema/catalog";
import { recordActivity } from "@/server/services/activity-log";
import { ServiceError } from "@/server/services/organizations";

const currencySchema = z.string().trim().regex(/^[A-Z]{3}$/);
const priceSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Price must be a decimal with up to 2 places");

const imageSchema = z.object({
  url: z.url(),
  position: z.number().int().min(0).optional(),
  altText: z.string().trim().max(200).nullable().optional(),
});

const variantSchema = z.object({
  sku: z.string().trim().min(1).max(120),
  option1Name: z.string().trim().max(80).nullable().optional(),
  option1Value: z.string().trim().max(80).nullable().optional(),
  option2Name: z.string().trim().max(80).nullable().optional(),
  option2Value: z.string().trim().max(80).nullable().optional(),
  option3Name: z.string().trim().max(80).nullable().optional(),
  option3Value: z.string().trim().max(80).nullable().optional(),
  price: priceSchema.nullable().optional(),
  quantity: z.number().int().min(0).nullable().optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(120),
  title: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(20000).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  price: priceSchema.nullable().optional(),
  currency: currencySchema.optional(),
  quantity: z.number().int().min(0).nullable().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  barcodeType: z.enum(BARCODE_TYPES).nullable().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  images: z.array(imageSchema).max(20).optional(),
});

const patchProductSchema = createProductSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  brand: z.string().trim().max(120).optional(),
  categoryId: z.uuid().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  sort: z.enum(["updated_at", "sku", "title", "price"]).default("updated_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  hasIssues: z.enum(["true", "false"]).optional(),
});

function duplicateSku(error: unknown): never {
  if (postgresErrorCode(error) === "23505") {
    throw new ServiceError(409, "DUPLICATE_SKU", "SKU already exists in this organization");
  }
  throw error;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function assertCategory(db: Database, organizationId: string, categoryId: string) {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.organizationId, organizationId)))
    .limit(1);
  if (!category) {
    throw new ServiceError(400, "BAD_REQUEST", "Category was not found in this organization");
  }
}

async function assertSkuAvailable(
  db: Database,
  organizationId: string,
  sku: string,
  options?: { ignoreProductId?: string; ignoreVariantsOfProductId?: string },
) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.sku, sku),
        isNull(products.deletedAt),
        options?.ignoreProductId ? sql`${products.id} <> ${options.ignoreProductId}` : undefined,
      ),
    )
    .limit(1);
  if (product) {
    throw new ServiceError(409, "DUPLICATE_SKU", "SKU already exists in this organization");
  }
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.organizationId, organizationId),
        eq(productVariants.sku, sku),
        options?.ignoreVariantsOfProductId
          ? sql`${productVariants.productId} <> ${options.ignoreVariantsOfProductId}`
          : undefined,
      ),
    )
    .limit(1);
  if (variant) {
    throw new ServiceError(409, "DUPLICATE_SKU", "SKU already exists in this organization");
  }
}

function publicListItem(
  product: typeof products.$inferSelect,
  imageCount: number,
) {
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    brand: product.brand,
    price: product.price,
    currency: product.currency.trim(),
    status: product.status as ProductStatus,
    qualityScore: product.qualityScore,
    imageCount,
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function snapshotProduct(db: Database, productId: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId));
  return { product, variants, images };
}

async function writeRevision(
  db: Database,
  organizationId: string,
  productId: string,
  userId: string,
  changeSource: string,
) {
  const [current] = await db
    .select({ revision: sql<number>`coalesce(max(${productRevisions.revision}), 0)::int` })
    .from(productRevisions)
    .where(eq(productRevisions.productId, productId));
  const snapshot = await snapshotProduct(db, productId);
  await db.insert(productRevisions).values({
    organizationId,
    productId,
    revision: Number(current?.revision ?? 0) + 1,
    snapshotJson: JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>,
    changeSource,
    changedBy: userId,
  });
}

async function replaceImages(
  db: Database,
  organizationId: string,
  productId: string,
  images: z.infer<typeof imageSchema>[],
) {
  await db.delete(productImages).where(eq(productImages.productId, productId));
  if (images.length === 0) return;
  await db.insert(productImages).values(
    images.map((image, index) => ({
      organizationId,
      productId,
      url: image.url,
      position: image.position ?? index,
      altText: image.altText ?? null,
      status: "valid" as const,
    })),
  );
}

async function syncAttributes(
  db: Database,
  organizationId: string,
  productId: string,
  attributes: Record<string, string | number | boolean>,
) {
  await db.delete(productAttributes).where(eq(productAttributes.productId, productId));
  const rows = Object.entries(attributes).map(([key, value]) => ({
    organizationId,
    productId,
    key,
    valueText: typeof value === "string" ? value : null,
    valueNumber: typeof value === "number" ? value.toString() : null,
    valueBool: typeof value === "boolean" ? value : null,
  }));
  if (rows.length > 0) {
    await db.insert(productAttributes).values(rows);
  }
}

export async function createCategory(db: Database, organizationId: string, name: string) {
  const parsed = z.string().trim().min(1).max(120).parse(name);
  const [category] = await db
    .insert(categories)
    .values({ organizationId, name: parsed })
    .returning();
  if (!category) {
    throw new ServiceError(500, "INTERNAL", "Could not create category");
  }
  return { id: category.id, name: category.name };
}

export async function listCategories(db: Database, organizationId: string) {
  const rows = await db
    .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(asc(categories.name));
  return rows;
}

export async function findActiveProductBySku(
  db: Database,
  organizationId: string,
  sku: string,
) {
  const [product] = await db
    .select({ id: products.id, updatedAt: products.updatedAt })
    .from(products)
    .where(
      and(eq(products.organizationId, organizationId), eq(products.sku, sku), isNull(products.deletedAt)),
    )
    .limit(1);
  return product ?? null;
}

export async function captureProductRevision(
  db: Database,
  organizationId: string,
  productId: string,
  userId: string,
  changeSource: string,
) {
  await writeRevision(db, organizationId, productId, userId, changeSource);
}

type ProductWriteOptions = {
  sourceImportId?: string;
  changeSource?: string;
};

export async function createProduct(
  db: Database,
  actorUserId: string,
  organizationId: string,
  input: unknown,
  options?: ProductWriteOptions,
) {
  const data = createProductSchema.parse(input);
  if (data.categoryId) {
    await assertCategory(db, organizationId, data.categoryId);
  }
  await assertSkuAvailable(db, organizationId, data.sku);

  try {
    return await db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      const [product] = await database
        .insert(products)
        .values({
          organizationId,
          sku: data.sku,
          title: data.title ?? null,
          description: data.description ?? null,
          brand: data.brand ?? null,
          categoryId: data.categoryId ?? null,
          price: data.price ?? null,
          currency: data.currency ?? "USD",
          quantity: data.quantity ?? null,
          status: data.status ?? "draft",
          barcode: data.barcode ?? null,
          barcodeType: data.barcodeType ?? null,
          attributesJson: data.attributes ?? {},
          sourceImportId: options?.sourceImportId ?? null,
        })
        .returning();
      if (!product) {
        throw new ServiceError(500, "INTERNAL", "Could not create product");
      }
      if (data.images) {
        await replaceImages(database, organizationId, product.id, data.images);
      }
      if (data.attributes) {
        await syncAttributes(database, organizationId, product.id, data.attributes);
      }
      await writeRevision(
        database,
        organizationId,
        product.id,
        actorUserId,
        options?.changeSource ?? "manual",
      );
      await recordActivity(database, {
        organizationId,
        actorUserId,
        entityType: "product",
        entityId: product.id,
        action: "created",
        metadata: { sku: product.sku },
      });
      return getProduct(database, organizationId, product.id);
    });
  } catch (error) {
    duplicateSku(error);
  }
}

export async function getProduct(db: Database, organizationId: string, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.organizationId, organizationId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  if (!product) {
    return null;
  }
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(asc(productVariants.sku));
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(asc(productImages.position));
  return {
    ...publicListItem(product, images.length),
    description: product.description,
    categoryId: product.categoryId,
    quantity: product.quantity,
    barcode: product.barcode,
    barcodeType: product.barcodeType,
    attributes: product.attributesJson,
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      option1Name: variant.option1Name,
      option1Value: variant.option1Value,
      option2Name: variant.option2Name,
      option2Value: variant.option2Value,
      option3Name: variant.option3Name,
      option3Value: variant.option3Value,
      price: variant.price,
      quantity: variant.quantity,
      barcode: variant.barcode,
      status: variant.status,
    })),
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      position: image.position,
      altText: image.altText,
      status: image.status,
    })),
  };
}

export async function listProducts(db: Database, organizationId: string, input: unknown) {
  const query = listSchema.parse(input);
  const filters = [
    eq(products.organizationId, organizationId),
    isNull(products.deletedAt),
  ];
  if (query.status) filters.push(eq(products.status, query.status));
  if (query.brand) filters.push(eq(products.brand, query.brand));
  if (query.categoryId) filters.push(eq(products.categoryId, query.categoryId));
  if (query.minScore !== undefined) filters.push(gte(products.qualityScore, query.minScore));
  if (query.maxScore !== undefined) filters.push(lte(products.qualityScore, query.maxScore));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(or(ilike(products.title, pattern), ilike(products.sku, pattern))!);
  }
  if (query.hasIssues) {
    const exists = sql`exists (
      select 1 from validation_issues
      where validation_issues.product_id = ${products.id}
        and validation_issues.status = 'open'
    )`;
    filters.push(query.hasIssues === "true" ? exists : sql`not ${exists}`);
  }
  if (query.cursor && query.sort === "updated_at") {
    let decoded: { updatedAt: string; id: string };
    try {
      decoded = z
        .object({ updatedAt: z.string(), id: z.uuid() })
        .parse(JSON.parse(Buffer.from(query.cursor, "base64url").toString()));
    } catch {
      throw new ServiceError(400, "BAD_REQUEST", "Invalid cursor");
    }
    const updatedAt = new Date(decoded.updatedAt);
    filters.push(
      query.order === "desc"
        ? sql`(${products.updatedAt}, ${products.id}) < (${updatedAt}, ${decoded.id})`
        : sql`(${products.updatedAt}, ${products.id}) > (${updatedAt}, ${decoded.id})`,
    );
  }

  const direction = query.order === "asc" ? asc : desc;
  const sortColumn =
    query.sort === "sku"
      ? products.sku
      : query.sort === "title"
        ? products.title
        : query.sort === "price"
          ? products.price
          : products.updatedAt;

  const offset = query.sort === "updated_at" || !query.page ? 0 : (query.page - 1) * query.limit;
  const imageCounts = db
    .select({
      productId: productImages.productId,
      imageCount: sql<number>`count(*)::int`.as("image_count"),
    })
    .from(productImages)
    .groupBy(productImages.productId)
    .as("image_counts");
  const rows = await db
    .select({
      product: products,
      imageCount: sql<number>`coalesce(${imageCounts.imageCount}, 0)`,
    })
    .from(products)
    .leftJoin(imageCounts, eq(imageCounts.productId, products.id))
    .where(and(...filters))
    .orderBy(direction(sortColumn), direction(products.id))
    .limit(query.limit + 1)
    .offset(offset);

  const pageRows = rows.slice(0, query.limit);
  const hasMore = rows.length > query.limit;
  const last = pageRows.at(-1)?.product;
  const nextCursor =
    hasMore && last && query.sort === "updated_at"
      ? Buffer.from(
          JSON.stringify({ updatedAt: last.updatedAt.toISOString(), id: last.id }),
        ).toString("base64url")
      : null;

  return {
    data: pageRows.map((row) => publicListItem(row.product, Number(row.imageCount ?? 0))),
    pagination: {
      limit: query.limit,
      nextCursor,
      prevCursor: null,
    },
  };
}

export async function updateProduct(
  db: Database,
  actorUserId: string,
  organizationId: string,
  productId: string,
  input: unknown,
  options?: ProductWriteOptions,
) {
  const data = patchProductSchema.parse(input);
  const existing = await getProduct(db, organizationId, productId);
  if (!existing) {
    throw new ServiceError(404, "NOT_FOUND", "Product not found");
  }
  if (data.categoryId) {
    await assertCategory(db, organizationId, data.categoryId);
  }
  if (data.sku && data.sku !== existing.sku) {
    await assertSkuAvailable(db, organizationId, data.sku, { ignoreProductId: productId });
  }

  try {
    await db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      await database
        .update(products)
        .set({
          ...(data.sku !== undefined ? { sku: data.sku } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.brand !== undefined ? { brand: data.brand } : {}),
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.price !== undefined ? { price: data.price } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
          ...(data.barcodeType !== undefined ? { barcodeType: data.barcodeType } : {}),
          ...(data.attributes !== undefined ? { attributesJson: data.attributes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));
      if (data.images) {
        await replaceImages(database, organizationId, productId, data.images);
      }
      if (data.attributes) {
        await syncAttributes(database, organizationId, productId, data.attributes);
      }
      await writeRevision(
        database,
        organizationId,
        productId,
        actorUserId,
        options?.changeSource ?? "manual",
      );
      await recordActivity(database, {
        organizationId,
        actorUserId,
        entityType: "product",
        entityId: productId,
        action: "updated",
      });
    });
  } catch (error) {
    duplicateSku(error);
  }

  return getProduct(db, organizationId, productId);
}

export async function softDeleteProduct(
  db: Database,
  actorUserId: string,
  organizationId: string,
  productId: string,
) {
  const existing = await getProduct(db, organizationId, productId);
  if (!existing) {
    throw new ServiceError(404, "NOT_FOUND", "Product not found");
  }
  await db.transaction(async (tx) => {
    const database = tx as unknown as Database;
    await writeRevision(database, organizationId, productId, actorUserId, "manual");
    await database
      .update(products)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(products.id, productId));
    await database.delete(productVariants).where(eq(productVariants.productId, productId));
    await recordActivity(database, {
      organizationId,
      actorUserId,
      entityType: "product",
      entityId: productId,
      action: "deleted",
    });
  });
}

export async function replaceVariants(
  db: Database,
  actorUserId: string,
  organizationId: string,
  productId: string,
  input: unknown,
) {
  const data = z.object({ variants: z.array(variantSchema).max(100) }).parse(input);
  const existing = await getProduct(db, organizationId, productId);
  if (!existing) {
    throw new ServiceError(404, "NOT_FOUND", "Product not found");
  }
  const skus = new Set<string>();
  for (const variant of data.variants) {
    if (skus.has(variant.sku) || variant.sku === existing.sku) {
      throw new ServiceError(409, "DUPLICATE_SKU", "SKU already exists in this organization");
    }
    skus.add(variant.sku);
    await assertSkuAvailable(db, organizationId, variant.sku, {
      ignoreProductId: productId,
      ignoreVariantsOfProductId: productId,
    });
  }

  try {
    await db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      await database.delete(productVariants).where(eq(productVariants.productId, productId));
      if (data.variants.length > 0) {
        await database.insert(productVariants).values(
          data.variants.map((variant) => ({
            organizationId,
            productId,
            sku: variant.sku,
            option1Name: variant.option1Name ?? null,
            option1Value: variant.option1Value ?? null,
            option2Name: variant.option2Name ?? null,
            option2Value: variant.option2Value ?? null,
            option3Name: variant.option3Name ?? null,
            option3Value: variant.option3Value ?? null,
            price: variant.price ?? null,
            quantity: variant.quantity ?? null,
            barcode: variant.barcode ?? null,
            status: variant.status ?? "active",
          })),
        );
      }
      await database
        .update(products)
        .set({ updatedAt: new Date() })
        .where(eq(products.id, productId));
      await writeRevision(database, organizationId, productId, actorUserId, "manual");
      await recordActivity(database, {
        organizationId,
        actorUserId,
        entityType: "product",
        entityId: productId,
        action: "variants_replaced",
      });
    });
  } catch (error) {
    duplicateSku(error);
  }

  return getProduct(db, organizationId, productId);
}

export async function getProductHistory(
  db: Database,
  organizationId: string,
  productId: string,
) {
  const product = await getProduct(db, organizationId, productId);
  if (!product) {
    throw new ServiceError(404, "NOT_FOUND", "Product not found");
  }
  const revisions = await db
    .select({
      id: productRevisions.id,
      revision: productRevisions.revision,
      changeSource: productRevisions.changeSource,
      changedBy: productRevisions.changedBy,
      createdAt: productRevisions.createdAt,
      snapshotJson: productRevisions.snapshotJson,
    })
    .from(productRevisions)
    .where(
      and(
        eq(productRevisions.productId, productId),
        eq(productRevisions.organizationId, organizationId),
      ),
    )
    .orderBy(desc(productRevisions.revision));
  return {
    revisions: revisions.map((revision) => ({
      ...revision,
      createdAt: revision.createdAt.toISOString(),
    })),
  };
}
