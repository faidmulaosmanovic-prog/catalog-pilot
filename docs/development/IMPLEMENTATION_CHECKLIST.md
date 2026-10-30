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

- [ ] Migration: categories  
- [ ] Migration: products (+ indexes, SKU unique per org)  
- [ ] Migration: product_variants, product_attributes, product_images  
- [ ] Migration: product_revisions  
- [ ] ProductService CRUD org-scoped  
- [ ] Soft delete + revision on update  

### Then Catalog API → UI

- [ ] Products REST endpoints  
- [ ] Products list (search/filter/sort/pagination)  
- [ ] Detail/edit + variants basic UI  
- [ ] Image URL management  
- [ ] Empty/loading/error states  
- [ ] History panel  

---

## DB-4 — Import (database first)

- [ ] Migration: imports, import_mappings, import_rows  
- [ ] FK products.source_import_id → imports  
- [ ] Status + content hash indexes  

### Then Import API → UI

- [ ] Upload + R2 + hash  
- [ ] Encoding/BOM + delimiter detection  
- [ ] Mapping UI/API  
- [ ] Preview + validation  
- [ ] Confirm + enqueue + worker batches  
- [ ] Error report + history  
- [ ] Soft rollback  
- [ ] Single-active-import lock  
- [ ] Idempotency-Key on confirm  
- [ ] Fixture tests (BOM, quotes, delimiters, dup SKUs, large file)  
- [ ] Import wizard UI  

---

## DB-5 — Data quality (database first)

- [ ] Migration: validation_rules, validation_runs, validation_issues  
- [ ] Seed system rules  

### Then Validation API → UI

- [ ] Rule runner job  
- [ ] Quality score update  
- [ ] Issues API  
- [ ] Data Quality UI (filters, ignore, re-run)  
- [ ] Post-import validation hook  

---

## DB-6 — Bulk editor (database first)

- [ ] Migration: bulk_edit_jobs, bulk_edit_changes  

### Then Bulk API → UI

- [ ] Preview API  
- [ ] Apply worker + operations set  
- [ ] Rollback  
- [ ] Bulk Editor UI + confirmations  
- [ ] Audit logs  

---

## DB-7 — Channels & export (database first)

- [ ] Migration: channels, marketplace_templates, channel_listings, export_jobs  
- [ ] Seed shopify + amazon csv_template 2026.1  

### Then Export API → UI

- [ ] MarketplaceAdapter interface + registry  
- [ ] ShopifyCsvAdapter + AmazonCsvAdapter  
- [ ] Export job worker + signed download  
- [ ] Pre-export validation  
- [ ] Export history UI  
- [ ] Golden file tests  

---

## DB-8 — Billing (database first)

- [ ] Migration: plans, plan_limits, subscriptions, usage_records  
- [ ] Seed starter/growth/pro + limits (AI credits = 0 until V1.1)  

### Then Billing API → UI

- [ ] Stripe customer per org  
- [ ] Checkout + portal  
- [ ] Webhook verify + idempotency  
- [ ] Trial + usage meters  
- [ ] Gate import/export/product create  
- [ ] Billing UI  

---

## Phase 9 — Production

- [ ] Rate limits  
- [ ] Sentry alerts  
- [ ] Backup restore drill  
- [ ] Legal pages  
- [ ] Security checklist review  
- [ ] Sample CSV + onboarding checklist  

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
