-- DB-3: catalog core. source_import_id has no foreign key until DB-4.
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value_text" text,
	"value_number" numeric,
	"value_bool" boolean,
	"unit" text,
	CONSTRAINT "product_attributes_product_key_unique" UNIQUE("product_id","key")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"alt_text" text,
	"width" integer,
	"height" integer,
	"content_hash" text,
	"r2_key" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_status_check" CHECK ("product_images"."status" is null or "product_images"."status" in ('pending', 'valid', 'invalid'))
);
--> statement-breakpoint
CREATE TABLE "product_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"change_source" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_revisions_product_revision_unique" UNIQUE("product_id","revision")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"option1_name" text,
	"option1_value" text,
	"option2_name" text,
	"option2_value" text,
	"option3_name" text,
	"option3_value" text,
	"price" numeric(12, 2),
	"quantity" integer,
	"barcode" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_org_sku_unique" UNIQUE("organization_id","sku"),
	CONSTRAINT "product_variants_status_check" CHECK ("product_variants"."status" in ('draft', 'active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"title" text,
	"description" text,
	"brand" text,
	"category_id" uuid,
	"price" numeric(12, 2),
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"quantity" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"barcode" text,
	"barcode_type" text,
	"quality_score" integer,
	"attributes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_status_check" CHECK ("products"."status" in ('draft', 'active', 'archived')),
	CONSTRAINT "products_barcode_type_check" CHECK ("products"."barcode_type" is null or "products"."barcode_type" in ('upc', 'ean', 'gtin', 'other')),
	CONSTRAINT "products_quality_score_check" CHECK ("products"."quality_score" is null or ("products"."quality_score" >= 0 and "products"."quality_score" <= 100))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_revisions" ADD CONSTRAINT "product_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_revisions" ADD CONSTRAINT "product_revisions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_revisions" ADD CONSTRAINT "product_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_org_name_idx" ON "categories" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "categories_org_parent_idx" ON "categories" USING btree ("organization_id","parent_id");--> statement-breakpoint
CREATE INDEX "product_attributes_org_key_value_idx" ON "product_attributes" USING btree ("organization_id","key","value_text");--> statement-breakpoint
CREATE INDEX "product_images_org_product_position_idx" ON "product_images" USING btree ("organization_id","product_id","position");--> statement-breakpoint
CREATE INDEX "product_images_org_content_hash_idx" ON "product_images" USING btree ("organization_id","content_hash") WHERE "product_images"."content_hash" is not null;--> statement-breakpoint
CREATE INDEX "product_variants_org_product_idx" ON "product_variants" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_sku_active_unique" ON "products" USING btree ("organization_id","sku") WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_org_updated_at_idx" ON "products" USING btree ("organization_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "products_org_status_idx" ON "products" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "products_org_brand_idx" ON "products" USING btree ("organization_id","brand");--> statement-breakpoint
CREATE INDEX "products_org_barcode_idx" ON "products" USING btree ("organization_id","barcode") WHERE "products"."barcode" is not null;