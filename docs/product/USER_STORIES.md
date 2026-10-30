# CatalogPilot — User Stories

**Version:** 1.0  
**Format:** As a… I want… so that…  
**Priority:** P0 = MVP, P1 = V1.1, P2 = V2+, P3 = later  

Acceptance criteria use Given/When/Then where critical.

---

## Epic A — Authentication & Organizations (P0)

### US-A01 — Register
**As a** new user, **I want** to register with email and password, **so that** I can create an account.  
**Priority:** P0  

**Acceptance**
- Given valid email + password (≥8 chars, complexity policy), When I submit, Then account is created as unverified and verification email is sent.
- Given existing email, When I register, Then I see a generic error that does not confirm enumeration beyond product policy (recommend: “If account exists, check email”).

### US-A02 — Verify email
**As a** registered user, **I want** to verify my email, **so that** I can access the app securely.  
**Priority:** P0  

### US-A03 — Login / logout
**As a** verified user, **I want** to log in and out, **so that** I can access my workspace.  
**Priority:** P0  

### US-A04 — Password reset
**As a** user who forgot my password, **I want** a reset link by email, **so that** I can regain access.  
**Priority:** P0  

### US-A05 — Create organization
**As a** logged-in user, **I want** to create an organization, **so that** my catalog data is isolated under a business account.  
**Priority:** P0  

### US-A06 — Invite members
**As an** owner/admin, **I want** to invite teammates with roles, **so that** we can collaborate safely.  
**Priority:** P0 (invite + accept); revoke P1  

### US-A07 — Role enforcement
**As an** organization, **I want** role-based permissions, **so that** viewers cannot mutate data.  
**Priority:** P0  

| Action | owner | admin | editor | viewer |
|--------|-------|-------|--------|--------|
| Manage billing | ✓ | | | |
| Manage members | ✓ | ✓ | | |
| Import/export/bulk/validate | ✓ | ✓ | ✓ | |
| Edit products | ✓ | ✓ | ✓ | |
| View products/issues | ✓ | ✓ | ✓ | ✓ |

### US-A08 — Switch organization
**As a** user in multiple orgs, **I want** to switch active org, **so that** I can work on the correct tenant.  
**Priority:** P0  

### US-A09 — Cross-tenant isolation
**As a** security stakeholder, **I want** all queries scoped by organization_id, **so that** org A cannot read org B.  
**Priority:** P0  

**Acceptance**
- Given user in Org A, When requesting Org B product by ID, Then 404 or 403 (consistent policy: prefer 404).

---

## Epic B — Smart Import (P0 CSV)

### US-B01 — Upload CSV
**As an** editor, **I want** to upload a CSV, **so that** I can start an import.  
**Priority:** P0  

### US-B02 — Auto-detect format
**As an** editor, **I want** delimiter/encoding/headers detected, **so that** mapping is faster.  
**Priority:** P0  

### US-B03 — Map columns
**As an** editor, **I want** to map file columns to CatalogPilot fields, **so that** data lands correctly.  
**Priority:** P0  

### US-B04 — Preview import
**As an** editor, **I want** a preview of mapped rows, **so that** I catch mistakes before commit.  
**Priority:** P0  

### US-B05 — Validate import
**As an** editor, **I want** pre-commit validation errors/warnings, **so that** I can fix the file or mapping.  
**Priority:** P0  

### US-B06 — Background import
**As an** editor, **I want** large imports processed in background batches, **so that** the UI stays responsive.  
**Priority:** P0  

### US-B07 — Import history & report
**As an** editor, **I want** history and an error report, **so that** I know what failed.  
**Priority:** P0  

### US-B08 — Import rollback
**As an** admin, **I want** to roll back a completed import when possible, **so that** I can undo a bad load.  
**Priority:** P0 (soft rollback via import batch tags)  

### US-B09 — XLSX import
**Priority:** P1  

### US-B10 — Saved mapping profiles
**Priority:** P1  

---

## Epic C — Product Catalog (P0)

### US-C01 — List products
**As a** user, **I want** paginated searchable filterable product list, **so that** I can navigate large catalogs.  
**Priority:** P0  

### US-C02 — View / edit product
**As an** editor, **I want** to view and edit product fields, **so that** I can fix individual records.  
**Priority:** P0  

### US-C03 — Manage SKU & barcodes
**As an** editor, **I want** SKU uniqueness per org and barcode validation, **so that** identifiers stay reliable.  
**Priority:** P0  

### US-C04 — Variants (basic)
**As an** editor, **I want** basic parent/variant structure, **so that** size/color SKUs are supported.  
**Priority:** P0 (simplified)  

### US-C05 — Product history
**As an** editor, **I want** to see recent changes on a product, **so that** I can audit edits.  
**Priority:** P0  

### US-C06 — Image URLs on product
**As an** editor, **I want** to attach image URLs, **so that** channel exports include media.  
**Priority:** P0  

---

## Epic D — Data Quality (P0)

### US-D01 — Run validation
**As an** editor, **I want** to run validation on the catalog (or selection), **so that** I see quality issues.  
**Priority:** P0  

### US-D02 — Quality score
**As a** user, **I want** a 0–100 quality score per product and org aggregate, **so that** I can prioritize work.  
**Priority:** P0  

### US-D03 — Filter issues
**As a** user, **I want** to filter by severity and rule, **so that** I focus on Critical/Error first.  
**Priority:** P0  

### US-D04 — Fix / ignore / re-run
**As an** editor, **I want** to fix issues, ignore warnings, and re-run, **so that** I control noise.  
**Priority:** P0  

### US-D05 — Configurable rules
**As an** admin, **I want** to enable/disable rules and adjust severity within bounds, **so that** validation matches our process.  
**Priority:** P0 (basic toggles); advanced custom rules P1  

---

## Epic E — Bulk Editor (P0)

### US-E01 — Bulk field update
**As an** editor, **I want** to update selected fields across many products with preview, **so that** I avoid one-by-one edits.  
**Priority:** P0  

### US-E02 — Text replace/append/prepend
**Priority:** P0  

### US-E03 — Price operations
**Priority:** P0  

### US-E04 — Normalize values
**Priority:** P0  

### US-E05 — Undo bulk job
**As an** admin, **I want** to undo a recent bulk job when snapshots exist, **so that** mistakes are recoverable.  
**Priority:** P0  

---

## Epic F — Exports (P0 templates)

### US-F01 — Export Shopify CSV
**As an** editor, **I want** to export selected/all products as Shopify CSV, **so that** I can upload to Shopify.  
**Priority:** P0  

### US-F02 — Export Amazon template CSV
**As an** editor, **I want** to export an Amazon-oriented CSV template subset, **so that** I can prepare Amazon listings offline.  
**Priority:** P0  

### US-F03 — Pre-export validation
**As an** editor, **I want** channel-required field validation before file generation, **so that** exports fail early with clear errors.  
**Priority:** P0  

### US-F04 — Export history & download
**Priority:** P0  

### US-F05 — Walmart / eBay templates
**Priority:** P1–P2  

### US-F06 — Marketplace API sync
**Priority:** P2+ (explicitly not file export)  

---

## Epic G — Billing (P0 basic)

### US-G01 — Start trial
**As a** new org, **I want** a time-limited trial, **so that** I can evaluate before paying.  
**Priority:** P0  

### US-G02 — Subscribe via Stripe Checkout
**Priority:** P0  

### US-G03 — Manage via Customer Portal
**Priority:** P0  

### US-G04 — Enforce plan limits
**As the** system, **I want** to block actions exceeding product/job limits, **so that** plans are meaningful.  
**Priority:** P0  

### US-G05 — Usage visibility
**As an** owner, **I want** to see usage vs limits, **so that** I know when to upgrade.  
**Priority:** P0  

---

## Epic H — AI Studio (P1)

### US-H01 — Generate description with review
**As an** editor, **I want** AI-generated copy stored as a proposal I must approve, **so that** I control published content.  
**Priority:** P1  

### US-H02 — No invented specs
**As a** merchant, **I want** AI to only use provided product facts, **so that** listings stay accurate.  
**Priority:** P1  

### US-H03 — Usage & cost tracking
**Priority:** P1  

---

## Epic I — Images advanced (P1)

### US-I01 — Upload images to R2  
### US-I02 — Duplicate image detection  

---

## Epic J — Automation (P2)

### US-J01 — Scheduled validation/export  
### US-J02 — Shopify API sync  
### US-J03 — Google Sheets integration  

---

## Story mapping notes for implementers

1. Build vertical slices: auth → org → import one CSV → list products → validate → bulk fix → export → billing gate.  
2. Every mutating story requires audit/activity log entry.  
3. Every tenant-owned story requires org membership check in API acceptance tests.
