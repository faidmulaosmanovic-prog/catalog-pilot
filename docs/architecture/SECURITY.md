# CatalogPilot — Security & Production Readiness

**Version:** 1.0  

> Authentication ≠ multi-tenant security. Org isolation must be enforced on every data path.

---

## 1. Authentication security

| Control | Requirement |
|---------|-------------|
| Passwords | Hash with modern KDF (Better Auth defaults / Argon2 or bcrypt); never log passwords |
| Sessions | HTTP-only, Secure, SameSite=Lax/Strict cookies; rotation on login |
| Email verify | Required before destructive/high-volume ops (recommend before imports) |
| Password reset | Time-limited single-use tokens; hashed at rest |
| Brute force | Rate limit auth endpoints; lockout/backoff |
| CSRF | Framework protections for cookie session mutations |

---

## 2. Organization-level authorization

1. Resolve session → user  
2. Validate membership for `X-Organization-Id`  
3. Enforce role on mutation  
4. All queries include `organization_id = ctx.organizationId`  
5. Workers reload job by id **and** verify `organization_id` from DB, not only from queue payload  
6. Signed URLs include org-prefixed object keys; authorize before minting  

**Tests required:** Org A credentials + Org B IDs → 404/403 for products, imports, exports, images, billing portal for other customer.

---

## 3. Input validation

- Zod (or equivalent) schemas on every API body/query  
- UUID format checks  
- Strict enums for status/role/operation  
- Numeric bounds for prices/quantities  
- Reject unknown fields on sensitive endpoints (or strip explicitly)

---

## 4. File upload security

| Control | Detail |
|---------|--------|
| Extension allowlist | `.csv` MVP; `.xlsx` later |
| Size cap | Config (e.g., 25MB) |
| Content sniffing | Do not trust `Content-Type` alone |
| Filename | Sanitize; store own object key |
| Malware | R2 private; no server-side exec of files; optional ClamAV later **[Hypothesis need]** |
| Parse safety | Use well-maintained CSV parser; timeout; row count cap |
| XXE | N/A for CSV; careful with XLSX library settings in V1.1 |

---

## 5. Signed download URLs

- Short TTL (e.g., 5–15 minutes)  
- GET-only  
- No public bucket listing  
- Audit minting in activity log for exports  

---

## 6. Rate limiting & API security

- Per-IP and per-user limits (see API_SPECIFICATION)  
- Plan-based job caps  
- Standard security headers (CSP carefully for app, HSTS at edge)  
- No stack traces to clients in production  
- `requestId` on errors for support  

---

## 7. Secrets management

- Env vars / Workers secrets: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `R2_*`, `SENTRY_DSN`  
- Never commit secrets  
- Separate Stripe test/live  
- Rotate on leak  

---

## 8. Database backups & retention

- Neon (or host) automated backups enabled  
- Point-in-time recovery preferred  
- Soft-delete orgs/products before hard purge  
- Data retention policy document for customers (see GDPR)  

---

## 9. Logging, monitoring, error tracking

| Tool | Use |
|------|-----|
| Structured logs | requestId, orgId, userId (no PII dumps of catalog unless needed) |
| Sentry | Exceptions + performance samples |
| PostHog | Product analytics; respect consent where required |
| Alerts | Webhook failures, queue lag, error spike |

Do not log full CSV contents or Stripe card data (Stripe handles cards).

---

## 10. Stripe webhook verification

- Raw body signature verify with `STRIPE_WEBHOOK_SECRET`  
- Reject failed signatures (400)  
- Idempotent event handling (store `stripe_event_id` unique)  
- Only trust webhook (or Stripe API fetch) for subscription status — never client claims  

---

## 11. AI usage protection (V1.1)

- Server-side only API keys  
- Per-org credit ledger  
- Schema-validate outputs  
- Prompt rules: no invented specs; pass only known facts  
- Review-before-apply  
- Abuse rate limits  

---

## 12. GDPR / privacy considerations

**[Hypothesis]** Many customers are US-only initially; still design for GDPR readiness.

| Topic | Approach |
|-------|----------|
| Lawful basis | Contract / legitimate interest for SaaS logs — confirm with counsel |
| DPA | Offer standard DPA when selling to EU  
| Access/export | Org data export endpoint (V1.1+) |
| Delete | Org deletion soft → hard after grace; remove R2 prefixes |
| Subprocessors | List Stripe, Neon, Cloudflare, OpenAI, Sentry, PostHog |
| Cookies | Cookie notice if PostHog/marketing cookies on public site |

---

## 13. Production readiness checklist

Reviewed 31 October 2026. See [INCIDENT_RUNBOOK.md](../operations/INCIDENT_RUNBOOK.md).

- [x] Auth hardened + email verification  
- [x] Tenant isolation tests green  
- [x] Stripe webhooks verified + idempotent  
- [ ] R2 private + signed URLs (local object store and 15-minute export URLs are in place; hosted R2 is still open)  
- [x] Sentry capture when `SENTRY_DSN` is set; alert on error spikes in the Sentry project  
- [x] Backups: local restore drill in [BACKUP_RESTORE.md](../operations/BACKUP_RESTORE.md)  
- [x] Rate limits on (auth 10/min/IP, API 120/min/user, import upload 10/hour/org)  
- [x] Legal: Terms, Privacy Policy  
- [ ] Status page optional (not in this pilot)  
- [x] Incident runbook (short)  

---

## 14. Threat model (lightweight)

| Threat | Mitigation |
|--------|------------|
| Cross-tenant data read | Org scoping + tests |
| Uploaded malicious file | Private storage; no execute; size/type caps |
| Privilege escalation | Role checks; last-owner protection |
| Webhook spoofing | Signature verify |
| Dependency compromise | Lockfile; Dependabot; minimal deps |
| Prompt injection via product text (AI) | Treat product fields as untrusted; constrain tools/output schema |
