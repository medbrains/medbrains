# Epic: External integration & API platform

No API keys/OAuth, no outbound webhooks, FHIR missing DiagnosticReport (ABDM blocker), PACS/DICOM at 5%. Audit refs: Part 2 Devices & PACS, Integrations.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P1-high · Area: area:integration · Milestone: M4 — Weeks 9-12: Compliance & platform

## Build API key issuance, scopes, and outbound webhooks

> As a **integration partner**, I want scoped API keys (issue/rotate/revoke) and subscribable outbound webhooks, so that third parties can integrate without sharing staff JWTs.

**Acceptance criteria**
- [ ] API key auth middleware with scopes + rate limits
- [ ] Webhook subscriptions with signed payloads + retry
- [ ] OpenAPI spec published

**Audit ref:** Part 2 Integrations (0%) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/middleware`, `new routes/api_keys.rs`
**Effort:** XL (>2 weeks)

Labels: P1-high, area:integration · Milestone: M4 — Weeks 9-12: Compliance & platform

## Add FHIR DiagnosticReport resource

> As a **ABDM gateway**, I want lab/radiology results exposed as FHIR R4 DiagnosticReport, so that ABDM interop stops being blocked (HIP role incomplete without it).

**Acceptance criteria**
- [ ] DiagnosticReport read + $everything inclusion
- [ ] LOINC-coded observations linked

**Audit ref:** Part 2 FHIR (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/fhir.rs`
**Effort:** M (1-3 days)

Labels: P1-high, area:integration · Milestone: M4 — Weeks 9-12: Compliance & platform

## Implement PACS/DICOM integration

> As a **radiologist**, I want modality worklist from orders, C-STORE ingestion, and an embedded OHIF viewer, so that imaging actually flows: order → modality → study → report (today 5%).

**Acceptance criteria**
- [ ] MWL SCP serves radiology orders
- [ ] C-STORE (or Orthanc proxy) ingests studies linked to orders
- [ ] OHIF/Cornerstone embed replaces external links

**Audit ref:** Part 2 PACS (CRITICAL gap) (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-bridge`, `radiology_dicom_studies`, `apps/web/src/pages/radiology.tsx`
**Effort:** XL (>2 weeks)

Labels: P1-high, area:integration · Milestone: M4 — Weeks 9-12: Compliance & platform

## Implement HL7 outbound and ASTM analyzer parser

> As a **lab in-charge**, I want outbound HL7 (orders→analyzers) and the ASTM serial parser for Sysmex-class devices, so that bidirectional analyzer integration instead of result-receive only.

**Acceptance criteria**
- [ ] ORM order messages outbound via bridge
- [ ] ASTM E1381/E1394 parser behind existing adapter config

**Audit ref:** Part 2 Devices (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-bridge`
**Effort:** L (1-2 weeks)

Labels: P2-medium, area:integration · Milestone: M4 — Weeks 9-12: Compliance & platform
