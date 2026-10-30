# CatalogPilot — API Specification

**Version:** 1.0  
**Style:** REST JSON over HTTPS  
**Base path:** `/api/v1`  
**Auth:** Session cookie (Better Auth) or Bearer session token  

---

## 1. Conventions

### 1.1 Headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Cookie` / `Authorization` | Yes (except public auth) | Authenticate user |
| `X-Organization-Id` | Yes for tenant routes | Active organization |
| `Idempotency-Key` | Recommended for creates/jobs | Prevent duplicate jobs |

### 1.2 Pagination

```json
{
  "data": [],
  "pagination": {
    "limit": 50,
    "nextCursor": "eyJ1IjoiLi4uIn0",
    "prevCursor": null
  }
}
```

Query: `limit` (1–100, default 50), `cursor`, optional `sort`, `order=asc|desc`.

MVP may use `page` + `pageSize` if faster to ship; migrate to cursor before 50k-scale pain.

### 1.3 Filtering & sorting

- Filter query params per resource (e.g. `status=active`, `q=shirt`)  
- `sort=updated_at` & `order=desc`  
- Unknown sort fields → `400`

### 1.4 Error envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human readable summary",
    "details": [
      { "field": "sku", "message": "SKU is required", "code": "required" }
    ],
    "requestId": "req_abc123"
  }
}
```

| HTTP | code examples |
|------|----------------|
| 400 | VALIDATION_FAILED, BAD_REQUEST |
| 401 | UNAUTHENTICATED |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND |
| 409 | CONFLICT, DUPLICATE_SKU |
| 413 | PAYLOAD_TOO_LARGE |
| 429 | RATE_LIMITED |
| 500 | INTERNAL |

### 1.5 Rate limiting (initial goals)

| Scope | Limit |
|-------|-------|
| Auth endpoints | 10/min/IP |
| General API | 120/min/user |
| Import upload | 10/hour/org (separate from plan job caps) |
| AI (V1.1) | plan credits + 20/min/org |

Return `Retry-After` on 429.

### 1.6 Authorization

Every tenant handler:

1. Require session  
2. Require membership for `X-Organization-Id`  
3. Require role ≥ needed  
4. Scope DB by `organization_id`

---

## 2. Authentication

### POST `/api/v1/auth/register`

**Auth:** Public  
**Body:** `{ "email": "a@b.com", "password": "...", "name": "Ada" }`  
**Response 201:** `{ "user": { "id", "email", "name", "emailVerified": false } }`  
**Errors:** 400 validation  

### POST `/api/v1/auth/login`

**Body:** `{ "email", "password" }`  
**Response 200:** `{ "user": {...} }` + Set-Cookie  

### POST `/api/v1/auth/logout`

**Auth:** Required → 204  

### POST `/api/v1/auth/password-reset/request`

**Body:** `{ "email" }` → 202 always (anti-enumeration)

### POST `/api/v1/auth/password-reset/confirm`

**Body:** `{ "token", "password" }` → 204  

### POST `/api/v1/auth/verify-email`

**Body:** `{ "token" }` → 204  

### GET `/api/v1/auth/me`

**Response:** `{ "user": {...}, "organizations": [{ "id", "name", "role" }] }`

> Exact paths may mirror Better Auth mounted routes; keep equivalent contracts.

---

## 3. Organizations

### POST `/api/v1/organizations`

**Role:** authenticated user  
**Body:** `{ "name": "Acme Commerce", "defaultCurrency": "USD" }`  
**Response 201:** organization + membership owner  

### GET `/api/v1/organizations`

List memberships for current user.

### GET `/api/v1/organizations/:orgId`

**Authz:** member  

### PATCH `/api/v1/organizations/:orgId`

**Authz:** owner/admin  
**Body:** `{ "name?", "defaultCurrency?" }`

### GET `/api/v1/organizations/:orgId/members`

**Authz:** member  

### POST `/api/v1/organizations/:orgId/invites`

**Authz:** owner/admin  
**Body:** `{ "email", "role": "editor" }`  

### POST `/api/v1/invites/:token/accept`

**Auth:** authenticated matching email  

### PATCH `/api/v1/organizations/:orgId/members/:memberId`

**Authz:** owner/admin  
**Body:** `{ "role" }` — cannot demote last owner  

### DELETE `/api/v1/organizations/:orgId/members/:memberId`

**Authz:** owner/admin  

---

## 4. Products

### GET `/api/v1/products`

**Authz:** viewer+  
**Query:** `q`, `status`, `brand`, `categoryId`, `minScore`, `maxScore`, `hasIssues`, pagination, sort  

**Response item:**
```json
{
  "id": "…",
  "sku": "TEE-001",
  "title": "Cotton Tee",
  "brand": "Acme",
  "price": "19.99",
  "currency": "USD",
  "status": "active",
  "qualityScore": 82,
  "imageCount": 2,
  "updatedAt": "2026-10-30T12:00:00Z"
}
```

### POST `/api/v1/products`

**Authz:** editor+  
**Body:**
```json
{
  "sku": "TEE-001",
  "title": "Cotton Tee",
  "description": "…",
  "brand": "Acme",
  "categoryId": null,
  "price": "19.99",
  "currency": "USD",
  "quantity": 10,
  "status": "draft",
  "barcode": "012345678905",
  "attributes": { "color": "blue", "material": "cotton" },
  "images": [{ "url": "https://…", "position": 0 }]
}
```
**Errors:** 409 DUPLICATE_SKU  

### GET `/api/v1/products/:id`

Full product + variants + images + recent issues  

### PATCH `/api/v1/products/:id`

**Authz:** editor+  
Partial update; writes revision + activity log  

### DELETE `/api/v1/products/:id`

Soft delete; **Authz:** editor+  

### GET `/api/v1/products/:id/history`

Revisions + activity  

### PUT `/api/v1/products/:id/variants`

Replace/update variant set (MVP)  

---

## 5. Imports

### POST `/api/v1/imports/upload`

**Authz:** editor+  
**Content-Type:** multipart  
**Fields:** `file`  
**Validations:** extension `.csv` (MVP), max size, MIME sniff  
**Response 201:**
```json
{
  "import": {
    "id": "…",
    "status": "uploaded",
    "detection": { "encoding": "utf-8-sig", "delimiter": ",", "headers": ["SKU","Title"] },
    "suggestedMappings": [{ "sourceColumn": "SKU", "targetField": "sku", "confidence": 0.99 }]
  }
}
```

### PUT `/api/v1/imports/:id/mapping`

**Body:** `{ "mappings": [{ "sourceColumn", "targetField", "transform?" }], "mode": "upsert" }`  

### POST `/api/v1/imports/:id/preview`

**Body:** `{ "limit": 50 }`  
**Response:** rows + validation summary for preview set  

### POST `/api/v1/imports/:id/confirm`

**Authz:** editor+  
**Idempotency-Key** required recommended  
**Response 202:** `{ "import": { "id", "status": "queued" } }`  
Enqueues `import.process`  

### GET `/api/v1/imports`

List history  

### GET `/api/v1/imports/:id`

Detail + counts  

### GET `/api/v1/imports/:id/errors`

Signed URL or streamed CSV  

### POST `/api/v1/imports/:id/rollback`

**Authz:** admin+  
**Errors:** 409 if not rollback-eligible  

---

## 6. Validation

### GET `/api/v1/validation/rules`

Org effective rules  

### PATCH `/api/v1/validation/rules/:code`

**Authz:** admin+  
**Body:** `{ "isEnabled?", "severity?" }` — severity bounds enforced  

### POST `/api/v1/validation/runs`

**Authz:** editor+  
**Body:** `{ "scope": "all" | "selection", "productIds?": [] }` → 202  

### GET `/api/v1/validation/runs/:id`

### GET `/api/v1/validation/issues`

**Query:** `severity`, `status`, `ruleCode`, `productId`, pagination  

### POST `/api/v1/validation/issues/:id/ignore`

**Authz:** editor+ — only warning/info unless admin  

### POST `/api/v1/validation/issues/bulk-resolve`

Mark resolved after fixes or apply simple fixes  

### GET `/api/v1/validation/summary`

Org score distribution  

---

## 7. Bulk editing

### POST `/api/v1/bulk-edits/preview`

**Authz:** editor+  
**Body:**
```json
{
  "productIds": ["…"],
  "selectAllMatching": false,
  "filter": null,
  "operation": "replace_text",
  "config": { "field": "title", "find": "Tee", "replace": "T-Shirt" }
}
```
**Response:** sample diffs + affected count estimate  

### POST `/api/v1/bulk-edits`

Confirm apply → 202 job  

**Operations enum:** `replace_text`, `append_text`, `prepend_text`, `update_price`, `update_brand`, `update_category`, `update_attributes`, `normalize`, `update_status`

### GET `/api/v1/bulk-edits`

### GET `/api/v1/bulk-edits/:id`

### POST `/api/v1/bulk-edits/:id/rollback`

If `canRollback`  

---

## 8. AI generation (V1.1)

### POST `/api/v1/ai/generations`

**Body:** `{ "productIds": [], "type": "description", "options": { "tone": "neutral", "language": "en" } }` → 202  

### GET `/api/v1/ai/generations/:id`

### POST `/api/v1/ai/generations/:id/approve`

Applies to product  

### POST `/api/v1/ai/generations/:id/reject`

---

## 9. Marketplace exports

### GET `/api/v1/channels`

List channels + templates  

### POST `/api/v1/exports`

**Authz:** editor+  
**Body:**
```json
{
  "channelCode": "shopify",
  "templateVersion": "2026.1",
  "productIds": [],
  "selectAllMatching": false,
  "filter": { "status": "active" }
}
```
**Response 202:** export job; runs validation first  

### GET `/api/v1/exports`

### GET `/api/v1/exports/:id`

Includes `downloadUrl` (signed, short-lived) when completed  

---

## 10. Images

### POST `/api/v1/products/:id/images` (MVP URL attach)

**Body:** `{ "url": "https://…", "position": 0 }`  

### DELETE `/api/v1/products/:id/images/:imageId`

### POST `/api/v1/images/upload` (V1.1)

Multipart → R2  

### POST `/api/v1/images/validate`

Batch URL validation job  

---

## 11. Billing & usage

### GET `/api/v1/billing/plans`

Public or auth  

### GET `/api/v1/billing/subscription`

**Authz:** member (owners see portal CTA)  

### POST `/api/v1/billing/checkout-session`

**Authz:** owner  
**Body:** `{ "planCode": "growth", "interval": "month" }`  
**Response:** `{ "url": "https://checkout.stripe.com/…" }`  

### POST `/api/v1/billing/portal-session`

**Authz:** owner → `{ "url" }`  

### POST `/api/v1/billing/webhooks/stripe`

**Auth:** Stripe signature  
Raw body verification; no org header  

### GET `/api/v1/usage`

**Response:**
```json
{
  "period": { "start": "2026-10-01", "end": "2026-10-31" },
  "metrics": [
    { "metric": "products", "quantity": 1200, "limit": 2000 },
    { "metric": "import_export_jobs", "quantity": 2, "limit": 5 }
  ]
}
```

---

## 12. Dashboard

### GET `/api/v1/dashboard`

Aggregate: product count, quality summary, recent imports/exports, open critical issues, trial info  

---

## 13. MVP endpoint coverage matrix

| Workflow | Endpoints |
|----------|-----------|
| Auth | register/login/logout/reset/verify/me |
| Orgs | CRUD-ish + invites + members |
| Import | upload → mapping → preview → confirm → get/errors/rollback |
| Catalog | products CRUD + variants + history |
| Validate | runs + issues + rules + summary |
| Bulk | preview + create + rollback |
| Export | channels + exports |
| Billing | plans + checkout + portal + webhook + usage |

AI endpoints are **out of MVP** but specified for V1.1 consistency.
