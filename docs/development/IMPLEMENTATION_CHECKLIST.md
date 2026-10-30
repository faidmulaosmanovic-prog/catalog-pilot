# CatalogPilot — Implementation Checklist

**Version:** 1.0  
**Usage:** Work top-to-bottom. Do not start a phase until dependencies are checked.

---

## Global gates

- [ ] Planning docs approved (this documentation set)  
- [ ] Phase 1 hosting spike decision recorded  
- [ ] No marketplace API claims in UI copy  
- [ ] AI deferred until catalog loop stable  

---

## Phase 1 — Foundation

- [ ] Next.js + TS + Tailwind + shadcn scaffold  
- [ ] ESLint + Prettier + Vitest  
- [ ] Drizzle schema bootstrap + migrate  
- [ ] Neon (or Postgres) connected via env  
- [ ] R2 upload/download helper + signed URL  
- [ ] Queue producer/consumer spike  
- [ ] GitHub Actions CI  
- [ ] Sentry init  
- [ ] PostHog init (dev key)  
- [ ] `.env.example` documented  
- [ ] ADR: Cloudflare OpenNext vs fallback  

---

## Phase 2 — Auth & orgs

- [ ] Better Auth email/password  
- [ ] Email verification flow  
- [ ] Password reset flow  
- [ ] Profile view/edit  
- [ ] Create organization  
- [ ] Org switcher  
- [ ] Invites create/accept  
- [ ] Roles enforced in middleware/services  
- [ ] Cross-tenant access tests  

---

## Phase 3 — Product model

- [ ] Migrations for products, variants, images, categories, revisions, activity_logs  
- [ ] ProductService CRUD org-scoped  
- [ ] SKU uniqueness per org  
- [ ] Barcode fields  
- [ ] attributes_json  
- [ ] Soft delete  
- [ ] Revision on update  

---

## Phase 4 — CSV import

- [ ] Upload API + R2 store  
- [ ] Encoding/BOM detection  
- [ ] Delimiter detection  
- [ ] Header detection  
- [ ] Suggested mapping  
- [ ] Manual mapping UI  
- [ ] Preview endpoint/UI  
- [ ] Pre-commit validation  
- [ ] Confirm + enqueue  
- [ ] Worker batch upsert  
- [ ] Error report CSV  
- [ ] Import history UI  
- [ ] Soft rollback  
- [ ] Single-active-import lock  
- [ ] Idempotency-Key on confirm  
- [ ] Fixture tests (BOM, quotes, delimiters, dup SKUs, large file)  

---

## Phase 5 — Catalog UI

- [ ] Products table  
- [ ] Search/filter/sort/pagination  
- [ ] Detail/edit pages  
- [ ] Variants basic UI  
- [ ] Image URL management  
- [ ] Empty/loading/error states  
- [ ] History panel  

---

## Phase 6 — Validation

- [ ] Seed system rules  
- [ ] Rule runner job  
- [ ] Issue persistence  
- [ ] Quality score update  
- [ ] Data Quality UI  
- [ ] Severity filters  
- [ ] Ignore warnings  
- [ ] Re-run  
- [ ] Post-import validation hook  

---

## Phase 7 — Bulk editor

- [ ] Preview API  
- [ ] Apply job  
- [ ] Operations: replace/append/prepend/price/brand/category/attributes/normalize/status  
- [ ] Change snapshots  
- [ ] Rollback  
- [ ] UI wizard + confirmations  
- [ ] Audit logs  

---

## Phase 8 — Exports

- [ ] MarketplaceAdapter interface  
- [ ] ShopifyCsvAdapter + template seed  
- [ ] AmazonCsvAdapter + template seed  
- [ ] Export job worker  
- [ ] Pre-export validation  
- [ ] Signed download  
- [ ] Export history UI  
- [ ] Golden file tests  

---

## Phase 9 — AI (V1.1)

- [ ] OpenAI client + JSON schema  
- [ ] ai_generations table flows  
- [ ] Review/approve/reject UI  
- [ ] Usage credits  
- [ ] Prompt policy: no invented specs  
- [ ] Cost tracking fields  

---

## Phase 10 — Billing

- [ ] plans + plan_limits seeds  
- [ ] Stripe customer per org  
- [ ] Checkout session  
- [ ] Customer portal  
- [ ] Webhook verify + idempotency  
- [ ] Trial support  
- [ ] Usage meters  
- [ ] Gate import/export/product create  
- [ ] Billing UI  

---

## Phase 11 — Production

- [ ] Rate limits  
- [ ] Backup restore drill  
- [ ] Sentry alerts  
- [ ] Privacy/Terms pages  
- [ ] Security checklist review  
- [ ] Sample CSV + onboarding checklist  

---

## Phase 12 — Launch

- [ ] Pilot outreach list  
- [ ] Feedback log  
- [ ] Bug triage board  
- [ ] Decide Product Hunt timing  
