/** Shared DB enums stored as text + check constraints (see DATABASE_SCHEMA.md). */

export const MEMBER_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const JOB_RUN_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const BARCODE_TYPES = ["upc", "ean", "gtin", "other"] as const;
export type BarcodeType = (typeof BARCODE_TYPES)[number];

export const IMAGE_STATUSES = ["pending", "valid", "invalid"] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

export const IMPORT_STATUSES = [
  "uploaded",
  "mapping",
  "validated",
  "queued",
  "processing",
  "completed",
  "failed",
  "rolled_back",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_MODES = ["create", "upsert"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const IMPORT_ROW_STATUSES = ["preview", "success", "failed", "skipped"] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const IMPORT_TARGET_FIELDS = [
  "sku",
  "title",
  "description",
  "brand",
  "price",
  "currency",
  "quantity",
  "barcode",
  "image_url",
  "status",
] as const;
export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

export const SEVERITIES = ["critical", "error", "warning", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ISSUE_STATUSES = ["open", "ignored", "resolved"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const VALIDATION_SCOPES = ["all", "selection", "post_import"] as const;
export type ValidationScope = (typeof VALIDATION_SCOPES)[number];

export const VALIDATION_RUN_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type ValidationRunStatus = (typeof VALIDATION_RUN_STATUSES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

export const SCORE_WEIGHT: Record<Severity, number> = {
  critical: 25,
  error: 10,
  warning: 3,
  info: 1,
};

export const BULK_OPERATIONS = [
  "replace_text",
  "append_text",
  "prepend_text",
  "update_price",
  "update_brand",
  "update_category",
  "update_attributes",
  "normalize",
  "update_status",
] as const;
export type BulkOperation = (typeof BULK_OPERATIONS)[number];

export const BULK_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "rolled_back",
] as const;
export type BulkJobStatus = (typeof BULK_JOB_STATUSES)[number];

export const BULK_TEXT_FIELDS = ["title", "description", "brand"] as const;
export type BulkTextField = (typeof BULK_TEXT_FIELDS)[number];
