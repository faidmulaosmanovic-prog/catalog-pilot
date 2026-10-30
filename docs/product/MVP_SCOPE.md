# CatalogPilot — MVP Scope

**Version:** 1.0  
**Principle:** Ship a reliable import → catalog → validate → bulk edit → CSV export → billing loop for a solo developer before AI or marketplace APIs.

---

## 1. MVP definition (must ship)

| # | Capability | Notes |
|---|------------|-------|
| 1 | Authentication | Register, login, logout, verify email, password reset, profile |
| 2 | Organizations | Create org, members, roles (owner/admin/editor/viewer), active org switch, isolation |
| 3 | CSV import | Upload, detect, map, preview, validate, background process, history, soft rollback |
| 4 | Column mapping | Auto-suggest + manual override |
| 5 | Product catalog | CRUD-ish list/detail/edit, search/filter/sort/paginate, core fields, basic variants |
| 6 | Product editing | Single-product edit with validation |
| 7 | Data validation | Core rules, severities, quality score, issue list, fix/ignore/re-run |
| 8 | Bulk editing | Core ops + preview + history + undo when snapshotted |
| 9 | CSV export | Shopify CSV + Amazon template CSV via adapters |
| 10 | Import/export history | Status, counts, download error/export files |
| 11 | Basic Stripe billing | Trial, Checkout, Portal, webhooks, plan limits, usage display |

### MVP image scope (partial)

- Image URL fields on products  
- URL reachability/format validation (best-effort HEAD/GET with timeouts)  
- Missing image detection in Data Quality  

**Not in MVP:** image upload to R2 UI (storage infra may exist for import files), perceptual duplicate detection, AI imagery.

### MVP AI scope

**None.** AI Studio starts in V1.1 after catalog workflow reliability.

---

## 2. Explicitly out of MVP

| Item | Earliest |
|------|----------|
| XLSX import | V1.1 |
| Saved import mapping profiles | V1.1 |
| AI Content Studio | V1.1 |
| Image upload + R2 product media library | V1.1 |
| Walmart / eBay export templates | V1.1–V2 |
| Marketplace official API integrations | V2+ |
| Scheduled automation / Google Sheets | V2 |
| Shopify bidirectional sync | V2 |
| SSO / custom enterprise roles | Later |
| Mobile apps | Later |
| Complex analytics dashboards | Later |
| White-label agency portals | Later |

---

## 3. Version roadmap (product)

### MVP (v0.9 → v1.0)

Trustworthy CSV ops loop + multi-tenancy + Stripe.

**Success signal:** Paid pilot users complete import → fix → export without spreadsheet fallback for that job.

### Version 1.1

- XLSX import  
- Mapping profiles  
- AI Studio (review-before-apply) with usage meters  
- Image upload to R2  
- Third export template (Walmart **or** eBay — pick via pilot demand)  
- Stronger validation rule config  

### Version 2

- Automation module (schedules, notifications, job center)  
- At least one marketplace **API** integration (likely Shopify Admin API) — labeled distinctly from CSV  
- Advanced variant UX  
- Agency multi-client UX polish  
- Deeper PostHog funnels / quality trends  

### Long-term

- Additional APIs (Amazon SP-API, Walmart, eBay)  
- Supplier portal / collaboration  
- Attribute schema marketplace  
- Localization beyond EN  
- Enterprise SSO  

---

## 4. MVP cut recommendations (further shrink if needed)

If solo capacity slips, cut in this order **before** cutting core trust:

1. **Undo bulk edit** → keep history only (restore manually)  
2. **Amazon export** → Shopify-only first (still ship adapter interface)  
3. **Basic variants** → flat products only  
4. **Ignore issues** → fix-only  
5. **Annual plans** → monthly only  
6. **Email verification enforcement** → soft nag (not recommended unless blocked)  

**Do not cut:** org isolation, import preview, background import, export validation, Stripe webhook verification.

### Further shrink (solo schedule pressure)

Documented also in the planning summary: prefer Shopify-only export first (keep Amazon adapter interface stubbed), flat products without variants, and history-without-undo for bulk edits—before cutting tenancy or import safety.

---

## 5. MVP acceptance criteria (product-level)

1. New user can register, verify, create org, invite one member.  
2. User can import a 5,000-row UTF-8 CSV with quoted commas and BOM.  
3. Duplicate SKUs in file are reported before/at import.  
4. Products list supports search by SKU/title and filter by status.  
5. Validation produces scores and Critical/Error/Warning/Info issues.  
6. Bulk price % increase previews and applies to 500 products.  
7. Shopify CSV export downloads and opens in spreadsheet tools.  
8. Org A user cannot read Org B products via API.  
9. Trial org hitting product limit is blocked with upgrade CTA.  
10. Stripe test-mode Checkout + webhook updates subscription status.

---

## 6. Consistency with engineering phases

MVP maps to Development Roadmap **Phases 1–8 + 10–11** (AI = Phase 9 deferred to V1.1). Billing can parallelize late Phase 7–8 but must land before public launch (Phase 12).

See [DEVELOPMENT_ROADMAP.md](../development/DEVELOPMENT_ROADMAP.md).
