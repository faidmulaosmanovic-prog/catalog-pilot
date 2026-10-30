# CatalogPilot — Definition of Done

**Version:** 1.0  

A feature is **Done** only when all applicable checks pass.

---

## 1. Universal DoD

1. **Requirements:** Implements acceptance criteria from the linked user story/issue.  
2. **Tenancy:** Org-scoped; cross-tenant test covered if data-access.  
3. **Authz:** Role checks on mutations.  
4. **Validation:** Zod (or equivalent) on inputs.  
5. **Errors:** Uses standard error envelope; no stack traces to client.  
6. **Tests:** Unit and/or integration as appropriate; E2E for user journeys.  
7. **Types:** `tsc` clean.  
8. **Lint:** CI lint clean.  
9. **Activity:** Significant mutations write `activity_logs` when applicable.  
10. **Docs:** Update architecture/API docs if contract changed.  
11. **No secrets** in git.  
12. **UI states:** loading, empty, error, success for user-facing surfaces.  
13. **Feature flags / plan gates** respected when touching limited resources.  

---

## 2. Import/Export DoD extras

- Streaming parse (no full-file memory load)  
- Job status visible in UI  
- Error report available on failure  
- Idempotent confirm where specified  
- Fixture tests for relevant edge cases  

---

## 3. Billing DoD extras

- Webhook signature verified  
- Idempotent event processing  
- Test-mode verified locally or in staging  
- Limits enforced server-side (UI alone insufficient)  

---

## 4. AI DoD extras (V1.1)

- Schema-validated output  
- Status `proposed` until approve  
- Usage incremented  
- Prompt/policy tests for no invented specs  

---

## 5. Phase DoD

A phase is Done when:

- All P0 issues in milestone closed or explicitly deferred with doc update  
- Milestone acceptance criteria in DEVELOPMENT_ROADMAP met  
- Demo path recordable (screenshot/notes)  
- No known Sev-1 security bugs open  

---

## 6. Release DoD (MVP launch)

- SECURITY.md checklist reviewed  
- Sample CSV onboarding works on clean org  
- Stripe live mode configured with monitoring  
- Backup restore drill noted  
- Privacy Policy & Terms published  
- Explicit approval to implement was granted earlier; launch approval separate  

---

## 7. Explicit non-DoD

- Perfect mobile polish  
- 100% marketplace category coverage  
- AI features for MVP  
- Zero warnings in all dependency audits (track high/critical)
