# User Master Plan Coverage Map

Date: 2026-05-03

Purpose: map every major section from the user's pasted master plan into the docs now created in `docs/research/`.

This file answers: "Are the remaining things from my earlier text included?"

## Coverage Summary

| User master-plan section | Coverage status | Primary doc |
|---|---|---|
| Session log, shipped items, pending queue | Preserved as context | `remaining-master-plan-items-2026-05-03.md` |
| Track 0.alpha screen-by-screen sweep | Partly expanded, needs dedicated execution doc | `remaining-master-plan-items-2026-05-03.md` |
| Track 0.bis IPD admission-detail drawer overhaul | Preserved as remaining plan item | `remaining-master-plan-items-2026-05-03.md` |
| Track 0.ter pharmacy follow-ups | Preserved as remaining plan item | `remaining-master-plan-items-2026-05-03.md` |
| Track 0.gamma infra / DB / linkage hygiene | Covered at P0 level, needs implementation detail | `p0-p1-execution-backlog-2026-05-03.md` |
| Track 0.delta compile-time SQL | Covered at P0 level, needs implementation detail | `p0-p1-execution-backlog-2026-05-03.md` |
| Track 0.epsilon ship pipeline | Covered at P0 level, needs implementation detail | `sprint-plan-p0-2026-05-03.md` |
| Track 0.eta business logic UX/data linkage | Partly expanded through P0 patient context/search; full A-M still pending | `remaining-master-plan-items-2026-05-03.md` |
| Track 1 backend/module completion | Covered at enterprise level | `enterprise-completion-plan-2026-05-03.md` |
| Track 1A.bis.4 IPD post-discharge workflow | Covered in P0/P1 backlog and remaining list | `p0-p1-execution-backlog-2026-05-03.md` |
| Track 1A.bis.5 patient journey wiring | Covered in enterprise plan and P0 sprint | `enterprise-completion-plan-2026-05-03.md` |
| Track 2 clients: web/desktop/mobile/TV/PWA | Covered at enterprise level, needs dedicated plan | `enterprise-completion-plan-2026-05-03.md` |
| Track 3 offline/sync/CRDT/authz | Covered at enterprise level, needs dedicated plan | `enterprise-completion-plan-2026-05-03.md` |
| Track 4 security | Covered in regulatory/evidence and enterprise plan, needs threat model | `regulatory-evidence-map-2026-05-03.md` |
| Track 5 authorization | Covered at enterprise level, needs SpiceDB plan | `enterprise-completion-plan-2026-05-03.md` |
| Track 6 open formats | Covered at enterprise level | `enterprise-completion-plan-2026-05-03.md` |
| Track 7 compliance | Covered in regulatory map, P0/P1 backlog | `regulatory-evidence-map-2026-05-03.md` |
| Track 8 infrastructure | Covered at enterprise level, needs tier plan | `enterprise-completion-plan-2026-05-03.md` |
| Track 9 hardware integration | Preserved as remaining plan item | `remaining-master-plan-items-2026-05-03.md` |
| Track 10 tests | Covered in module DoD, needs dedicated strategy | `module-definition-of-done-2026-05-03.md` |
| Track 11 documentation | Preserved as remaining plan item | `remaining-master-plan-items-2026-05-03.md` |
| Phased delivery tables | Consolidated into P0 sprint and enterprise critical path | `sprint-plan-p0-2026-05-03.md` |
| All-module inventory / do not skip anything | Fully generated from Excel | `module-inventory-2026-05-03.md` |

## What Is Fully Created

These docs are already concrete and usable:

- `enterprise-completion-plan-2026-05-03.md`
- `module-inventory-2026-05-03.md`
- `p0-p1-execution-backlog-2026-05-03.md`
- `sprint-plan-p0-2026-05-03.md`
- `module-definition-of-done-2026-05-03.md`
- `regulatory-evidence-map-2026-05-03.md`
- `implementation-ticket-seeds-2026-05-03.md`
- `parallel-execution-plan-2026-05-03.md`
- `remaining-master-plan-items-2026-05-03.md`

## What Still Needs Dedicated Detail Docs

The following are intentionally not coded yet because Claude Code is active. They should be expanded as docs first:

1. `screen-sweep-execution-plan-2026-05-03.md`
2. `business-logic-data-linkage-plan-2026-05-03.md`
3. `ipd-drawer-overhaul-plan-2026-05-03.md`
4. `pharmacy-followups-plan-2026-05-03.md`
5. `db-infra-linkage-doctor-plan-2026-05-03.md`
6. `compile-time-sql-migration-plan-2026-05-03.md`
7. `ship-pipeline-plan-2026-05-03.md`
8. `client-platforms-plan-2026-05-03.md`
9. `offline-sync-crdt-plan-2026-05-03.md`
10. `security-threat-model-plan-2026-05-03.md`
11. `authz-spicedb-plan-2026-05-03.md`
12. `open-formats-plan-2026-05-03.md`
13. `compliance-evidence-plan-2026-05-03.md`
14. `infrastructure-tier-plan-2026-05-03.md`
15. `hardware-integration-plan-2026-05-03.md`
16. `test-strategy-plan-2026-05-03.md`
17. `documentation-plan-2026-05-03.md`

## Principal-Engineer Ordering

The earlier text contains many valid tracks, but the execution order matters:

1. Protect the release path: ship pipeline, migration checks, SQL ratchet.
2. Protect patient safety: patient context, search-create, CPOE/CDS, medication safety.
3. Protect audit readiness: DPDP, NABH Phase 2 captures, MTP, PCPNDT, AERB, ABDM.
4. Protect operational closure: IPD drawer, discharge cascade, pharmacy-to-billing, supplier ledger.
5. Sweep all screens after the core workflows are stable.
6. Expand client platforms, offline, hardware, infrastructure tiers.

## Code Rule

Do not start implementation from these docs while Claude Code is editing overlapping files. Use the docs to split ownership first.

