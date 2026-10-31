import type { BulkTextField } from "@/server/db/schema/constants";

export type AttributeValue = string | number | boolean;

export type BulkProduct = {
  id: string;
  sku: string;
  title: string | null;
  description: string | null;
  brand: string | null;
  price: string | null;
  categoryId: string | null;
  status: string;
  attributes: Record<string, AttributeValue>;
};

export type PlannedChange = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  patch: Record<string, unknown>;
};

export type PlanResult =
  | { kind: "change"; change: PlannedChange }
  | { kind: "unchanged" }
  | { kind: "skipped"; reason: string };

type TextConfig = { field: BulkTextField; find: string; replace: string };
type AppendConfig = { field: BulkTextField; text: string };
type PriceConfig = { mode: "set" | "percent" | "delta"; value: number };
type BrandConfig = { brand: string | null };
type CategoryConfig = { categoryId: string | null };
type AttributeConfig = { mode: "merge" | "replace"; attributes: Record<string, AttributeValue> };
type NormalizeConfig = {
  field: BulkTextField;
  trim: boolean;
  collapseWhitespace: boolean;
  case: "none" | "lower" | "upper" | "title";
};
type StatusConfig = { status: string };

export type BulkConfig =
  | { operation: "replace_text"; config: TextConfig }
  | { operation: "append_text"; config: AppendConfig }
  | { operation: "prepend_text"; config: AppendConfig }
  | { operation: "update_price"; config: PriceConfig }
  | { operation: "update_brand"; config: BrandConfig }
  | { operation: "update_category"; config: CategoryConfig }
  | { operation: "update_attributes"; config: AttributeConfig }
  | { operation: "normalize"; config: NormalizeConfig }
  | { operation: "update_status"; config: StatusConfig };

function textOf(product: BulkProduct, field: BulkTextField) {
  return product[field];
}

function sameText(before: string | null, after: string | null) {
  return (before ?? "") === (after ?? "") && before === after;
}

function textChange(field: BulkTextField, before: string | null, after: string | null): PlanResult {
  if (before === after) {
    return { kind: "unchanged" };
  }
  return {
    kind: "change",
    change: { before: { [field]: before }, after: { [field]: after }, patch: { [field]: after } },
  };
}

function applyCase(value: string, mode: NormalizeConfig["case"]) {
  if (mode === "lower") return value.toLowerCase();
  if (mode === "upper") return value.toUpperCase();
  if (mode === "title") {
    return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return value;
}

function toCents(price: string) {
  const [whole, fraction = ""] = price.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function priceChange(product: BulkProduct, config: PriceConfig): PlanResult {
  if (config.mode !== "set" && (product.price === null || product.price.trim() === "")) {
    return { kind: "skipped", reason: "Price is missing" };
  }
  let cents: number;
  if (config.mode === "set") {
    cents = Math.round(config.value * 100);
  } else if (config.mode === "percent") {
    cents = Math.round(toCents(product.price ?? "0") * (1 + config.value / 100));
  } else {
    cents = toCents(product.price ?? "0") + Math.round(config.value * 100);
  }
  if (cents < 0) {
    return { kind: "skipped", reason: "Price would be negative" };
  }
  const after = fromCents(cents);
  if (product.price !== null && toCents(product.price) === cents) {
    return { kind: "unchanged" };
  }
  return {
    kind: "change",
    change: {
      before: { price: product.price },
      after: { price: after },
      patch: { price: after },
    },
  };
}

function attributesEqual(left: Record<string, AttributeValue>, right: Record<string, AttributeValue>) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export function planBulkChange(product: BulkProduct, input: BulkConfig): PlanResult {
  if (input.operation === "replace_text") {
    const before = textOf(product, input.config.field);
    const after = (before ?? "").split(input.config.find).join(input.config.replace);
    if (!before?.includes(input.config.find)) {
      return { kind: "unchanged" };
    }
    return textChange(input.config.field, before, after);
  }
  if (input.operation === "append_text" || input.operation === "prepend_text") {
    const before = textOf(product, input.config.field);
    const base = before ?? "";
    const after = input.operation === "append_text" ? `${base}${input.config.text}` : `${input.config.text}${base}`;
    if (sameText(before, after)) {
      return { kind: "unchanged" };
    }
    return textChange(input.config.field, before, after);
  }
  if (input.operation === "update_price") {
    return priceChange(product, input.config);
  }
  if (input.operation === "update_brand") {
    if (product.brand === input.config.brand) {
      return { kind: "unchanged" };
    }
    return {
      kind: "change",
      change: {
        before: { brand: product.brand },
        after: { brand: input.config.brand },
        patch: { brand: input.config.brand },
      },
    };
  }
  if (input.operation === "update_category") {
    if (product.categoryId === input.config.categoryId) {
      return { kind: "unchanged" };
    }
    return {
      kind: "change",
      change: {
        before: { categoryId: product.categoryId },
        after: { categoryId: input.config.categoryId },
        patch: { categoryId: input.config.categoryId },
      },
    };
  }
  if (input.operation === "update_status") {
    if (product.status === input.config.status) {
      return { kind: "unchanged" };
    }
    return {
      kind: "change",
      change: {
        before: { status: product.status },
        after: { status: input.config.status },
        patch: { status: input.config.status },
      },
    };
  }
  if (input.operation === "normalize") {
    const before = textOf(product, input.config.field);
    let after = before ?? "";
    if (input.config.collapseWhitespace) {
      after = after.replace(/\s+/g, " ");
    }
    if (input.config.trim) {
      after = after.trim();
    }
    after = applyCase(after, input.config.case);
    const stored = after === "" ? null : after;
    return textChange(input.config.field, before, stored);
  }
  const next =
    input.config.mode === "replace"
      ? input.config.attributes
      : { ...product.attributes, ...input.config.attributes };
  if (attributesEqual(product.attributes, next)) {
    return { kind: "unchanged" };
  }
  return {
    kind: "change",
    change: {
      before: { attributes: product.attributes },
      after: { attributes: next },
      patch: { attributes: next },
    },
  };
}
