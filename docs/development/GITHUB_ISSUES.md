# CatalogPilot — GitHub Issues Breakdown

**Version:** 1.1  
**How to use:** Create GitHub milestones per phase; labels below; issues from epics.  
**Order rule:** Open/close **`area:db`** issues before API/UI issues for the same domain. See [DATABASE_PHASES.md](./DATABASE_PHASES.md).

---

## 1. Labels

| Label | Meaning |
|-------|---------|
| `P0` | MVP blocker |
| `P1` | V1.1 |
| `P2` | V2+ |
| `epic` | Parent issue |
| `area:db` | Schema, migrations, seeds |
| `area:auth` | Auth/orgs |
| `area:import` | Import engine |
| `area:catalog` | Products UI/API |
| `area:quality` | Validation |
| `area:bulk` | Bulk editor |
| `area:export` | Exports/adapters |
| `area:billing` | Stripe |
| `area:ai` | AI Studio |
| `area:infra` | CI/hosting/queue |
| `area:security` | Security |
| `area:docs` | Documentation |
| `type:feat` | Feature |
| `type:bug` | Bug |
| `type:chore` | Chore |
| `type:test` | Tests |

---

## 2. Milestones

1. M0 Foundation + **DB-0**  
2. M1 **DB-1** Tenancy schema  
3. M2 Auth & Orgs (API/UI)  
4. M3 **DB-2/DB-3** + Catalog API/UI  
5. M4 **DB-4** + CSV Import  
6. M5 **DB-5** + Validation  
7. M6 **DB-6** + Bulk Editor  
8. M7 **DB-7** + Exports  
9. M8 **DB-8** + Billing  
10. M9 Production  
11. M10 AI Studio (**DB-9**, post-MVP)  

---

## 3. Epics and child tasks

### Epic E-DB — Database phases (`P0`, `area:db`)

Ship in order; each issue = migration + seeds + integration smoke.

- [ ] DB-0 Foundation (Drizzle, migrate CI)  
- [ ] DB-1 Identity & tenancy  
- [ ] DB-2 Audit & job_runs  
- [ ] DB-3 Catalog core  
- [ ] DB-4 Import engine  
- [ ] DB-5 Data quality (+ rule seeds)  
- [ ] DB-6 Bulk editor  
- [ ] DB-7 Channels & export (+ template seeds)  
- [ ] DB-8 Billing & usage (+ plan seeds)  
- [ ] DB-9 AI generations (`P1`)  

### Epic E1 — Foundation (`P0`, `area:infra`)

- [ ] E1.1 Scaffold Next.js + Tailwind + shadcn  
- [ ] E1.2 Depends on DB-0 migrations pipeline  
- [ ] E1.3 R2 helper  
- [ ] E1.4 Queue spike  
- [ ] E1.5 CI workflow  
- [ ] E1.6 Hosting ADR  

### Epic E2 — Auth & Organizations (`P0`, `area:auth`)

- [ ] E2.0 Depends on DB-1 merged  
- [ ] E2.1 Better Auth credentials + sessions  
- [ ] E2.2 Email verification  
- [ ] E2.3 Password reset  
- [ ] E2.4 Organizations CRUD  
- [ ] E2.5 Members & invites  
- [ ] E2.6 Role middleware  
- [ ] E2.7 Cross-tenant integration tests  

### Epic E3 — Product Domain (`P0`, `area:catalog`)

- [ ] E3.0 Depends on DB-3 merged  
- [ ] E3.1 ProductService + API  
- [ ] E3.2 Revisions writer (uses product_revisions)  
- [ ] E3.3 Catalog UI  
- [ ] E3.4 Seed/factories  

### Epic E4 — Smart Import (`P0`, `area:import`)

- [ ] E4.0 Depends on DB-4 merged  
- [ ] E4.1 Upload + R2 + hash  
- [ ] E4.2 Detection (BOM/encoding/delimiter)  
- [ ] E4.3 Mapping UI/API  
- [ ] E4.4 Preview + validation  
- [ ] E4.5 Worker batches + upsert  
- [ ] E4.6 Error report + history  
- [ ] E4.7 Rollback  
- [ ] E4.8 Import edge-case test pack  

### Epic E5 — Catalog UI (`P0`, `area:catalog`)

- [ ] E5.1 List page (after E3 API)  
- [ ] E5.2 Detail/edit  
- [ ] E5.3 Variants UI basic  
- [ ] E5.4 Empty/loading states  

### Epic E6 — Data Quality (`P0`, `area:quality`)

- [ ] E6.0 Depends on DB-5 merged  
- [ ] E6.1 Rule pack implementation  
- [ ] E6.2 Validation job  
- [ ] E6.3 Issues API/UI  
- [ ] E6.4 Quality score  
- [ ] E6.5 Ignore + re-run  

### Epic E7 — Bulk Editor (`P0`, `area:bulk`)

- [ ] E7.0 Depends on DB-6 merged  
- [ ] E7.1 Preview  
- [ ] E7.2 Apply worker  
- [ ] E7.3 Operations set  
- [ ] E7.4 Rollback  

### Epic E8 — Exports (`P0`, `area:export`)

- [ ] E8.0 Depends on DB-7 merged  
- [ ] E8.1 Adapter interface + registry  
- [ ] E8.2 Shopify CSV adapter  
- [ ] E8.3 Amazon CSV adapter  
- [ ] E8.4 Export jobs + UI  
- [ ] E8.5 Golden tests  

### Epic E9 — Billing (`P0`, `area:billing`)

- [ ] E9.0 Depends on DB-8 merged  
- [ ] E9.1 Checkout + portal  
- [ ] E9.2 Webhooks  
- [ ] E9.3 Usage + gates  
- [ ] E9.4 Billing settings UI  

### Epic E10 — Production (`P0`, `area:security`)

- [ ] E10.1 Rate limits  
- [ ] E10.2 Sentry alerts  
- [ ] E10.3 Backup restore drill  
- [ ] E10.4 Legal pages  
- [ ] E10.5 Onboarding sample CSV  

### Epic E11 — AI Studio (`P1`, `area:ai`)

- [ ] E11.0 Depends on DB-9 merged  
- [ ] E11.1 Generations pipeline  
- [ ] E11.2 Review UI  
- [ ] E11.3 Credits  
- [ ] E11.4 Eval fixtures no-invented-specs  

### Epic E12 — Automation (`P2`)

- [ ] E12.1 Job scheduler skeleton  
- [ ] E12.2 Notifications  
- [ ] E12.3 Shopify API adapter (separate epic when started)  

---

## 4. Priority order for issue creation

**Database first:** DB-0 → DB-1 → (E1 parallel) → DB-2 → DB-3 → E3/E5 → DB-4 → E4 → DB-5 → E6 → DB-6 → E7 → DB-7 → E8 → DB-8 → E9 → E10 → (DB-9 → E11 later).

---

## 5. Issue template (recommended)

```markdown
### Context
### Acceptance criteria
### Tests required
### Dependencies
### Out of scope
```
