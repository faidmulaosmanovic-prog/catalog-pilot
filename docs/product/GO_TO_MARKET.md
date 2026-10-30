# CatalogPilot — Go-to-Market Plan

**Version:** 1.0  
**Market:** United States  
**Stage:** Pre-build / planning  

> Unverified claims are marked **[Hypothesis]** or listed in [MARKET_ASSUMPTIONS.md](../research/MARKET_ASSUMPTIONS.md).  
> Do not invent competitor prices, feature matrices, or market sizes as facts.

---

## 1. Ideal Customer Profile (ICP)

- US-based ecommerce businesses and agencies  
- ~1,000–50,000 products  
- Selling on 2+ channels **or** planning channel expansion  
- Currently using spreadsheets + marketplace UIs for catalog ops  
- Feels listing errors / reformatting pain monthly  

---

## 2. Buyer personas (GTM view)

| Persona | Trigger | Message |
|---------|---------|---------|
| Ops Manager | Amazon/Shopify listing errors | “Validate before you publish” |
| Founder | Hiring VA for spreadsheet cleanup | “Replace repetitive catalog labor” |
| Agency lead | New client onboarding | “Repeatable import mappings & org isolation” |

---

## 3. Pain points → value props

| Pain | Message |
|------|---------|
| Spreadsheet chaos | One catalog workspace |
| Channel template hell | Adapter-based exports |
| Silent CSV corruption | Preview + validation + reports |
| Fear of AI hallucinations | Review-before-apply enrichment (V1.1) |

---

## 4. Competitive positioning

**Positioning:** Product Data Operations for SMB multi-channel sellers — not enterprise PIM, not “AI description generator.”

**Adjacent categories to research (not claim feature parity):**

- Enterprise / mid-market PIM  
- Shopify apps for bulk edit / CSV  
- Amazon tools for listing optimization  
- Feed management / channel listing tools  
- Spreadsheet + ChatGPT workflows (de facto competitor)  

Detailed notes: [COMPETITOR_ANALYSIS.md](../research/COMPETITOR_ANALYSIS.md).

**Differentiation (claimed intent, validate in interviews):**

1. End-to-end CSV ops with auditability  
2. Quality score + issue workflow  
3. Marketplace adapters without fake API claims  
4. Honest AI later, not centerpiece  

---

## 5. Pricing strategy

Initial hypotheses (Starter $29 / Growth $59 / Pro $99 monthly) — **configurable**, not hard-coded.

**Recommendation: Free trial, not forever-free plan** for MVP launch.

| Option | Pros | Cons |
|--------|------|------|
| **14-day trial (recommended)** | Clear urgency; simpler billing; less freeload abuse | Higher activation pressure |
| Freemium | Top-of-funnel | Support cost; abuse; weak signal of WTP |
| Free forever limited | SEO content plays | Dilutes paid conversion |

**Annual:** offer ~2 months free equivalent **[Hypothesis]** after first paid customers confirm monthly WTP.

---

## 6. Landing page structure

1. **Hero** — Brand + one outcome headline + short subcopy + CTA (Start trial) + full-bleed product visual (catalog/quality UI)  
2. **Problem** — Spreadsheet / multi-channel pain (one section)  
3. **How it works** — Import → Validate → Fix → Export  
4. **Product tour** — 3–4 screenshots (not a feature laundry list dump)  
5. **Who it’s for** — ICP chips/list  
6. **Pricing** — 3 plans + trial CTA  
7. **FAQ** — CSV vs API, AI honesty, security/tenancy  
8. **Footer** — Docs later, contact, legal  

Follow brand-first, one-composition hero rules when designing the marketing site (implementation later).

---

## 7. First 10 customers acquisition

**Goal:** 10 design-partner / paid-pilot conversations → ≥3 paying pilots.

1. **Direct outreach** — 50 personalized emails/DMs per week to Shopify + Amazon sellers (public contact pages, LinkedIn).  
2. **Agency warm intros** — 10 ecommerce agencies; offer multi-client pilot pricing.  
3. **Community** — Answer catalog/CSV questions in seller communities (no spam).  
4. **Content** — 3 SEO pages: “Shopify CSV import errors”, “Amazon listing CSV checklist”, “product data quality score”.  
5. **Founder network** — personal asks for intros.  

**Offer:** 50% off first 3 months for structured feedback calls **[Hypothesis]**.

---

## 8. Product Hunt

- Launch **after** MVP is stable for 10+ external users (not day-0 of coding).  
- Assets: demo video of import→export, crisp tagline, maker comment honesty about CSV-first.  
- Prepare support capacity for spike.  
- Treat PH as awareness, not primary acquisition.

---

## 9. SEO strategy (early)

| Asset | Intent |
|-------|--------|
| Landing | Brand + trial |
| Guides | Problem/solution keywords |
| Comparison pages | Only after honest research |
| Changelog / docs | Trust |

Avoid fabricating “best of” claims.

---

## 10. Customer onboarding

1. Sample CSV + 5-minute checklist in-app  
2. Empty-state CTAs (see USER_JOURNEYS)  
3. Optional 20-min onboarding call for pilots  
4. Success email sequence: verify → import → quality → export → upgrade  

---

## 11. Validation plan

See [CUSTOMER_VALIDATION.md](../research/CUSTOMER_VALIDATION.md).

**Gate before heavy build beyond foundation:** ≥8 ICP interviews confirming spreadsheet pain and willingness to try paid tool.

**Gate before Scale spend:** ≥3 paid pilots using weekly.

---

## 12. Success metrics (GTM)

| Funnel | Metric |
|--------|--------|
| Awareness | Qualified conversations / week |
| Activation | % trials completing first export |
| Revenue | Paid conversions; MRR |
| Learning | Interview notes tagged by pain |

Numeric targets remain **[Hypothesis]** until baselines exist.
