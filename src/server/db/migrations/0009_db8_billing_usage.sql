-- DB-8: plans, limits, one subscription per organization, and usage.
CREATE TABLE "plan_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value_integer" integer,
	"value_json" jsonb,
	CONSTRAINT "plan_limits_plan_key_unique" UNIQUE("plan_id","key")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"stripe_price_id_monthly" text,
	"stripe_price_id_annual" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_organization_unique" UNIQUE("organization_id"),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('trialing', 'active', 'past_due', 'canceled', 'incomplete'))
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"metric" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_records_org_period_metric_unique" UNIQUE("organization_id","period_start","metric"),
	CONSTRAINT "usage_records_metric_check" CHECK ("usage_records"."metric" in ('products', 'import_export_jobs', 'ai_credits'))
);
--> statement-breakpoint
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_records_org_period_idx" ON "usage_records" USING btree ("organization_id","period_start");
--> statement-breakpoint
-- Starter, Growth, and Pro. Caps live in plan_limits so they can change without a deploy.
-- Product and job numbers follow the PRD table. Pro jobs are seeded at 500.
-- Every plan includes both MVP CSV templates so a trial can export Shopify and Amazon.
-- AI credits stay 0 until AI Studio.
INSERT INTO "plans" ("code", "name", "is_active", "sort_order") VALUES
  ('starter', 'Starter', true, 1),
  ('growth', 'Growth', true, 2),
  ('pro', 'Pro', true, 3)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "plan_limits" ("plan_id", "key", "value_integer", "value_json")
SELECT p.id, v.key, v.value_integer, v.value_json
FROM "plans" p
JOIN (
  SELECT 'starter' AS code, 'max_products' AS key, 2000 AS value_integer, NULL::jsonb AS value_json
  UNION ALL SELECT 'starter', 'max_import_export_jobs_monthly', 5, NULL::jsonb
  UNION ALL SELECT 'starter', 'max_members', 2, NULL::jsonb
  UNION ALL SELECT 'starter', 'export_templates', 2, '{"channels":["shopify","amazon"]}'::jsonb
  UNION ALL SELECT 'starter', 'max_ai_credits_monthly', 0, NULL::jsonb
  UNION ALL SELECT 'starter', 'trial_days', 14, NULL::jsonb
  UNION ALL SELECT 'growth', 'max_products', 20000, NULL::jsonb
  UNION ALL SELECT 'growth', 'max_import_export_jobs_monthly', 50, NULL::jsonb
  UNION ALL SELECT 'growth', 'max_members', 10, NULL::jsonb
  UNION ALL SELECT 'growth', 'export_templates', 3, '{"channels":["shopify","amazon"]}'::jsonb
  UNION ALL SELECT 'growth', 'max_ai_credits_monthly', 0, NULL::jsonb
  UNION ALL SELECT 'growth', 'trial_days', 14, NULL::jsonb
  UNION ALL SELECT 'pro', 'max_products', 50000, NULL::jsonb
  UNION ALL SELECT 'pro', 'max_import_export_jobs_monthly', 500, NULL::jsonb
  UNION ALL SELECT 'pro', 'max_members', 25, NULL::jsonb
  UNION ALL SELECT 'pro', 'export_templates', 10, '{"channels":["shopify","amazon"]}'::jsonb
  UNION ALL SELECT 'pro', 'max_ai_credits_monthly', 0, NULL::jsonb
  UNION ALL SELECT 'pro', 'trial_days', 14, NULL::jsonb
) v ON v.code = p.code
ON CONFLICT ("plan_id", "key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "subscriptions" (
  "organization_id",
  "plan_id",
  "status",
  "trial_ends_at",
  "current_period_end",
  "cancel_at_period_end"
)
SELECT o.id, p.id, 'trialing', now() + interval '14 days', now() + interval '14 days', false
FROM "organizations" o
JOIN "plans" p ON p.code = 'starter'
ON CONFLICT ("organization_id") DO NOTHING;
