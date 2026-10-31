-- DB-7: channels, versioned templates, listings, and export jobs.
CREATE TABLE "channel_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"last_exported_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "channel_listings_product_channel_unique" UNIQUE("product_id","channel_id"),
	CONSTRAINT "channel_listings_status_check" CHECK ("channel_listings"."status" in ('ready', 'exported', 'error'))
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "channels_code_unique" UNIQUE("code"),
	CONSTRAINT "channels_type_check" CHECK ("channels"."type" in ('csv_template', 'api'))
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid,
	"channel_id" uuid NOT NULL,
	"template_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"product_count" integer,
	"file_r2_key" text,
	"error_report_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "export_jobs_status_check" CHECK ("export_jobs"."status" in ('queued', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "marketplace_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"mapping_schema" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_templates_channel_version_unique" UNIQUE("channel_id","version")
);
--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_template_id_marketplace_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."marketplace_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_templates" ADD CONSTRAINT "marketplace_templates_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_listings_org_channel_idx" ON "channel_listings" USING btree ("organization_id","channel_id");--> statement-breakpoint
CREATE INDEX "export_jobs_org_created_idx" ON "export_jobs" USING btree ("organization_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
-- System channels and CatalogPilot 2026.1 CSV templates. Inserts are idempotent.
INSERT INTO "channels" ("code", "name", "type", "is_active") VALUES
  ('shopify', 'Shopify', 'csv_template', true),
  ('amazon', 'Amazon', 'csv_template', true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "marketplace_templates" ("channel_id", "version", "name", "mapping_schema", "is_default")
SELECT c.id, '2026.1', 'Shopify product CSV', $shop${"headers":["Handle","Title","Body (HTML)","Vendor","Published","Option1 Name","Option1 Value","Variant SKU","Variant Price","Variant Inventory Qty","Variant Barcode","Image Src","Status"],"requiredFields":["Variant SKU"],"allowedValues":{"Published":["TRUE","FALSE"],"Status":["active","draft","archived"]},"mappingRules":[{"targetColumn":"Handle","source":{"type":"transform","name":"handle"}},{"targetColumn":"Title","source":{"type":"field","path":"title"}},{"targetColumn":"Body (HTML)","source":{"type":"field","path":"description"}},{"targetColumn":"Vendor","source":{"type":"field","path":"brand"}},{"targetColumn":"Published","source":{"type":"transform","name":"published"}},{"targetColumn":"Option1 Name","source":{"type":"field","path":"option1Name"}},{"targetColumn":"Option1 Value","source":{"type":"field","path":"option1Value"}},{"targetColumn":"Variant SKU","source":{"type":"field","path":"sku"}},{"targetColumn":"Variant Price","source":{"type":"field","path":"price"}},{"targetColumn":"Variant Inventory Qty","source":{"type":"field","path":"quantity"}},{"targetColumn":"Variant Barcode","source":{"type":"field","path":"barcode"}},{"targetColumn":"Image Src","source":{"type":"field","path":"imageUrl"}},{"targetColumn":"Status","source":{"type":"field","path":"status"}}]}$shop$::jsonb, true
FROM "channels" c WHERE c.code = 'shopify'
ON CONFLICT ("channel_id", "version") DO NOTHING;
--> statement-breakpoint
INSERT INTO "marketplace_templates" ("channel_id", "version", "name", "mapping_schema", "is_default")
SELECT c.id, '2026.1', 'Amazon generic inventory CSV', $amz${"headers":["sku","product-id","product-id-type","item-name","brand-name","item-price","quantity","main-image-url","product-description"],"requiredFields":["sku","item-name","item-price"],"allowedValues":{"product-id-type":["","UPC","EAN","GTIN"]},"mappingRules":[{"targetColumn":"sku","source":{"type":"field","path":"sku"}},{"targetColumn":"product-id","source":{"type":"field","path":"barcode"}},{"targetColumn":"product-id-type","source":{"type":"transform","name":"productIdType"}},{"targetColumn":"item-name","source":{"type":"field","path":"title"}},{"targetColumn":"brand-name","source":{"type":"field","path":"brand"}},{"targetColumn":"item-price","source":{"type":"field","path":"price"}},{"targetColumn":"quantity","source":{"type":"field","path":"quantity"}},{"targetColumn":"main-image-url","source":{"type":"field","path":"imageUrl"}},{"targetColumn":"product-description","source":{"type":"field","path":"description"}}]}$amz$::jsonb, true
FROM "channels" c WHERE c.code = 'amazon'
ON CONFLICT ("channel_id", "version") DO NOTHING;
