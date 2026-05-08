# Authz / SpiceDB Posture Audit

Date: 2026-05-04

## Standards Baseline

- OWASP Authorization Cheat Sheet: authorize every request in the right location, deny by default, fail safely, log authorization decisions, and test authz logic.
- NIST RBAC: roles reduce enterprise administration cost, but role assignment must map to real job functions and separation-of-duty needs.
- NIST SP 800-162 ABAC: clinical restrictions also need subject, object, action, and environmental attributes, not only role names.
- Authzed SpiceDB: use consistency deliberately. Fully consistent checks are safe but slow; production read-after-write paths should store ZedTokens and use at-least-as-fresh where possible.
- Authzed caveats: conditional permissions must not be treated as unconditional access. If the app does not supply caveat context, it must deny or re-check with context.

Sources:
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- https://csrc.nist.gov/projects/role-based-access-control
- https://csrc.nist.gov/pubs/sp/800/162/upd2/final
- https://authzed.com/docs/spicedb/concepts/consistency
- https://authzed.com/docs/spicedb/concepts/caveats
- https://authzed.com/docs/best-practices

## Local Findings Closed This Pass

| Finding | Risk | Fix |
|---|---:|---|
| Non-bypass users with empty `department_ids` passed department checks. | High | `require_department_access` now requires an explicit matching department. |
| `scoped_department_ids` treated empty departments as unscoped. | High | Empty department list now returns an empty slice; only bypass roles are unscoped. |
| SpiceDB `ConditionalPermission` was accepted as allowed. | High | Check, BulkCheck, and LookupResources now require unconditional `HasPermission`. |
| Postgres authz fallback resolved caveated tuples without evaluating caveats. | High | Caveated tuples are denied by the fallback until evaluator wiring is implemented. |
| `/auth/login`, `/auth/refresh`, and `/auth/me` returned empty `field_access`. | Medium | Responses now resolve role field defaults plus user overrides. |
| Server write validation ignored configured field restrictions. | Medium | `field_access::resolve_restricted_fields` now reads role and user policy. |
| Legacy `perm_version=0` tokens and missing users were accepted. | High | Permission version verification now fails closed. |
| SpiceDB role-subject grants had no working `role#member` model. | Medium | Role-subject writes now fail loudly until role membership is modeled. |

## Remaining Enterprise Gaps

1. Add a first-class role-membership model for SpiceDB if role-subject sharing remains a product requirement. Current safe behavior is to reject those writes.
2. Store ZedTokens alongside protected resources or relationship writes, then use `at_least_as_fresh` for read-after-write paths instead of blanket `fully_consistent`.
3. Define break-glass as a separate audited temporary elevation path, not a normal bypass role.
4. Split `hospital_admin` away from global bypass for regulated actions such as NDPS, PCPNDT, mortality review, audit log export, and key/secrets operations.
5. Add policy tests for the high-risk personas: doctor, ward nurse, lab tech, pharmacist, billing clerk, TPA user, auditor, hospital admin, and break-glass reviewer.
6. Add a role matrix document that maps every sidebar screen, every API route, and every sensitive field to a role/permission/purpose.

## Guardrail

`make check-authz-posture` now scans the known fail-open patterns. It is wired into `make check-all` so these specific regressions are caught before merge.
