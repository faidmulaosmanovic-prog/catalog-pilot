-- DB-5: validation rules, runs, and issues. System rules are seeded below.
CREATE TABLE "validation_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"rule_code" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"field" text,
	"status" text DEFAULT 'open' NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "validation_issues_severity_check" CHECK ("validation_issues"."severity" in ('critical', 'error', 'warning', 'info')),
	CONSTRAINT "validation_issues_status_check" CHECK ("validation_issues"."status" in ('open', 'ignored', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "validation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_rules_severity_check" CHECK ("validation_rules"."severity" in ('critical', 'error', 'warning', 'info'))
);
--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"scope" text NOT NULL,
	"product_count" integer,
	"issue_count" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "validation_runs_status_check" CHECK ("validation_runs"."status" in ('queued', 'processing', 'completed', 'failed')),
	CONSTRAINT "validation_runs_scope_check" CHECK ("validation_runs"."scope" in ('all', 'selection', 'post_import'))
);
--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_run_id_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."validation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_rules" ADD CONSTRAINT "validation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "validation_issues_org_status_severity_idx" ON "validation_issues" USING btree ("organization_id","status","severity");--> statement-breakpoint
CREATE INDEX "validation_issues_org_product_idx" ON "validation_issues" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "validation_issues_org_rule_code_idx" ON "validation_issues" USING btree ("organization_id","rule_code");--> statement-breakpoint
CREATE UNIQUE INDEX "validation_rules_system_code_unique" ON "validation_rules" USING btree ("code") WHERE "validation_rules"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "validation_rules_org_code_unique" ON "validation_rules" USING btree ("organization_id","code") WHERE "validation_rules"."organization_id" is not null;
--> statement-breakpoint
-- System rules. organization_id stays null so every org inherits them.
INSERT INTO "validation_rules" ("code", "name", "description", "severity", "is_enabled", "config_json") VALUES
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
  ('inconsistent_variant', 'Inconsistent variant', 'A variant SKU matches the parent SKU', 'warning', true, '{"minSeverity":"info","maxSeverity":"error"}');