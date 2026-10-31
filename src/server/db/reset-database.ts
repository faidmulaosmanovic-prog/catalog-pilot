import { sql } from "drizzle-orm";

import type { Database } from "./client";

export async function resetDatabase(db: Database) {
  await db.execute(sql`
    truncate table
      activity_logs,
      job_runs,
      import_rows,
      import_mappings,
      validation_issues,
      validation_runs,
      channel_listings,
      export_jobs,
      feedback_items,
      bulk_edit_changes,
      bulk_edit_jobs,
      product_revisions,
      product_images,
      product_attributes,
      product_variants,
      products,
      imports,
      categories,
      organization_invites,
      organization_members,
      organizations,
      sessions,
      accounts,
      verifications,
      users
    restart identity cascade
  `);
  await db.execute(sql`delete from validation_rules`);
  await db.execute(sql`
    insert into validation_rules (code, name, description, severity, is_enabled, config_json) values
      ('missing_title', 'Missing title', 'Product title is empty', 'error', true, '{"minSeverity":"warning","maxSeverity":"critical"}'),
      ('invalid_sku', 'Invalid SKU', 'SKU contains characters outside letters, numbers, dot, underscore, and hyphen', 'error', true, '{"minSeverity":"error","maxSeverity":"critical"}'),
      ('duplicate_sku', 'Duplicate SKU', 'SKU is already used by another product or variant in the organization', 'critical', true, '{"minSeverity":"error","maxSeverity":"critical"}'),
      ('invalid_barcode', 'Invalid barcode', 'Barcode is not 8, 12, 13, or 14 digits', 'error', true, '{"minSeverity":"warning","maxSeverity":"critical"}'),
      ('duplicate_barcode', 'Duplicate barcode', 'Barcode is already used by another product', 'error', true, '{"minSeverity":"warning","maxSeverity":"critical"}'),
      ('missing_image', 'Missing image', 'Product has no image', 'warning', true, '{"minSeverity":"info","maxSeverity":"error"}'),
      ('invalid_image_url', 'Invalid image URL', 'An image URL is not an http(s) address', 'error', true, '{"minSeverity":"warning","maxSeverity":"critical"}'),
      ('invalid_price', 'Invalid price', 'Price is missing or negative', 'error', true, '{"minSeverity":"warning","maxSeverity":"critical"}'),
      ('missing_description', 'Missing description', 'Product description is empty', 'warning', true, '{"minSeverity":"info","maxSeverity":"error"}'),
      ('missing_brand', 'Missing brand', 'Product brand is empty', 'warning', true, '{"minSeverity":"info","maxSeverity":"error"}'),
      ('missing_attributes', 'Missing attributes', 'Product has no attributes', 'info', true, '{"minSeverity":"info","maxSeverity":"warning"}'),
      ('inconsistent_variant', 'Inconsistent variant', 'A variant SKU matches the parent SKU', 'warning', true, '{"minSeverity":"info","maxSeverity":"error"}')
  `);
}
