/**
 * CatalogPilot Drizzle schema.
 *
 * Domain tables are added per database phase.
 * See docs/development/DATABASE_PHASES.md.
 */

export { MEMBER_ROLES, JOB_RUN_STATUSES } from "./constants";
export type { MemberRole, JobRunStatus } from "./constants";
export {
  users,
  organizations,
  organizationMembers,
  organizationInvites,
} from "./identity";
export { activityLogs, jobRuns } from "./audit";
export { sessions, accounts, verifications } from "./auth-tables";
export { imports, importMappings } from "./imports";
export {
  categories,
  products,
  productVariants,
  productAttributes,
  productImages,
  productRevisions,
  importRows,
} from "./catalog";
