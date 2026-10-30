# CatalogPilot — Testing Strategy

**Version:** 1.0  
**Tools:** Vitest (unit/integration), Playwright (E2E), CI on GitHub Actions  

---

## 1. Test pyramid

| Layer | Scope | When |
|-------|-------|------|
| Unit | Parsers, mappers, validators, adapters, price ops, score calc | Every PR |
| Integration | DB + services with test Postgres; webhook handlers | Every PR |
| E2E | Critical user journeys in browser | Main/PR (smoke); nightly fuller |
| Manual | UX polish, exploratory import files from pilots | Per release |

---

## 2. Environments

- **Local:** Docker Postgres or Neon branch  
- **CI:** ephemeral Postgres service  
- **Stripe:** test mode + signed fixture payloads  
- **R2:** minio or mocked S3 API in unit; real R2 in staging  

---

## 3. Multi-tenant isolation (mandatory)

**Scenario T1 — Cross-org product access**  
Given User A in Org A and product P in Org B, When `GET /products/P` with Org A header, Then 404/403.

**Scenario T2 — Import ownership**  
Worker message with mismatched `organizationId` vs import row → job fails safe; no writes.

**Scenario T3 — Signed URL**  
User B cannot mint download for Org A export id.

Add similar cases for bulk jobs, validation issues, members list.

---

## 4. Import edge-case acceptance tests

| ID | Case | Expect |
|----|------|--------|
| I1 | UTF-8 BOM CSV | Headers mapped; no `ï»¿SKU` literal |
| I2 | Commas inside quotes | Columns align |
| I3 | Semicolon delimiter | Auto-detect or override works |
| I4 | Empty cells | Null/empty handling; required field errors |
| I5 | Duplicate SKUs in file | Blocking errors; no partial dup create |
| I6 | Invalid barcodes | Severity per rule |
| I7 | Missing headers | Fail early |
| I8 | Large CSV (~10k rows) | Completes under memory budget; status completed |
| I9 | Malformed row | Row error; others proceed |
| I10 | Re-import same hash | Warning; confirm allowed |
| I11 | Concurrent confirm | Second returns 409 or queues |
| I12 | Upsert preserves org scope | Updates only same-org SKU |

---

## 5. Export correctness

| ID | Case | Expect |
|----|------|--------|
| E1 | Shopify parent+2 variants | Correct multi-row CSV |
| E2 | Missing title | Error report; no successful file if policy strict |
| E3 | Amazon template subset | Headers match seeded template version |
| E4 | Empty selection | 400 validation |
| E5 | Special characters in description | Proper CSV quoting |

Golden files committed under `testdata/exports/`.

---

## 6. Authorization & roles

- Viewer cannot POST import/confirm/bulk/export  
- Editor can mutate catalog  
- Admin can invite  
- Owner-only billing checkout  

---

## 7. File upload security tests

- Reject `.exe` renamed  
- Reject oversize  
- Reject empty file  
- Ensure stored key is server-generated  

---

## 8. AI output validation (V1.1)

- Invalid JSON → failed generation  
- Extra invented attribute keys flagged or stripped per policy  
- Approve path writes product; reject does not  
- Credit decrement atomic  

---

## 9. Billing webhook reliability

- Invalid signature → 400  
- Replay same `event.id` → idempotent 200  
- `customer.subscription.updated` maps status correctly  
- Limit gate after cancel/past_due  

---

## 10. Performance goals (non-binding)

| Test | Goal |
|------|------|
| Product list 20k seed | p95 < 500ms API |
| Import 10k | < 10 min |
| Validation 10k | < 10 min |
| Bulk 1k | < 5 min |

Record measurements in CI artifacts occasionally; do not fail CI on flaky timing initially.

---

## 11. E2E critical paths (Playwright)

1. Register → verify (test hook) → create org → dashboard  
2. Import sample CSV → products visible  
3. Run validation → see issues  
4. Bulk update brand → verify  
5. Export Shopify → file downloaded  
6. Cross-org negative API test (request context)  

---

## 12. Definition of test done for a feature

- Happy path unit/integration  
- At least one failure path  
- Tenant isolation if data-touching  
- E2E if user-visible workflow  
- Fixtures documented  
