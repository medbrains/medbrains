# Data Masking and Redaction Control Plan

## Purpose

Encryption at rest protects stored data from storage-layer compromise. It does not decide what a
cashier, nurse, doctor, export job, log, demo database, PDF, DICOM image, analytics dataset, or AI
prompt is allowed to see. Masking, redaction, pseudonymization, and de-identification are therefore
separate privacy controls for MedBrains.

This plan maps the techniques into product behavior, evidence, and backlog for SOC 2, ISO 27001,
ISO 27701, DPDP, ABDM, HIPAA-readiness, NABH, and GDPR-readiness work. It is not a certification
claim.

## Source Register

| Source | Product interpretation |
| --- | --- |
| NIST SP 800-122, `https://csrc.nist.gov/pubs/sp/800/122/final` | PII confidentiality requires controls across access, audit, media, transmission, and data minimization, not storage encryption alone. |
| NIST SP 800-188, `https://csrc.nist.gov/pubs/sp/800/188/final` | De-identification needs governance, direct identifier handling, quasi-identifier risk analysis, pseudonymization, synthetic data, and release review. |
| HHS HIPAA de-identification guidance, `https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html` | PHI de-identification has two recognized approaches: expert determination and safe-harbor-style identifier removal. |
| GDPR Article 4(5), official EU GDPR text, `https://eur-lex.europa.eu/eli/reg/2016/679/oj` | Pseudonymized data can remain personal data if it can be re-linked with additional information. |
| DICOM standard overview, `https://www.dicomstandard.org/about` | Imaging privacy must handle both metadata and image payload risks such as burned-in identifiers. |

## Technique Taxonomy

| Technique | Use in MedBrains | Main risk if misused |
| --- | --- | --- |
| Black-box redaction | PDFs, document previews, scanned forms, screenshots, and DICOM rendered images only after the underlying text, annotations, metadata, and layers are removed or flattened. | Drawing a black rectangle over text in Word/PDF/CSS can leave recoverable text underneath. |
| Full or partial nulling | Backend API DTOs, egress events, webhooks, integrations, and exports where the receiver should not get a sensitive value at all. | Replacing with `NULL` can break workflows unless schemas and UI distinguish redacted from absent. |
| Partial redaction | Printed forms, exports, ID proofs, statements, receipts, and communication previews where only the sensitive segment is hidden while the rest of the record stays readable. | Hiding only one segment can still identify a person when the visible parts are combined with timing, location, diagnosis, or service context. |
| Partial masking | Operational UI where a role needs recognition but not full identity: last four digits of phone, Aadhaar, policy number, member id, card/token reference, or payment reference. | Partial values can still identify a person when combined with date, ward, doctor, diagnosis, or address. |
| Pseudonymization | Analytics, training, demos, simulator replay, and research datasets that need stable joins without direct identifiers. Use tenant-scoped HMAC/token ids and keep the mapping table separately encrypted. | Pseudonymized data is still sensitive when re-linking is possible. Treat as personal data unless anonymization is proven. |
| Data masking | Database and application data for testing, training, sales demos, screenshots, and support reproduction. Preserve data type, length, uniqueness, and referential integrity where the application depends on them. | Masking that changes formats or breaks joins creates false test failures and encourages use of unsafe production dumps. |
| Substitution and scrambling | Non-production demo/test datasets where realistic but inauthentic values are needed for names, phones, addresses, UHIDs, policy ids, and payment references. Prefer deterministic, format-preserving substitution. | Random scrambling can create invalid values, duplicate unique keys, or re-identifiable rare combinations. |
| Shuffling/swapping | Low-risk attributes can be swapped across rows only when clinical and legal meaning is not corrupted. Do not shuffle diagnoses, prescriptions, allergies, MLC facts, billing amounts, or consent records. | Swapping fields independently can create clinically false records and patient-safety evidence that never happened. |
| Encryption | Storage, field-level secrets, ABHA tokens, signed-document keys, payment gateway tokens, and high-risk identifiers where authorized reveal is needed. | Encryption is reversible by design; it is not de-identification or masking. |
| Bucketing/generalization | Reporting and dashboards: age bands, district/state instead of address, month instead of timestamp, ward/service aggregation. | Small buckets can re-identify patients, especially with rare diagnoses or procedures. |
| Synthetic data | Training, sales demos, simulator seed packs, and public examples. | Synthetic data must not be created by copying real PHI and lightly editing names. |

## Redaction and Masking Rules

1. Visual black boxes are allowed only as the final visual layer after the underlying document text,
   annotations, metadata, hidden layers, OCR text, and embedded attachments are removed or flattened.
2. PDF, scanned-form, print-output, and DICOM release workflows must use a dedicated redaction
   pipeline or tool class, not CSS overlays, Word highlights, screenshot pixelation, or reduced image
   resolution.
3. Database masking jobs must be deterministic where joins must survive, format-preserving where
   validators depend on length or pattern, and tenant-scoped so two hospitals cannot be linked by
   the same pseudonym.
4. Nulling must be explicit in the API contract. A blank or `NULL` value that means "redacted" must
   not be confused with "unknown", "not captured", or "patient refused".
5. Shuffling/swapping is not allowed for clinical, legal, medication, consent, billing, or audit facts
   unless a privacy review approves that the resulting dataset cannot mislead testing or analytics.
6. Pseudonymization keys and mapping tables are secrets. They must be separately encrypted, access
   controlled, rotated, and excluded from demos, support bundles, analytics exports, and AI prompts.

## Boundary Decision Guide

| Boundary | Default privacy treatment | Notes |
| --- | --- | --- |
| Production clinical UI | Field-level `view`, `mask`, `reveal`, and `hidden` semantics. | Half/partial masking is valid for recognition only, such as `XXXXXX1234`; full reveal needs permission and audit. |
| Patient-facing/public displays | Tokenized or generalized values only. | Avoid direct identifiers on queue boards, ward boards, dashboards, and public screens. |
| Print, PDF, scanned form, image, and DICOM release | True redaction or nulling before release. | A visible black box is not enough unless underlying text, metadata, OCR, layers, annotations, and burned-in identifiers are removed or flattened. |
| APIs, webhooks, integrations, logs, and AI prompts | Data minimization, nulling, masking, or pseudonymization before egress. | Do not send raw PHI/PII just because the database stores it encrypted. |
| Non-production databases | Deterministic, format-preserving masking with referential integrity. | Use substitution/scrambling for realistic values; restrict shuffling to low-risk non-clinical fields. |
| Analytics and research | Pseudonymization plus bucketing/generalization. | Preserve statistical utility, but document rare-bucket and re-identification risk. |
| Evidence and audit bundles | Redacted exports with hash manifest and reveal approval where needed. | Auditor evidence can contain sensitive values only when there is an explicit purpose and access trail. |

## Current Integration Evidence

| Boundary | Current repo evidence | Status |
| --- | --- | --- |
| Field-level UI/API access | `crates/medbrains-server/src/middleware/field_access.rs`, `packages/types/src/index.ts`, and role/user `field_access` maps support `edit`, `view`, and `hidden`. | Present |
| Cloud-egress nulling | `crates/medbrains-core/src/boundary_filter.rs` strips PHI fields, fails closed on unknown fields, and reports redacted paths. | Present |
| Aadhaar handling | `crates/medbrains-server/src/routes/patients.rs` stores masked/hash Aadhaar and rejects raw invalid Aadhaar. | Present |
| Client error logs | `crates/medbrains-server/src/routes/client_errors.rs` redacts UUID-like route segments before storing client error telemetry. | Present |
| Camp, IPD, emergency, pharmacy, billing field masking | `docs/audit/permission-entity-matrix.md` tracks backend/UI masking work by module and field family. | Partial |
| PDF/document/DICOM hard redaction | Document and DICOM pipelines exist, but hard redaction must still remove text, metadata, annotations, and burned-in identifiers before release. | Gap |
| Non-production masking job | Demo fixtures and simulator data exist, but a formal deterministic data masking and pseudonymization job is still needed. | Gap |

## Control Map

| Control id | Control objective | Product rule | Evidence |
| --- | --- | --- | --- |
| PRIV-MASK-001 | Sensitive fields are classified before release or export. | Maintain a data-classification registry for PHI, PII, financial, credential, legal/MLC, drug-control, and operational metadata fields. Unknown egress fields fail closed. | Boundary filter test, classification registry, `check-redaction-masking`. |
| PRIV-MASK-002 | UI and APIs reveal only the minimum needed field value. | Use field access with `edit`, `view`, `mask`, and `hidden` semantics for patient identity, phone, email, Aadhaar, ABHA, policy/member ids, MLC, diagnosis, mental health, drug, and payment data. Audited `reveal` remains a separate elevated workflow. | Field-access matrix, role templates, reveal audit log. |
| PRIV-MASK-003 | Logs and telemetry never carry raw PHI/secrets. | Redact UUIDs, patient identifiers, tokens, card-like values, secrets, request bodies, and free-text PHI before log/write/export. | Client-error redaction tests, log scanner, no-card-logging check. |
| PRIV-MASK-004 | Documents and images use true redaction. | PDF/image/DICOM release must remove hidden content and metadata, then flatten or regenerate the artifact. Visual-only black boxes are not accepted as evidence. | Redaction pipeline test, before/after metadata report, hash manifest. |
| PRIV-MASK-005 | Test/demo/training data is not production PHI. | Use synthetic data or deterministic masked clones with preserved types, lengths, and referential integrity. Never use a production dump without an approved masking run. | Masking job run id, source/destination manifest, sample verification. |
| PRIV-MASK-006 | Analytics uses pseudonymization and aggregation. | Use tenant-scoped pseudonyms, keep mapping keys separate, aggregate rare buckets, and document re-identification risk before export. | Analytics privacy review, bucket-size report, key separation evidence. |
| PRIV-MASK-007 | Full reveal is exceptional and audited. | Any full reveal of high-risk data must require permission, purpose, reason, time, user, patient/context, and audit event. | Reveal audit events, access review, break-glass sample. |
| PRIV-MASK-008 | AI and external integrations receive minimized data. | AI prompts, webhook payloads, CRM/accounting exports, and messaging templates must use only fields needed for the purpose and respect consent/field access. | Connector mapping, prompt template review, webhook sample. |

## Immediate Backlog

1. Extend field access from current `edit/view/mask/hidden` to audited `reveal`
   requests with reason, patient/context, expiry, and access-review evidence.
2. Expand reusable masking helpers from phone/name/free-text/identifier coverage into email, Aadhaar, ABHA, policy/member id, payment reference,
   address, date of birth, and rare clinical identifiers.
3. Add a `PseudonymizationService` with tenant-scoped HMAC keys stored through the secrets/KMS layer.
4. Add a hard-redaction pipeline for PDFs, print outputs, scanned forms, and DICOM metadata/pixels.
5. Add deterministic masking jobs for non-production datasets, simulator packs, training, sales demos,
   screenshots, and seeded fixtures.
6. Add Compliance Center records for `PRIV-MASK-001` through `PRIV-MASK-008`.
