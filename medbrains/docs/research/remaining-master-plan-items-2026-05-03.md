# Remaining Master Plan Items From Earlier Text

Date: 2026-05-03

Purpose: preserve the parts of the user's earlier master-plan text that are not fully expanded in the current P0/P1 execution docs.

Current detailed docs already cover:

- enterprise completion plan
- all-module inventory
- P0/P1 backlog
- 8-week P0 sprint
- module definition of done
- regulatory evidence map
- implementation ticket seeds
- parallel execution rule while Claude Code is active

This file captures the remaining tracks that still need their own detailed plans or tickets.

## Track 0.alpha: Screen-By-Screen Field Walkthrough

Already partly captured in:

- `docs/research/enterprise-completion-plan-2026-05-03.md`
- `docs/research/p0-p1-execution-backlog-2026-05-03.md`

Still needs detailed execution:

- page-by-page sweep ordering for all 137 pages.
- generated checklist review plan.
- owner/date/status per page.
- rules for checking each input, button, filter, table, modal, drawer.
- P2 polish batching plan.
- page-load smoke generation plan.
- form round-trip smoke generation plan.
- `make sweep-page PAGE=<page>` target design.

Required artifact:

- `docs/research/screen-sweep-execution-plan-2026-05-03.md`

## Track 0.bis: IPD Admission Detail Drawer Overhaul

Still needs detailed execution:

- admission header redesign.
- patient context integration.
- status-sensitive action menu.
- Discharge, Orders, Documents groups.
- DAMA action.
- death marking action.
- transfer/bed/housekeeping linkage.
- pending lab/Rx/bill/consent badges.
- role-based action visibility.
- mobile/tablet behavior.

Required artifact:

- `docs/research/ipd-drawer-overhaul-plan-2026-05-03.md`

## Track 0.gamma: Infra, DB, Linkage Hygiene

Partly captured in P0.1-P0.3.

Still needs detailed execution:

- orphan table checker design.
- orphan column checker design.
- duplicate-purpose table checker design.
- dead backend route checker.
- module linkage Mermaid graph.
- fresh DB idempotency drill.
- upgrade drill.
- rollback drill.
- DR restore drill.
- offline mode verification.
- dependency and dead-code deletion policy.

Required artifact:

- `docs/research/db-infra-linkage-doctor-plan-2026-05-03.md`

## Track 0.delta: Compile-Time SQL Migration

Partly captured in P0.3.

Still needs detailed execution:

- exact SQLx CLI install path.
- `.sqlx/` offline cache workflow.
- module-by-module route conversion order.
- strict no-runtime-SQL policy.
- dynamic query refactor policy.
- CI check order.
- contributor workflow update.

Required artifact:

- `docs/research/compile-time-sql-migration-plan-2026-05-03.md`

## Track 0.epsilon: Unified Build-Test-Deploy Pipeline

Partly captured in P0.1.

Still needs detailed execution:

- `Makefile.ship` structure.
- GH Actions workflow design.
- smoke docker compose.
- smoke fixture seeding.
- post-deploy health/login/CRUD script.
- rollback procedure.
- release tagging.
- artifact logging.
- cold/hot/local path timing.

Required artifact:

- `docs/research/ship-pipeline-plan-2026-05-03.md`

## Track 0.eta: Business Logic UX And Data Linkage

Partly captured in patient context and search-or-create P0 items.

Still needs full A-M decomposition:

- universal SearchOrCreate component.
- cross-module field auto-population.
- reversible workflows and undo paths.
- order cancel cascades.
- discharge cascade.
- department/role scoping.
- bulk actions.
- SmartPhrases.
- emergency unknown patient flow.
- Print Center.
- realtime event refresh.
- timezone and locale policy.
- patient journey handoff matrix.
- form field matrix.

Required artifact:

- `docs/research/business-logic-data-linkage-plan-2026-05-03.md`

## Track 1: Module Completion From Excel

Partly captured by all-module inventory.

Still needs detailed execution:

- row-level backlog by sheet.
- module priority sort.
- P0/P1/P2/P3 scheduling.
- Excel status update process.
- feature-to-route/page/test mapping.
- per-module RFC gaps.

Required artifact:

- `docs/research/excel-module-completion-plan-2026-05-03.md`

## Track 2: Client Platforms

Still needs detailed execution:

- Tauri desktop shell.
- desktop hardware bridge.
- mobile staff app.
- mobile patient app.
- mobile vendor app.
- RN Android TV displays.
- PWA fallback.
- shared mobile UI packages.
- signing/release pipelines.

Required artifact:

- `docs/research/client-platforms-plan-2026-05-03.md`

## Track 3: Offline, Sync, CRDT, Authz

Partly captured in enterprise plan.

Still needs detailed execution:

- pack export endpoint.
- pack pull endpoint.
- pack push endpoint.
- signed authz manifest schema.
- device binding.
- encryption at rest.
- conflict resolution rules.
- offline permission model.
- offline regulatory restrictions.
- pack manager UI.

Required artifact:

- `docs/research/offline-sync-crdt-plan-2026-05-03.md`

## Track 4: Security

Partly captured in regulatory and enterprise plan.

Still needs detailed execution:

- STRIDE threat model.
- crypto stack policy.
- MFA/TOTP/WebAuthn.
- mobile biometric policy.
- audit/forensics.
- secrets management.
- key rotation.
- SIEM/log forwarding.
- breach runbook.

Required artifact:

- `docs/research/security-threat-model-plan-2026-05-03.md`

## Track 5: Authorization

Still needs detailed execution:

- SpiceDB schema.
- role/department/camp scoping.
- patient consent sharing model.
- time-bound permissions.
- bulk-check optimization.
- permission cache TTL.
- offline manifest relationship to server authority.

Required artifact:

- `docs/research/authz-spicedb-plan-2026-05-03.md`

## Track 6: Open Formats

Partly captured in enterprise plan.

Still needs detailed execution:

- OpenAPI 3.1 publication.
- FHIR resource coverage.
- DICOMweb support.
- HL7 v2 adapters.
- PDF/A and PDF/UA policy.
- CSV/NDJSON export policy.
- open-format dependency lint.
- forbidden proprietary dependency list.

Required artifact:

- `docs/research/open-formats-plan-2026-05-03.md`

## Track 7: Compliance

Partly captured in regulatory map.

Still needs detailed execution:

- NABH 76 indicator source matrix.
- DPDP workflow implementation plan.
- ABDM/NHCX implementation plan.
- HIPAA-equivalent control plan.
- NDPS/PCPNDT/MTP/BMW/Mental Healthcare module-level evidence.

Required artifact:

- `docs/research/compliance-evidence-plan-2026-05-03.md`

## Track 8: Infrastructure

Partly captured in enterprise plan.

Still needs detailed execution:

- Starter tier operations.
- Growth tier apply test.
- Enterprise k3s Helm chart.
- Enterprise EKS apply test.
- Edge tier.
- S3 Object Lock backup procedure.
- cross-region replication.
- Prometheus/Grafana/OTLP/Loki or CloudWatch.
- alerting.
- mobile/desktop CI.
- Helm chart release.
- security scanning.

Required artifact:

- `docs/research/infrastructure-tier-plan-2026-05-03.md`

## Track 9: Hardware Integration

Still needs detailed execution:

- BLE vitals devices.
- USB serial medical devices.
- DICOM gateway.
- barcode/QR scanners.
- label printers.
- HL7 v2 listener.
- nurse-call/code-blue/fire alarm adapters.
- card readers.
- cash drawer and receipt printer.
- hardware failure modes.
- audit and device authentication.

Required artifact:

- `docs/research/hardware-integration-plan-2026-05-03.md`

## Track 10: Tests

Partly captured in module definition of done.

Still needs detailed execution:

- unit test coverage gates.
- integration tests.
- Playwright scenario tests.
- smoke test generation.
- page-load test generation.
- form round-trip tests.
- load tests with Goose.
- OWASP ZAP.
- cargo-audit, pnpm audit, Trivy.
- axe-core accessibility.

Required artifact:

- `docs/research/test-strategy-plan-2026-05-03.md`

## Track 11: Documentation

Still needs detailed execution:

- format guarantees.
- threat model.
- disaster recovery.
- breach runbook.
- operator onboarding.
- OpenAPI docs.
- JSON schemas.
- NABH monthly report runbook.
- quarterly DR drill runbook.
- key rotation runbook.
- mobile/desktop/offline RFCs.

Required artifact:

- `docs/research/documentation-plan-2026-05-03.md`

## Suggested Order To Create Remaining Plans

1. screen sweep execution plan.
2. business logic/data linkage plan.
3. db/infra/linkage doctor plan.
4. compile-time SQL migration plan.
5. ship pipeline plan.
6. compliance evidence plan.
7. offline sync CRDT plan.
8. client platforms plan.
9. infrastructure tier plan.
10. security/authz/open formats plans.
11. hardware/test/documentation plans.

## Code Rule While Claude Code Is Active

Continue docs-only work unless the user assigns a disjoint implementation area.
