# CatalogPilot

**Product Data Operations Platform for multi-channel ecommerce.**

CatalogPilot helps ecommerce businesses clean, organize, validate, and prepare product catalogs for multiple sales channels — without spending hours managing spreadsheets.

> **Status:** Implementation started — **DB-6 bulk editor** is in place (preview, apply, undo). Next schema phase is DB-7 channels and export.

---

## Who it’s for

US-based small and mid-sized ecommerce teams managing roughly **1,000–50,000 products**, including Shopify merchants, Amazon/Walmart/eBay sellers, agencies, wholesale distributors, and multi-channel businesses.

---

## Current stack (in repo)

| Area | Choice |
|------|--------|
| App | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| DB | PostgreSQL 16 + Drizzle ORM + postgres.js |
| Package manager | pnpm |
| Tests | Vitest |
| CI | GitHub Actions (migrate + test against Postgres 16) |

Planned (not installed yet): Better Auth, shadcn/ui, R2, Queues, Stripe, Sentry, PostHog.

---

## Quick start (DB-0)

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 15+ (local or Neon)

### Setup

```bash
pnpm install
cp .env.example .env.local
# Edit DATABASE_URL if needed

pnpm db:migrate   # apply migrations (includes DB-0 pgcrypto)
pnpm db:check     # SELECT 1 smoke
pnpm test         # includes DB-0 integration tests (needs DATABASE_URL)
pnpm dev          # http://localhost:3000
```

### Useful scripts

| Script | Purpose |
|--------|---------|
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:generate` | Generate migrations from schema |
| `pnpm db:check` | DB connectivity smoke |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm lint` | ESLint |

---

## Database phases

Delivery order is **schema → API → UI**. See:

- [DATABASE_PHASES.md](docs/development/DATABASE_PHASES.md) — **DB-6 bulk editor is in place; next schema phase is DB-7 channels and export**
- [DEVELOPMENT_ROADMAP.md](docs/development/DEVELOPMENT_ROADMAP.md)

| Phase | Status |
|-------|--------|
| DB-0 Foundation | Done |
| DB-1 Identity & tenancy | Done |
| Phase 2 Auth & organizations | Done |
| DB-2 Audit & jobs | Done |
| DB-3 Catalog core | Done |
| DB-4 Import engine | Done |
| DB-5 Data quality | Done |
| DB-6 Bulk editor | Done |
| DB-7 … DB-8 | Planned |
| DB-9 AI | V1.1 |

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
- [ADR 0001 Hosting](docs/architecture/adr/0001-hosting.md)

### Development

- [Development roadmap](docs/development/DEVELOPMENT_ROADMAP.md)
- [Database phases](docs/development/DATABASE_PHASES.md)
- [Implementation checklist](docs/development/IMPLEMENTATION_CHECKLIST.md)
- [Testing strategy](docs/development/TESTING_STRATEGY.md)
- [GitHub issues](docs/development/GITHUB_ISSUES.md)
- [Definition of Done](docs/development/DEFINITION_OF_DONE.md)

### Research

- [Competitor analysis](docs/research/COMPETITOR_ANALYSIS.md)
- [Market assumptions](docs/research/MARKET_ASSUMPTIONS.md)
- [Customer validation](docs/research/CUSTOMER_VALIDATION.md)

---

## License

TBD.
