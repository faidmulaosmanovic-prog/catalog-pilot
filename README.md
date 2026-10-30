# CatalogPilot

**Product Data Operations Platform for multi-channel ecommerce.**

CatalogPilot helps ecommerce businesses clean, organize, validate, and prepare product catalogs for multiple sales channels — without spending hours managing spreadsheets.

> **Status:** Planning / documentation phase. Application implementation has **not** started. Await explicit approval before coding product features.

---

## Who it’s for

US-based small and mid-sized ecommerce teams managing roughly **1,000–50,000 products**, including:

- Shopify merchants  
- Amazon, Walmart, and eBay sellers  
- Ecommerce agencies  
- Wholesale distributors  
- Multi-channel businesses  

---

## Core features (planned)

| Module | MVP |
|--------|-----|
| Auth & multi-tenant organizations | Yes |
| Smart CSV import (map, preview, background jobs) | Yes |
| Product catalog (search, edit, variants basics) | Yes |
| Data quality engine + quality score | Yes |
| Bulk editor with preview/history | Yes |
| Marketplace CSV exports (Shopify + Amazon templates) | Yes |
| Stripe subscriptions & usage limits | Yes |
| AI Content Studio (review-before-apply) | V1.1 |
| Image upload library | V1.1 |
| Automation & marketplace APIs | V2+ |

MVP delivers **file export templates**, not official marketplace API sync.

---

## Proposed stack

| Area | Choice |
|------|--------|
| App | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| API | Next.js Route Handlers (modular monolith) |
| Auth | **Better Auth** (recommended over Clerk — see architecture docs) |
| DB | PostgreSQL + Drizzle ORM (Neon recommended) |
| Files | Cloudflare R2 |
| Jobs | Cloudflare Queues (+ Worker consumer) |
| Host | Cloudflare Workers via OpenNext **if** Phase 1 spike passes; else Vercel |
| AI | OpenAI API (post-MVP) |
| Payments | Stripe Billing |
| Tests | Vitest, Playwright |
| Observability | Sentry, PostHog |
| CI | GitHub Actions |

---

## Documentation

### Product

- [PRD](docs/product/PRD.md)  
- [User stories](docs/product/USER_STORIES.md)  
- [MVP scope](docs/product/MVP_SCOPE.md)  
- [User journeys & UI](docs/product/USER_JOURNEYS.md)  
- [Go-to-market](docs/product/GO_TO_MARKET.md)  

### Architecture

- [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)  
- [Database schema](docs/architecture/DATABASE_SCHEMA.md)  
- [API specification](docs/architecture/API_SPECIFICATION.md)  
- [Import/export engine](docs/architecture/IMPORT_EXPORT_ENGINE.md)  
- [Marketplace adapters](docs/architecture/MARKETPLACE_ADAPTERS.md)  
- [Security](docs/architecture/SECURITY.md)  

### Development

- [Development roadmap](docs/development/DEVELOPMENT_ROADMAP.md)  
- [Implementation checklist](docs/development/IMPLEMENTATION_CHECKLIST.md)  
- [Testing strategy](docs/development/TESTING_STRATEGY.md)  
- [GitHub issues breakdown](docs/development/GITHUB_ISSUES.md)  
- [Definition of Done](docs/development/DEFINITION_OF_DONE.md)  

### Research

- [Competitor analysis agenda](docs/research/COMPETITOR_ANALYSIS.md)  
- [Market assumptions](docs/research/MARKET_ASSUMPTIONS.md)  
- [Customer validation](docs/research/CUSTOMER_VALIDATION.md)  

---

## How to start development (when approved)

1. Read [MVP_SCOPE.md](docs/product/MVP_SCOPE.md) and [SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md).  
2. Complete **Phase 1** spike (hosting + DB + R2 + queue) per the roadmap.  
3. Follow [IMPLEMENTATION_CHECKLIST.md](docs/development/IMPLEMENTATION_CHECKLIST.md) in order.  
4. Create GitHub issues from [GITHUB_ISSUES.md](docs/development/GITHUB_ISSUES.md).  
5. Do **not** implement AI or marketplace APIs in MVP.

```bash
# After approval — illustrative only (not scaffolded yet)
# pnpm create next-app …
# pnpm dlx shadcn@latest init
# Configure Drizzle, Better Auth, R2, Queues per docs
```

Dependencies are **not** installed in this planning commit.

---

## Repository conventions

- Feature branches: `cursor/<descriptive-name>-7c25` or `feat/<slug>`  
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, …)  
- PRs must pass CI once application code exists  

---

## License

TBD.
