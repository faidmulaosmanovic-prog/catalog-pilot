# CatalogPilot — Market & Product Assumptions

**Version:** 1.0  

This document separates **verified facts**, **provisional decisions**, and **hypotheses requiring validation** before or during early implementation.

---

## 1. Verified / given (from planning brief)

| Item | Status |
|------|--------|
| Product name CatalogPilot | Given |
| Category: B2B product data ops | Given |
| Target market US | Given |
| Subscription business model | Given |
| Target customers list (Shopify, Amazon, Walmart, eBay sellers, agencies, wholesale, multi-channel) | Given |
| Catalog size band ~1k–50k | Given |
| Proposed stack (Next.js, Postgres, Drizzle, R2, Stripe, etc.) | Proposed in brief; adopted with documented hosting/auth choices |
| Initial price points $29 / $59 / $99 | Given as hypotheses in brief |

---

## 2. Provisional technical decisions (recommended; validate in spikes)

| Decision | Choice | Validate how |
|----------|--------|--------------|
| Auth provider | Better Auth | Phase 1–2 implementation friction |
| Hosting | OpenNext on Cloudflare Workers if spike passes; else Vercel | Phase 1 spike |
| Database host | Neon Postgres | Connection from Workers via Hyperdrive or Neon serverless driver |
| Queue | Cloudflare Queues | Spike reliability |
| MVP exports | Shopify CSV + Amazon constrained CSV | Customer interviews |
| Trial model | 14-day trial, no freemium | Conversion interviews |
| Pagination | Offset OK MVP; cursor if needed | Load testing |
| Import concurrency | One active import per org | Ops feedback |
| Quality score weights | −25/−10/−3/−1 | Pilot tuning |
| Rollback window | 24–72 hours | Support load |

---

## 3. Business hypotheses (unverified)

| ID | Hypothesis | How to validate |
|----|------------|-----------------|
| H1 | Spreadsheet pain is frequent and urgent enough to pay $29–99/mo | Interviews + paid pilots |
| H2 | Shopify + Amazon CSV cover most early demand | Ask channels used in interviews |
| H3 | Agencies will buy multi-seat Pro | Agency interviews |
| H4 | 14-day trial converts better than freemium for this category | A/B later; start trial-only |
| H5 | AI is not required for MVP WTP | Ask “must-have for trial success?” |
| H6 | Time-to-clean 5k SKUs can drop under 30 min user time | Timed pilots |
| H7 | Activation ≥60% trials complete first export | Measure post-launch |
| H8 | Month-2 retention ≥70% of paid | Measure |
| H9 | US English-only UI sufficient for MVP | ICP check |
| H10 | 25MB CSV cap sufficient for ICP | Ask file sizes |

---

## 4. Decisions requiring validation before coding (priority)

1. **Confirm Better Auth vs Clerk** after reading current CF Workers compatibility notes (spike).  
2. **Confirm hosting path** (Cloudflare OpenNext vs Vercel).  
3. **Confirm first export pair** with ≥5 ICP interviews (Shopify+Amazon vs Shopify-only).  
4. **Confirm trial length and whether email verification hard-gates imports**.  
5. **Confirm SKU uniqueness scope** (org-wide including variants) with merchants who reuse SKUs across channels.  
6. **Legal:** Terms/Privacy draft before public signup.  
7. **Stripe tax / US sales tax** approach (Stripe Tax on/off).  

Implementation of docs-only planning does **not** require these resolved; **implementation Phase 1** should resolve #1–#2.

---

## 5. Explicit non-assumptions

- We do **not** assume market size figures.  
- We do **not** assume competitor prices/features.  
- We do **not** assume OpenAI cost per description without measuring.  
- We do **not** assume Walmart/eBay templates are needed in MVP.  
- We do **not** assume API integrations exist when only CSV is built.

---

## 6. Change log

| Date | Change |
|------|--------|
| 2026-10-30 | Initial assumptions captured during planning phase |
