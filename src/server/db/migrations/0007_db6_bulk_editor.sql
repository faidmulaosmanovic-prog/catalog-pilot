-- DB-6: bulk edit jobs and per-product before/after snapshots.
CREATE TABLE "bulk_edit_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bulk_edit_job_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"before_json" jsonb NOT NULL,
	"after_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_edit_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid,
	"operation" text NOT NULL,
	"operation_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"product_count" integer,
	"preview_json" jsonb,
	"can_rollback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "bulk_edit_jobs_operation_check" CHECK ("bulk_edit_jobs"."operation" in ('replace_text', 'append_text', 'prepend_text', 'update_price', 'update_brand', 'update_category', 'update_attributes', 'normalize', 'update_status')),
	CONSTRAINT "bulk_edit_jobs_status_check" CHECK ("bulk_edit_jobs"."status" in ('queued', 'processing', 'completed', 'failed', 'rolled_back'))
);
--> statement-breakpoint
ALTER TABLE "bulk_edit_changes" ADD CONSTRAINT "bulk_edit_changes_bulk_edit_job_id_bulk_edit_jobs_id_fk" FOREIGN KEY ("bulk_edit_job_id") REFERENCES "public"."bulk_edit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_edit_changes" ADD CONSTRAINT "bulk_edit_changes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_edit_changes" ADD CONSTRAINT "bulk_edit_changes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_edit_jobs" ADD CONSTRAINT "bulk_edit_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_edit_jobs" ADD CONSTRAINT "bulk_edit_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bulk_edit_changes_job_idx" ON "bulk_edit_changes" USING btree ("bulk_edit_job_id");--> statement-breakpoint
CREATE INDEX "bulk_edit_changes_org_product_idx" ON "bulk_edit_changes" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "bulk_edit_jobs_org_created_idx" ON "bulk_edit_jobs" USING btree ("organization_id","created_at" DESC NULLS LAST);