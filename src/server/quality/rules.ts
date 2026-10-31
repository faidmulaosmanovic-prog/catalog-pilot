import { SCORE_WEIGHT, type Severity } from "@/server/db/schema/constants";

export type RuleView = {
  code: string;
  severity: Severity;
  isEnabled: boolean;
};

export type ProductFacts = {
  id: string;
  sku: string;
  title: string | null;
  description: string | null;
  brand: string | null;
  price: string | null;
  barcode: string | null;
  imageUrls: string[];
  attributeCount: number;
  variantSkus: string[];
};

export type Finding = {
  ruleCode: string;
  severity: Severity;
  message: string;
  field: string | null;
};

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const BARCODE_PATTERN = /^(?:\d{8}|\d{12,14})$/;
const IMAGE_URL_PATTERN = /^https?:\/\/\S+$/;

export function qualityScore(findings: Array<{ severity: Severity }>) {
  const penalty = findings.reduce((total, finding) => total + SCORE_WEIGHT[finding.severity], 0);
  return Math.max(0, 100 - penalty);
}

export function evaluateProduct(
  product: ProductFacts,
  rules: RuleView[],
  catalogs: {
    skuOwners: Map<string, Set<string>>;
    barcodeOwners: Map<string, Set<string>>;
  },
): Finding[] {
  const enabled = new Map(rules.filter((rule) => rule.isEnabled).map((rule) => [rule.code, rule]));
  const findings: Finding[] = [];

  function add(code: string, message: string, field: string | null) {
    const rule = enabled.get(code);
    if (!rule) {
      return;
    }
    findings.push({ ruleCode: code, severity: rule.severity, message, field });
  }

  if (!SKU_PATTERN.test(product.sku)) {
    add("invalid_sku", "SKU must use letters, numbers, dot, underscore, or hyphen", "sku");
  }
  const skuOwners = catalogs.skuOwners.get(product.sku) ?? new Set<string>();
  const foreignSku = [...skuOwners].some((ownerId) => ownerId !== product.id);
  if (foreignSku) {
    add("duplicate_sku", "SKU is already used in this organization", "sku");
  }
  if (!product.title?.trim()) {
    add("missing_title", "Title is empty", "title");
  }
  if (!product.description?.trim()) {
    add("missing_description", "Description is empty", "description");
  }
  if (!product.brand?.trim()) {
    add("missing_brand", "Brand is empty", "brand");
  }
  if (product.price === null || product.price.trim() === "" || Number(product.price) < 0) {
    add("invalid_price", "Price is missing or negative", "price");
  }
  if (product.barcode && !BARCODE_PATTERN.test(product.barcode)) {
    add("invalid_barcode", "Barcode must be 8, 12, 13, or 14 digits", "barcode");
  }
  if (product.barcode) {
    const owners = catalogs.barcodeOwners.get(product.barcode) ?? new Set<string>();
    if ([...owners].some((ownerId) => ownerId !== product.id)) {
      add("duplicate_barcode", "Barcode is already used in this organization", "barcode");
    }
  }
  if (product.imageUrls.length === 0) {
    add("missing_image", "Product has no image", "images");
  }
  if (product.imageUrls.some((url) => !IMAGE_URL_PATTERN.test(url))) {
    add("invalid_image_url", "An image URL must start with http:// or https://", "images");
  }
  if (product.attributeCount === 0) {
    add("missing_attributes", "Product has no attributes", "attributes");
  }
  if (product.variantSkus.some((sku) => sku === product.sku)) {
    add("inconsistent_variant", "A variant uses the same SKU as the parent product", "variants");
  }
  return findings;
}
