import type { Severity } from "@/server/db/schema/constants";
import { escapeHtml, productIdType, toHandle } from "@/server/exports/csv";
import type { MappingRule, TemplateSchema } from "@/server/exports/templates";

export type AdapterIssue = {
  sku?: string;
  field?: string;
  code: string;
  severity: Severity;
  message: string;
};

export type VariantSnapshot = {
  sku: string;
  price: string | null;
  quantity: number | null;
  barcode: string | null;
  option1Name: string | null;
  option1Value: string | null;
};

export type ProductSnapshot = {
  id: string;
  sku: string;
  title: string | null;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
  price: string | null;
  currency: string;
  quantity: number | null;
  barcode: string | null;
  status: string;
  attributes: Record<string, unknown>;
  images: { url: string; position: number }[];
  variants: VariantSnapshot[];
};

export type CsvCells = Record<string, string>;

export interface MarketplaceAdapter {
  readonly code: string;
  readonly integrationType: "csv_template" | "api";
  getDefaultTemplateVersion(): string;
  expand(product: ProductSnapshot): CsvCells[];
  validate(rows: CsvCells[], template: TemplateSchema, product: ProductSnapshot): AdapterIssue[];
}

export function applyRules(cells: CsvCells, rules: MappingRule[]) {
  const record: Record<string, string> = {};
  for (const rule of rules) {
    record[rule.targetColumn] = valueFor(cells, rule);
  }
  return record;
}

function valueFor(cells: CsvCells, rule: MappingRule) {
  if (rule.source.type === "literal") return rule.source.value;
  if (rule.source.type === "attribute") return cells[`attribute:${rule.source.key}`] ?? "";
  if (rule.source.type === "transform") return cells[rule.source.name] ?? "";
  return cells[rule.source.path] ?? "";
}

export function baseCells(product: ProductSnapshot, variant: VariantSnapshot | null, isFirst: boolean): CsvCells {
  const sku = variant?.sku ?? product.sku;
  const price = variant?.price ?? product.price ?? "";
  const quantity = variant?.quantity ?? product.quantity;
  const barcode = variant ? (variant.barcode ?? "") : (product.barcode ?? "");
  const title = isFirst ? (product.title ?? "") : "";
  const description = isFirst ? escapeHtml(product.description ?? "") : "";
  const image = isFirst ? (product.images[0]?.url ?? "") : "";
  const attributes: CsvCells = {};
  for (const [key, value] of Object.entries(product.attributes)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[`attribute:${key}`] = String(value);
    }
  }
  return {
    ...attributes,
    sku,
    title,
    description,
    brand: isFirst ? (product.brand ?? "") : "",
    categoryName: isFirst ? (product.categoryName ?? "") : "",
    price,
    quantity: quantity === null || quantity === undefined ? "" : String(quantity),
    barcode: isFirst || variant ? barcode : "",
    status: product.status,
    imageUrl: image,
    option1Name: variant?.option1Name ?? "",
    option1Value: variant?.option1Value ?? "",
    handle: toHandle(product.title, product.sku),
    published: product.status === "active" ? "TRUE" : "FALSE",
    productIdType: productIdType(barcode),
  };
}

function priceIssue(sku: string, price: string, field: string, requirePositive: boolean): AdapterIssue | null {
  if (!price.trim()) {
    return {
      sku,
      field,
      code: "required",
      severity: requirePositive ? "error" : "warning",
      message: requirePositive ? "Price is required" : "Price is missing",
    };
  }
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0 || (requirePositive && amount <= 0)) {
    return {
      sku,
      field,
      code: "invalid_price",
      severity: "error",
      message: requirePositive ? "Price must be greater than zero" : "Price is invalid",
    };
  }
  return null;
}

export class ShopifyCsvAdapter implements MarketplaceAdapter {
  readonly code = "shopify";
  readonly integrationType = "csv_template" as const;

  getDefaultTemplateVersion() {
    return "2026.1";
  }

  expand(product: ProductSnapshot) {
    if (product.variants.length === 0) {
      return [baseCells(product, null, true)];
    }
    return product.variants.map((variant, index) => baseCells(product, variant, index === 0));
  }

  validate(rows: CsvCells[], template: TemplateSchema, product: ProductSnapshot) {
    const issues: AdapterIssue[] = [];
    const records = rows.map((row) => applyRules(row, template.mappingRules));
    if (!records.some((record) => record.Title?.trim())) {
      issues.push({
        sku: product.sku,
        field: "Title",
        code: "required",
        severity: "error",
        message: "Title is required for Shopify",
      });
    }
    for (const record of records) {
      issues.push(...genericIssues(record, template));
      const price = priceIssue(record["Variant SKU"] || product.sku, record["Variant Price"] ?? "", "Variant Price", false);
      if (price && price.severity === "error") issues.push(price);
      if (!(record["Image Src"] ?? "").trim() && record === records[0]) {
        issues.push({
          sku: product.sku,
          field: "Image Src",
          code: "missing_image",
          severity: "warning",
          message: "Image Src is empty",
        });
      }
    }
    return issues;
  }
}

export class AmazonCsvAdapter implements MarketplaceAdapter {
  readonly code = "amazon";
  readonly integrationType = "csv_template" as const;

  getDefaultTemplateVersion() {
    return "2026.1";
  }

  expand(product: ProductSnapshot) {
    return [baseCells(product, null, true)];
  }

  validate(rows: CsvCells[], template: TemplateSchema, product: ProductSnapshot) {
    const issues: AdapterIssue[] = [];
    for (const row of rows) {
      const record = applyRules(row, template.mappingRules);
      issues.push(...genericIssues(record, template));
      if ((record["item-price"] ?? "").trim()) {
        const price = priceIssue(record.sku || product.sku, record["item-price"] ?? "", "item-price", true);
        if (price) issues.push(price);
      }
      if (record["product-id"]?.trim() && !record["product-id-type"]?.trim()) {
        issues.push({
          sku: record.sku || product.sku,
          field: "product-id-type",
          code: "invalid_product_id_type",
          severity: "error",
          message: "product-id-type must be UPC, EAN, or GTIN when a product id is present",
        });
      }
      if (!(record["main-image-url"] ?? "").startsWith("http")) {
        issues.push({
          sku: record.sku || product.sku,
          field: "main-image-url",
          code: "invalid_image_url",
          severity: "warning",
          message: "main-image-url should be an http(s) address",
        });
      }
    }
    return issues;
  }
}

function genericIssues(record: Record<string, string>, template: TemplateSchema) {
  const issues: AdapterIssue[] = [];
  for (const field of template.requiredFields) {
    if (!(record[field] ?? "").trim()) {
      issues.push({
        sku: record.sku || record["Variant SKU"] || undefined,
        field,
        code: "required",
        severity: "error",
        message: `${field} is required`,
      });
    }
  }
  for (const [field, allowed] of Object.entries(template.allowedValues ?? {})) {
    const value = record[field] ?? "";
    if (value && !allowed.includes(value)) {
      issues.push({
        sku: record.sku || record["Variant SKU"] || undefined,
        field,
        code: "invalid_value",
        severity: "error",
        message: `${field} must be one of ${allowed.filter(Boolean).join(", ")}`,
      });
    }
  }
  return issues;
}

const registry: Record<string, MarketplaceAdapter> = {
  shopify: new ShopifyCsvAdapter(),
  amazon: new AmazonCsvAdapter(),
};

export function getAdapter(code: string) {
  const adapter = registry[code];
  if (!adapter) {
    throw new Error(`Unknown channel: ${code}`);
  }
  return adapter;
}

export function listAdapterCodes() {
  return Object.keys(registry);
}
