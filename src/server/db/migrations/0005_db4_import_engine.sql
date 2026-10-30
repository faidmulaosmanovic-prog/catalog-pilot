-- DB-4: imports, mappings, failed rows, and products.source_import_id foreign key.
CREATE TABLE "import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_column" text NOT NULL,
	"target_field" text NOT NULL,
	"transform" text
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_json" jsonb,
	"status" text,
	"error_message" text,
	"product_id" uuid,
	CONSTRAINT "import_rows_status_check" CHECK ("import_rows"."status" is null or "import_rows"."status" in ('preview', 'success', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid,
	"file_name" text NOT NULL,
	"file_r2_key" text NOT NULL,
	"file_size_bytes" bigint,
	"file_content_hash" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"encoding" text,
	"delimiter" text,
	"header_row" integer DEFAULT 1 NOT NULL,
	"mode" text DEFAULT 'create' NOT NULL,
	"total_rows" integer,
	"success_rows" integer,
	"failed_rows" integer,
	"error_r2_key" text,
	"idempotency_key" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imports_status_check" CHECK ("imports"."status" in ('uploaded', 'mapping', 'validated', 'queued', 'processing', 'completed', 'failed', 'rolled_back')),
	CONSTRAINT "imports_mode_check" CHECK ("imports"."mode" in ('create', 'upsert'))
);
--> statement-breakpoint
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_mappings_import_source_unique" ON "import_mappings" USING btree ("import_id","source_column");--> statement-breakpoint
CREATE INDEX "import_rows_import_status_idx" ON "import_rows" USING btree ("import_id","status");--> statement-breakpoint
CREATE INDEX "import_rows_import_row_number_idx" ON "import_rows" USING btree ("import_id","row_number");--> statement-breakpoint
CREATE INDEX "imports_org_created_at_idx" ON "imports" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "imports_org_file_content_hash_idx" ON "imports" USING btree ("organization_id","file_content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "imports_org_idempotency_key_unique" ON "imports" USING btree ("organization_id","idempotency_key") WHERE "imports"."idempotency_key" is not null;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_source_import_id_imports_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;