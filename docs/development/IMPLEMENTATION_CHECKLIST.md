# CatalogPilot — Implementation Checklist

**Version:** 1.1  
**Usage:** Work **database → service → API → UI** within each domain. Complete the matching **DB-*** phase before frontend for that domain.  
See [DATABASE_PHASES.md](./DATABASE_PHASES.md) and [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md).

---

## Global gates

- [ ] Planning docs approved  
- [ ] Hosting spike decision recorded  
- [ ] No marketplace API claims in UI copy  
- [ ] AI deferred until catalog loop stable  
- [ ] Every tenant table has `organization_id`  

---

## DB-0 + Phase 0 — Foundation

- [x] Next.js + TS + Tailwind scaffold (shadcn pending)  
- [x] ESLint + Vitest (Prettier optional later)  
- [x] Drizzle + migrate scripts (**DB-0**)  
- [x] Postgres via `DATABASE_URL` (local + CI service; Neon optional)  
- [x] CI applies migrations (`.github/workflows/ci.yml`)  
- [ ] R2 upload/download helper + signed URL  
- [ ] Queue producer/consumer spike  
- [ ] Sentry + PostHog stubs  
- [x] `.env.example`  
- [x] ADR: Cloudflare OpenNext vs fallback (interim — `docs/architecture/adr/0001-hosting.md`) 

---

## DB-1 — Identity & tenancy (database first)

- [x] Migration: users, organizations, organization_members, organization_invites  
- [x] Better Auth tables (`sessions`, `accounts`, `verifications`)  
- [x] Unique slug / membership constraints  
- [x] Integration tests for FKs  

### Then Phase 2 — Auth & orgs (API → UI)

- [x] Better Auth email/password  
- [x] Email verification + password reset  
- [x] Profile view/edit  
- [x] Create organization + switcher  
- [x] Invites create/accept  
- [x] Role middleware  
- [x] Cross-tenant access tests  
- [x] Auth/org UI screens  

---

## DB-2 — Audit & jobs

- [x] Migration: activity_logs  
- [x] Migration: job_runs  
- [x] ActivityLogService helper  

---

## DB-3 — Catalog core (database first)

- [x] Migration: categories  
- [x] Migration: products (+ indexes, SKU unique per org)  
- [x] Migration: product_variants, product_attributes, product_images  
- [x] Migration: product_revisions  
- [x] ProductService CRUD org-scoped  
- [x] Soft delete + revision on update  

### Then Catalog API → UI

- [x] Products REST endpoints  
- [x] Products list (search/filter/sort/pagination)  
- [x] Detail/edit + variants basic UI  
- [x] Image URL management  
- [x] Empty/loading/error states  
- [x] History panel  

---

## DB-4 — Import (database first)

- [x] Migration: imports, import_mappings, import_rows  
- [x] FK products.source_import_id → imports  
- [x] Status + content hash indexes  

### Then Import API → UI

- [x] Upload + R2 + hash  
- [x] Encoding/BOM + delimiter detection  
- [x] Mapping UI/API  
- [x] Preview + validation  
- [x] Confirm + enqueue + worker batches  
- [x] Error report + history  
- [x] Soft rollback  
- [x] Single-active-import lock  
- [x] Idempotency-Key on confirm  
- [x] Fixture tests (BOM, quotes, delimiters, dup SKUs). Files over 20 MB are rejected; no multi-megabyte fixture.
- [x] Import wizard UI  

---

## DB-5 — Data quality (database first)

- [x] Migration: validation_rules, validation_runs, validation_issues  
- [x] Seed system rules  

### Then Validation API → UI

- [x] Rule runner job  
- [x] Quality score update  
- [x] Issues API  
- [x] Data Quality UI (filters, ignore, re-run)  
- [x] Post-import validation hook  

---

## DB-6 — Bulk editor (database first)

- [x] Migration: bulk_edit_jobs, bulk_edit_changes  

### Then Bulk API → UI

- [x] Preview API  
- [x] Apply worker + operations set  
- [x] Rollback  
- [x] Bulk Editor UI + confirmations  
- [x] Audit logs  

---

## DB-7 — Channels & export (database first)

- [x] Migration: channels, marketplace_templates, channel_listings, export_jobs  
- [x] Seed shopify + amazon csv_template 2026.1  

### Then Export API → UI

- [x] MarketplaceAdapter interface + registry  
- [x] ShopifyCsvAdapter + AmazonCsvAdapter  
- [x] Export job worker + signed download  
- [x] Pre-export validation  
- [x] Export history UI  
- [x] Golden file tests  

---

## DB-8 — Billing (database first)

- [x] Migration: plans, plan_limits, subscriptions, usage_records  
- [x] Seed starter/growth/pro + limits (AI credits = 0 until V1.1)  

### Then Billing API → UI

- [x] Stripe customer per org  
- [x] Checkout + portal  
- [x] Webhook verify + idempotency  
- [x] Trial + usage meters  
- [x] Gate import/export/product create  
- [x] Billing UI  

---

## Phase 9 — Production

- [x] Rate limits  
- [x] Sentry alerts (capture when `SENTRY_DSN` is set; no SDK dependency)  
- [x] Backup restore drill  
- [x] Legal pages  
- [x] Security checklist review  
- [x] Sample CSV + onboarding checklist  

---

## Phase 10 — Launch

- [ ] Pilot outreach list  
- [ ] Feedback log  
- [ ] Bug triage board  
- [ ] Decide Product Hunt timing  

---

## DB-9 + AI (V1.1 only)

- [ ] Migration: ai_generations  
- [ ] OpenAI client + JSON schema  
- [ ] Review/approve/reject UI  
- [ ] Usage credits + cost fields  
- [ ] No-invented-specs evals  
