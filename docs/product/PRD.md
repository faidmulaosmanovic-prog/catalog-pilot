# CatalogPilot — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Draft — awaiting implementation approval  
**Last updated:** 2026-10-30  
**Owner:** Product / Engineering (solo founder + AI-assisted development)

---

## 1. Executive summary

CatalogPilot is a **B2B Product Data Operations Platform** that helps ecommerce businesses import, clean, validate, enrich, transform, and export product catalog data for multiple sales channels—without relying on spreadsheets and one-off scripts.

**Positioning statement:**  
> CatalogPilot helps ecommerce businesses clean, organize, validate, and prepare product catalogs for multiple sales channels — without spending hours managing spreadsheets.

**Category:** Product Data Operations (PDOP), adjacent to Product Information Management (PIM) but scoped for SMB multi-channel sellers rather than enterprise PIM.

**Primary market:** United States.

**Business model:** Monthly and annual SaaS subscriptions (Stripe Billing), with usage-based limits on products, import/export jobs, and AI credits.

---

## 2. Problem statement

Ecommerce operators manage product data across Excel, CSV files, Google Sheets, marketplace seller tools, and custom scripts. This leads to:

| Pain | Impact |
|------|--------|
| Inconsistent product information | Listing rejections, brand damage |
| Missing attributes / images | Lower conversion, channel blocks |
| Invalid SKUs and barcodes | Order/fulfillment errors |
| Duplicate products | Inventory and SEO issues |
| Channel-specific requirements | Repeated reformatting work |
| Manual bulk edits | Hours of spreadsheet labor |
| Fragile CSV pipelines | Silent data corruption |

**Jobs to be done**

1. When I receive a supplier catalog, I want to import it safely and map columns once, so I can load products without corruption.
2. When my catalog has quality issues, I want a scored, prioritized issue list, so I can fix blockers before publishing.
3. When I need the same catalog on Shopify and Amazon, I want validated channel exports, so I avoid listing errors.
4. When I edit hundreds of products, I want previewable bulk operations with rollback, so I do not break production data.

---

## 3. Goals and non-goals

### 3.1 Product goals (12–18 months)

1. Become the default **pre-publish catalog ops** tool for US SMBs managing 1k–50k SKUs.
2. Reduce time-to-clean-catalog for a typical 5k-SKU file from hours to under 30 minutes of user time. *(Hypothesis — see MARKET_ASSUMPTIONS.md)*
3. Achieve reliable multi-tenant isolation and production-grade import/export for CSV-first workflows.
4. Validate willingness to pay via paid pilots before expanding AI and marketplace APIs.

### 3.2 Non-goals (explicit)

- Full enterprise PIM (complex workflows, DAM, translation memory, MDM)
- Native mobile apps
- Marketplace **API** sync in MVP (CSV/XLSX templates only until V2+)
- AI that invents product specifications
- Complex automation (scheduled sync, Google Sheets) in MVP
- White-label / multi-brand agency portals in MVP (agency use is “multi-org membership,” not white-label)

---

## 4. Target customers

### 4.1 Ideal Customer Profile (ICP)

| Attribute | Target |
|-----------|--------|
| Geography | United States |
| Company type | Shopify merchants, Amazon/Walmart/eBay sellers, multi-channel ecommerce, wholesale distributors, ecommerce agencies |
| Catalog size | ~1,000–50,000 products |
| Team size | 1–20 people touching catalog data |
| Current tools | Excel/Sheets + marketplace UIs + occasional scripts |
| Buying trigger | Channel expansion, supplier onboarding, listing error spikes, agency client onboarding |

### 4.2 Buyer personas

**Primary — Catalog Ops Owner (Merchant or Ops Manager)**  
Owns listing quality; lives in spreadsheets; measured on listing errors and time-to-launch.

**Secondary — Agency Catalog Specialist**  
Manages multiple client catalogs; needs clear org isolation and repeatable import mappings.

**Economic buyer — Founder / Ecommerce Director**  
Cares about labor cost, channel expansion speed, and subscription ROI.

### 4.3 Anti-personas (not prioritized)

- Enterprise retailers needing MDM/PIM with SSO, custom workflows, and dedicated CSM
- Pure dropshippers with auto-synced supplier feeds and no owned catalog
- Sellers with <100 SKUs and no multi-channel needs

---

## 5. Value proposition

| For… | Who… | CatalogPilot… | Unlike… | We… |
|------|------|---------------|---------|-----|
| Multi-channel SMBs | Struggle with spreadsheet catalog chaos | Centralize import → validate → bulk fix → export | Spreadsheets, channel-native tools, enterprise PIM | Deliver channel-ready catalogs faster with auditable changes |

**Differentiation pillars**

1. **Ops-first, not AI-first** — validation, bulk edit, and export correctness before generative fluff  
2. **SMB-fit** — 1k–50k products, not enterprise complexity  
3. **Marketplace adapter architecture** — channel rules outside the core product model  
4. **Safe AI** — review-before-apply; no invented specs  

---

## 6. Product modules (overview)

| # | Module | MVP? | Notes |
|---|--------|------|-------|
| 1 | Authentication & Organizations | Yes | Better Auth; org-scoped tenancy |
| 2 | Smart Import Engine | Yes (CSV) | XLSX in V1.1 |
| 3 | Product Catalog | Yes | Variants simplified in MVP |
| 4 | Data Quality Engine | Yes (core rules) | Configurable rules expand V1.1+ |
| 5 | Bulk Editor | Yes | Preview + history |
| 6 | AI Content Studio | Post-MVP (V1.1) | After catalog workflow is reliable |
| 7 | Marketplace Export Engine | Yes (2 CSV templates) | API integrations later |
| 8 | Image Manager | Partial MVP | URL validation + missing detection; upload V1.1 |
| 9 | Automation | V2 | Future |
| 10 | Billing & Subscriptions | Yes (basic) | Stripe; configurable plan limits |

Detailed scope: [MVP_SCOPE.md](./MVP_SCOPE.md).

---

## 7. Functional requirements by module

### 7.1 Module 1 — Authentication and Organizations

**Must**

- Email/password registration, login, logout  
- Email verification  
- Password reset  
- User profile (name, email, avatar URL optional)  
- Create organization; switch active organization  
- Invite members by email; accept invite  
- Roles: `owner`, `admin`, `editor`, `viewer`  
- Enforce org-scoped data access on every tenant-owned query  

**Should (V1.1)**

- Resend verification; invite revocation  
- Transfer ownership  

**Won’t (MVP)**

- SSO/SAML, SCIM, fine-grained custom roles  

### 7.2 Module 2 — Smart Import Engine

**Must (MVP)**

- CSV upload (size limit configurable; initial target 25 MB)  
- File type validation; store original in R2  
- Encoding detection (UTF-8, UTF-8 BOM, Latin-1 fallback)  
- Delimiter detection (`,`, `;`, `\t`, `|`)  
- Header detection + automatic column mapping suggestions  
- Manual column mapping UI  
- Import preview (first N rows, e.g. 50)  
- Validation before commit (required fields, SKU format, duplicates within file)  
- Background batch processing  
- Import history + per-job error report  
- Soft rollback strategy (see IMPORT_EXPORT_ENGINE.md)  

**Should (V1.1)**

- XLSX import  
- Saved mapping profiles per organization  

**Won’t (MVP)**

- Live API pulls from marketplaces  

### 7.3 Module 3 — Product Catalog

**Must**

- List / search / filter / sort / paginate products  
- Product detail + edit  
- Core fields: SKU, title, description, brand, category, price, currency, quantity, status, barcodes (UPC/EAN/GTIN), attributes (JSON/EAV hybrid), images (URLs)  
- Product status: `draft`, `active`, `archived`  
- Simple variants: parent product + variant rows (option1/2/3 + SKU)  
- Product activity/history for create/update/import/bulk  

**Should (V1.1+)**

- Rich attribute schema per category  
- Full variant matrix UI  

### 7.4 Module 4 — Data Quality Engine

**Must**

- Configurable rule set (org can enable/disable; severity adjustable within allowed bounds)  
- Detect: missing required fields, invalid SKU, invalid barcode, duplicate SKU/barcode, missing images, invalid image URLs, invalid prices, missing description/brand, missing attributes, inconsistent parent/variant data  
- Product Quality Score 0–100  
- Issue list with severity filters: Critical, Error, Warning, Information  
- Fix individually or bulk; ignore non-critical; re-run validation  

**Scoring (initial algorithm — provisional)**

```
score = 100
- Critical issue: -25 each (floor 0)
- Error: -10 each
- Warning: -3 each
- Information: -1 each
Clamp to [0, 100]
```

Hypothesis: weights will be tuned with pilot feedback (`MARKET_ASSUMPTIONS.md`).

### 7.5 Module 5 — Bulk Editor

**Must**

- Select products (filter + multi-select / select-all-matching with safety confirm)  
- Operations: replace/append/prepend text; update price (set / % / fixed delta); brand; category; attributes; normalize (trim, case, whitespace); status  
- Preview diff sample before apply  
- Background job for large sets  
- Change history + undo for last N bulk jobs where snapshots exist  

### 7.6 Module 6 — AI Content Studio (post-MVP)

**Must when built**

- Generate titles, descriptions, bullet points  
- Extract attributes from description (no invented specs)  
- Normalize attributes; suggest categories; translate  
- Bulk AI with review queue  
- Structured JSON + schema validation  
- Store generation history; track usage/cost; plan limits  
- Never auto-apply without user confirmation  

### 7.7 Module 7 — Marketplace Export Engine

**MVP recommendation — first two formats**

1. **Shopify product CSV** — largest overlapping ICP; well-documented template; high demand for multi-channel Shopify merchants.  
2. **Amazon flat-file style CSV (generic inventory/listing template subset)** — second-largest ICP among US sellers; even a constrained template delivers value vs. manual reformatting.

**Why not Walmart/eBay first:** smaller overlapping demand for early adopters; templates are more category-fragmented; defer to V1.1/V2.

Each adapter implements `MarketplaceAdapter` (mapping, required fields, transforms, validation, file generation, errors, versioned rules).  
**Important:** MVP delivers **file export templates only**, not official marketplace API integrations.

### 7.8 Module 8 — Image Manager

**MVP:** validate image URLs; detect missing; show preview from URL; associate URLs to SKU.  
**V1.1:** upload to R2; duplicate detection by hash; metadata.  
**Not MVP:** AI image generation/editing.

### 7.9 Module 9 — Automation (V2+)

Scheduled imports/validation/exports, Shopify sync, Google Sheets, notifications. Out of MVP unless a technical necessity appears (background job infrastructure *is* built for import/export).

### 7.10 Module 10 — Billing and Subscriptions

**Plans (pricing hypotheses — configurable via DB/config, not hardcoded business logic):**

| Plan | Price (hyp.) | Products | Import/export jobs / mo | Notes |
|------|--------------|----------|-------------------------|-------|
| Starter | $29/mo | 2,000 | 5 | Basic validation; 1 export template; bulk editor |
| Growth | $59/mo | 20,000 | 50 | Advanced validation; 3 templates; AI credits **when AI Studio ships (V1.1)** |
| Pro | $99/mo | 50,000 | Higher limits | Multi-user; priority support; AI credits **when AI Studio ships (V1.1)** |

**Billing/AI consistency:** MVP Stripe plans may reserve AI limit keys as `0` until Phase 9/V1.1 enables them—do not market live AI during MVP.

Annual pricing: ~2 months free equivalent *(hypothesis)*.

**Must:** Stripe Checkout, Customer Portal, webhooks, usage tracking, plan gates, trial, cancel, billing history.

---

## 8. Non-functional requirements

| Area | Target (engineering goals, not SLAs) |
|------|--------------------------------------|
| Availability | Best-effort early; aim 99.5% after launch hardening |
| Import throughput | 10k rows import job completes within 10 minutes under normal load |
| Catalog list | p95 < 500 ms for 20k products with indexed filters |
| Security | Org isolation enforced server-side; signed R2 URLs; Stripe webhook verify |
| Privacy | GDPR-aware retention & export/delete paths (see SECURITY.md) |
| Observability | Sentry + structured logs + PostHog product analytics |

---

## 9. Success metrics

| Metric | Definition | Target (hypothesis) |
|--------|------------|---------------------|
| Activation | Org completes first successful import + opens Products | ≥ 60% of signups in trial |
| Time-to-value | Minutes from signup to first export | < 45 min median |
| Retention | Month-2 paid retention | ≥ 70% of converting trials |
| Quality | Listing-related support tickets | Declining trend after V1 |
| NPS / interviews | Qualitative | Positive “spreadsheet replacement” language |

All numeric targets are **unverified hypotheses**.

---

## 10. Risks and open decisions

See [MARKET_ASSUMPTIONS.md](../research/MARKET_ASSUMPTIONS.md) and final summary in the planning response.

**Top product risks**

1. ICP may prefer free spreadsheet + ChatGPT over paid tool  
2. Marketplace template churn  
3. AI trust / hallucination concerns  
4. Solo-dev scope creep  

---

## 11. Document map

| Concern | Document |
|---------|----------|
| User stories | [USER_STORIES.md](./USER_STORIES.md) |
| MVP vs later | [MVP_SCOPE.md](./MVP_SCOPE.md) |
| Journeys / UX | [USER_JOURNEYS.md](./USER_JOURNEYS.md) |
| GTM | [GO_TO_MARKET.md](./GO_TO_MARKET.md) |
| Architecture | [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) |
| Schema | [../architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) |
| API | [../architecture/API_SPECIFICATION.md](../architecture/API_SPECIFICATION.md) |
| Import/Export | [../architecture/IMPORT_EXPORT_ENGINE.md](../architecture/IMPORT_EXPORT_ENGINE.md) |
| Adapters | [../architecture/MARKETPLACE_ADAPTERS.md](../architecture/MARKETPLACE_ADAPTERS.md) |
| Security | [../architecture/SECURITY.md](../architecture/SECURITY.md) |
| Roadmap | [../development/DEVELOPMENT_ROADMAP.md](../development/DEVELOPMENT_ROADMAP.md) |

---

## 12. Approval gate

**No application implementation until explicit approval** of this PRD set (or a signed delta). Planning phase ends with documentation + consistency review only.
