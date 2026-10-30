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
