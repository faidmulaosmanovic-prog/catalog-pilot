# ADR 0001 — Hosting & database connectivity

**Status:** Proposed (Phase 0 spike in progress)  
**Date:** 2026-10-30  

## Context

CatalogPilot targets Next.js with Postgres (Neon recommended), R2, and background queues. Hosting must support Node-style DB drivers or a Workers-compatible alternative.

## Decision (interim for DB-0)

- Use **postgres.js** + Drizzle in the Node/Next.js server runtime for local and CI.
- Keep `DATABASE_URL` as the single connection config.
- Defer final choice between **Cloudflare Workers (OpenNext) + Hyperdrive/Neon serverless** vs **Vercel + Neon** until the Phase 0 hosting spike completes.

## Consequences

- DB-0–DB-8 migrations are runtime-agnostic SQL.
- If Workers is chosen, swap the DB client module without changing schema.
