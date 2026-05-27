# SOC 2 Encryption At Rest Control Plan

Last researched: 2026-05-25

## Position

SOC 2 is not an application license. It is an auditor-issued report over a defined system,
control scope, criteria set, and observation period. Encryption at rest is one required
technical control family for MedBrains' expected SOC 2 Security, Confidentiality, Privacy,
and Availability scope, but it is not sufficient by itself.

Masking, redaction, pseudonymization, and de-identification are separate privacy controls.
They are tracked in `docs/compliance/data-masking-redaction-control-plan.md`; encrypted
storage alone does not make data safe to expose in UI, logs, exports, demos, analytics,
AI prompts, PDFs, or DICOM release workflows.

If MedBrains embeds AICPA Trust Services Criteria text, SOC marks, or AICPA copyrighted
framework content inside a commercial compliance module, treat that as an AICPA content
licensing question. Product controls should reference the framework and store our own
control language unless a license is obtained.

## Source Basis

| Source | What it establishes for MedBrains |
| --- | --- |
| AICPA and CIMA, 2017 Trust Services Criteria with revised points of focus 2022, `https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022` | SOC 2 evaluates controls over security, availability, processing integrity, confidentiality, or privacy of systems and information. |
| AICPA and CIMA, SOC 2 reporting guide page, `https://www.aicpa-cima.com/cpe-learning/publication/soc-2-reporting-on-an-examination-of-controls-at-a-service-organization-relevant-to-security-availability-processing-integrity-confidentiality-or-privacy` | SOC 2 is an examination/reporting engagement, not an application license or product badge. |
| AICPA and CIMA IP licensing page, `https://www.aicpa-cima.com/resources/landing/licensing-for-teams` | Embedding AICPA SOC/TSC content or marks in software is a separate content/IP licensing concern. |
| NIST SP 800-111, `https://csrc.nist.gov/pubs/sp/800/111/final` | Storage encryption is a control for restricting unauthorized use of stored information; storage type and threat model drive the encryption design. |
| NIST SP 800-57 Part 1 Rev. 5, `https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final` | Key management must cover key material lifecycle, protection, authorized use, recovery, rotation, and cryptographic planning. |

## Control Statement

MedBrains production environments must encrypt patient data, audit evidence, documents,
backups, logs, Kubernetes secrets, queues, caches, search indexes, and exported evidence at
rest using centrally governed keys. Cryptographic keys must be separated from data storage,
rotated on a documented cadence, access-reviewed, and supported by restore and evidence
export tests.

## Current Implementation Evidence In Repo

| Area | Current evidence | Status |
| --- | --- | --- |
| KMS key separation | `infra/terraform/modules/kms/main.tf` defines app, db, audit, and secrets CMKs with rotation. | Present |
| Aurora PostgreSQL | `infra/terraform/modules/aurora/main.tf` sets `storage_encrypted = true`, uses a DB KMS key, stores DB master secret under KMS, exports PostgreSQL logs, enables backups and snapshots. | Present |
| Patroni PostgreSQL | `infra/terraform/modules/patroni-cluster/main.tf` encrypts root and PG data EBS volumes with the supplied KMS key. | Present |
| Object storage | `infra/terraform/modules/s3/main.tf` encrypts audit archive and patient uploads with KMS and enables audit archive Object Lock. | Present |
| Kubernetes secrets | `infra/terraform/modules/eks/cluster.tf` envelope-encrypts Kubernetes secrets with KMS and encrypts cluster logs. | Present |
| Local/dev secrets | `.env.example` documents signature key wrapping and event-token encryption keys, with a note to prefer file/Vault/KMS-backed resolvers for multi-tenant production. | Partial |

## Required Product And Infra Integration

| Control ID | Requirement | Implementation tasks | Auditor evidence |
| --- | --- | --- | --- |
| SOC2-ENC-001 | Production database storage is encrypted with tenant/environment scoped KMS keys. | Keep Aurora and Patroni encryption mandatory; add Terraform validation/preconditions that reject unencrypted DB volumes or missing DB KMS keys. | Terraform plan/apply output, AWS config snapshot, DB cluster/volume encryption export. |
| SOC2-ENC-002 | Backups, WAL archives, and final snapshots are encrypted and restorable. | Add evidence job for backup encryption settings, KMS key id, restore drill result, RPO/RTO, and snapshot copy status. | Monthly restore drill, backup inventory, KMS key id sample, restore checksum. |
| SOC2-ENC-003 | Uploaded documents, DICOM/PACS objects, print artifacts, consent PDFs, and MRD case sheets are encrypted at rest. | Route every object-store bucket through KMS; no PHI in static bucket; attach object tags for data class and retention. | Bucket encryption report, object tag sample, denied public access sample. |
| SOC2-ENC-004 | Audit logs and compliance evidence are encrypted and tamper-resistant. | Keep audit archive KMS + Object Lock; add evidence export hash, retention policy, and replay/read access audit. | Object Lock config, audit archive sample, hash manifest, access-log sample. |
| SOC2-ENC-005 | Application-level secrets and signing keys are envelope-encrypted or stored in a managed secret store. | Replace production `.env` secrets with Secrets Manager/Vault/KMS resolver; keep only dev stubs in `.env.example`; add secret access audit events. | Secrets inventory, IAM policy, rotation record, failed plaintext-secret scan. |
| SOC2-ENC-006 | Sensitive field-level data can be encrypted separately when storage admins must not see plaintext. | Add envelope encryption service for high-risk columns: government IDs, insurance policy IDs, phone/email where required, ABHA tokens, payment gateway tokens, police/MLC sensitive fields, and signed-document private keys. | Data classification map, key hierarchy diagram, field encryption test, decrypt access audit. |
| SOC2-ENC-007 | Keys are governed through lifecycle controls. | Define owners, rotation cadence, break-glass access, key disable/delete approval, recovery procedure, and dual-control for production key policy changes. | Key rotation report, access review, key policy diff, break-glass sample. |
| SOC2-ENC-008 | Local, mobile, TV, and edge/offline stores are encrypted. | Add device-store encryption requirements for mobile WatermelonDB, offline queues, TV tokens, barcode/QR payload caches, printer buffers, and crash reports. | Mobile/edge encryption test, device wipe test, offline sync security sample. |
| SOC2-ENC-009 | Search/cache/analytics stores do not become plaintext side channels. | Before enabling Redis/Dragonfly/Meilisearch/NATS, require disk encryption, TLS, retention, data minimization, and PHI redaction where not needed. | Store config export, data-minimization test, retention test. |
| SOC2-ENC-010 | Compliance Center tracks encryption control status and evidence. | Add Compliance Center records for each encryption control with owner, due date, evidence artifact, environment, pass/fail, and next review. | Compliance Center export, evidence approval trail, control history. |

## Engineering Rules

1. Never claim SOC 2 certification or SOC 2 Type II readiness from code presence alone.
2. No production PHI store may be added without an explicit encryption-at-rest control row.
3. KMS key ids/aliases must appear in infrastructure outputs and evidence exports.
4. Field-level encryption must be used when infrastructure encryption is not enough for the
   threat model, especially for high-sensitivity identifiers and private keys.
5. Every encrypted store must have restore/decrypt tests, not only write-path tests.
6. Key rotation and access review must be recurring evidence, not one-time setup screenshots.

## Immediate Backlog

1. Keep `make check-encryption-at-rest` in `check-all`; it fails if Aurora, Patroni EBS, S3 PHI
   buckets, audit archive, Kubernetes secrets, or core KMS rotation evidence is removed, and
   supports `--json` for Compliance Center ingestion.
2. Add Terraform preconditions/validation blocks for any future storage module that handles PHI.
3. Add Compliance Center control/evidence records for `SOC2-ENC-001` through `SOC2-ENC-010`.
4. Add a backend `EncryptionEvidenceService` that records storage inventory, KMS alias, last
   rotation, restore-test reference, and owner per environment.
5. Add a field-encryption design RFC for ABHA tokens, signed-document keys, insurance policy IDs,
   government identifiers, MLC sensitive fields, and contact data where customer contracts require
   application-layer encryption.
