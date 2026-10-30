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
