# SOC 2 / ISO 27001:2022 evidence pack — engineering view

Last reviewed 2026-10-12. Scope: the MedBrains product and the single production host (`app.medbrains.in`, attach tier,
EC2 `i-08e9496a3e110ebdc`, ap-south-1).

This maps criteria to **what exists in this repository**. It is not an audit opinion. Code proves a control is
*designed*; SOC 2 Type II and ISO certification also need proof it *operated* over a period (logs, tickets, sign-offs,
review records) — almost none of which exists yet. Status key:

- **Evidence exists** — artefact in the repo that a reviewer can inspect, and it applies to prod.
- **Partial** — built but not applied to prod, not enforced, not operating, or covers only part of the criterion.
- **Missing** — nothing found.

Paths are relative to `medbrains/` unless they start with `../` (repo root).

## SOC 2 Trust Services Criteria

| Criterion | Evidence in repo | Status | Gap |
|---|---|---|---|
| **CC1** Control environment (integrity, oversight, structure, competence, accountability) | `CLAUDE.md` coding/authz law; `../.github/CODEOWNERS` (moved to repo root 2026-10-12, single owner); `.github/BRANCH_PROTECTION.md` | Partial | No code of conduct, org chart, security roles, HR screening or training records. Branch protection documented, not evidenced as enforced. |
| **CC2** Communication & information | `docs/sops/` (29 SOPs), in-app guide (`/help`), RFCs `../RFCs/`, `docs/CERTIFICATIONS.md` | Partial | No external security/trust page, no customer-facing incident/breach communication channel, no internal security policy distribution record. |
| **CC3** Risk assessment | `docs/GO-LIVE-READINESS.md`, `docs/CERTIFICATION-READINESS.md`, `ENTERPRISE_READINESS_AUDIT.md` (repo root), `docs/RLS-EFFECTIVENESS.md` | Partial | Engineering risk lists exist; no formal risk register with owners, likelihood/impact, treatment and review dates. |
| **CC4** Monitoring of controls | `make check-all` (≈45 static control checks in `Makefile`), `make authz-ledger`, `../.github/workflows/ci.yml` | Partial | CI at repo root exists but runs end in `startup_failure` (GitHub billing, per `memory/reference_ci_state.md`), and several jobs are marked TODO / non-blocking (rustfmt, clippy, lint). No record of controls passing over time. |
| **CC5** Control activities / policies | `CLAUDE.md`; `docs/compliance/soc2-encryption-at-rest-control-plan.md`; `docs/compliance/data-masking-redaction-control-plan.md` | Partial | Engineering rules only; organisational policies not written (see list below). |
| **CC6.1** Logical access — authz | `crates/medbrains-core/src/permissions.rs`, `crates/medbrains-core/src/access/roles.rs`, `crates/medbrains-authz/`, `crates/medbrains-authz-gate/`, `../RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md`, `make check-permission-enforcement`, `check-authz-collapse`, `check-permissions` | Evidence exists | Patient-level access control is "built and barely applied" (`docs/GO-LIVE-READINESS.md` §2). |
| **CC6.1** Tenant isolation (RLS) | RLS policies (915 policies / 870 RLS tables in the schema, counted 2026-10-12), `crates/medbrains-db-migrations/src/migrations/0981_app_role_without_rls_bypass.sql`, `deploy/standalone/db-roles.sh`, `../scripts/check_rls.py` | Partial | Whether **prod** connects as `medbrains_app` (RLS active) or still as the owner is unverified from the repo — `install.sh` only splits roles on a new env or with `DB_ROLE_SPLIT=1`. CI debt ledger notes 51 tables with RLS enabled and no policy. |
| **CC6.1** Authentication | `crates/medbrains-auth/` (Argon2id, Ed25519 JWT, 7-day sessions, max 5 concurrent), `crates/medbrains-mfa/` (TOTP + recovery codes, per-role enforcement via `security.mfa_required_roles`), `crates/medbrains-sso-login/` (OIDC/SAML) | Partial | MFA is optional per tenant — no evidence it is required for prod admins. 7-day session lifetime is long for a clinical system. |
| **CC6.2/6.3** Provisioning, review, removal | Admin users/roles screens; per-user `access_matrix` overrides; SSO group→role JIT; review procedure + verified export queries `docs/compliance/ACCESS-REVIEW.md` | Partial | Procedure is a draft (org must fill/approve); no review has been performed; no in-app review/export screen; no joiner/mover/leaver process for MedBrains staff on AWS/GitHub/SSH. |
| **CC6.6** Boundary protection | Caddy TLS; SG on :22 limited to admin /32s (`memory/reference_prod_deploy_attach.md`); `../scripts/check_egress_allowlist.py` | Partial | SG is managed by hand, not terraform; temporary /32 rules are added/revoked manually with no log. |
| **CC6.7** Data in transit | HTTPS via Caddy; TLS-only policy on the new backup bucket (`infra/terraform/envs/medbrains-in/ops.tf`); `crates/medbrains-crypto/` (NHCX JWE/JWS, ABDM HIE) | Evidence exists | — |
| **CC6.1/6.7** Data at rest | `infra/terraform/modules/kms/` (rotating CMKs), `aws-ec2` EBS `kms_key_id`, `docs/compliance/soc2-encryption-at-rest-control-plan.md`, `../scripts/check_encryption_at_rest.py`; new SSE-KMS backup bucket | Partial | Prod is the attach tier, which uses **none** of the KMS/EBS terraform. Prod EBS encryption is unverified; on-host dumps are unencrypted files. |
| **CC6.8** Malware / unauthorised software | `deny.toml`; `../.github/workflows/security.yml` (cargo audit, cargo-deny, pnpm audit, TruffleHog, dependency review, CodeQL); `../.github/dependabot.yml`; `make check-secrets` | Partial | Moved to the repo root 2026-10-12 — will run once CI billing is fixed; no run on record yet. cargo-deny and pnpm audit non-blocking (legacy `deny.toml` keys / no baseline). No host EDR/AV. |
| **CC7.1** Vulnerability management | as CC6.8 | Partial | No scan results on record, no pen test, no patch cadence for the host OS. A production credential was committed to git history (`docs/GO-LIVE-READINESS.md` §3) — rotation not evidenced. |
| **CC7.2** Monitoring & anomaly detection | `crates/medbrains-server-core/src/middleware/access_log.rs` (PHI read log), `audit_log` with hash chain + `audit_chain_verifications` (`migrations/0030_audit.sql`), host checks `deploy/standalone/medbrains-host-check*`, new alarms `infra/terraform/envs/medbrains-in/ops.tf`, `docs/ops/MONITORING.md` | Partial | Alarms not yet applied; `ALERT_TOPIC_ARN` unset on prod so host alerts are silent; access-log write failures only logged (no fallback); no SIEM, no alert on audit-chain break. |
| **CC7.3-7.5** Incident response & recovery | `docs/compliance/INCIDENT-RESPONSE.md` (severity, roles, detection, CERT-In 6 h, DPDP, evidence, templates, PIR); `docs/ops/BACKUP-RESTORE.md` | Partial | Plan is a draft: roles, CERT-In PoC, contacts and contract notice periods unfilled and unapproved; no exercise held; CERT-In 180-day log retention and NTP unverified. |
| **CC8.1** Change management | PR template `../.github/PULL_REQUEST_TEMPLATE.md`, feature-branch + squash-merge workflow (git history), compile-time-checked SQL (`.sqlx/`), embedded migrations with header check (`make check-migration-headers`), `deploy.sh` / terraform | Partial | Branch protection documented, not evidenced as enforced; CI not green; prod deploys are run from a local worktree by hand with no recorded approval or deploy log. |
| **CC9.1** Business disruption risk | `docs/ops/BACKUP-RESTORE.md`, nightly `medbrains-pg-backup` | Partial | Single host, single AZ, RPO 24 h, offsite backup only once `ops.tf` is applied; no BCP. |
| **CC9.2** Vendor / third-party risk | `RFCs/RFC-INTEGRATION-WRAPPER.md`, egress allowlist | **Missing** | No vendor inventory or due-diligence records (AWS, GoDaddy, Cloudflare, Microsoft 365, SMS/payment providers). |
| **A1.1** Capacity | `crates/medbrains-loadtest/` (Goose), CPU/credit alarms (`ops.tf`), host-check disk floor | Partial | No load-test results on record for prod sizing; no capacity review. |
| **A1.2** Backups & environmental protection | `deploy/standalone/medbrains-pg-backup{,.service,.timer}` (DB dump + files mirror), opt-in WAL-G (`medbrains-wal-g-setup`, `medbrains-wal-g-backup.*`), `ops.tf` S3+KMS bucket with per-prefix lifecycle, `docs/ops/BACKUP-RESTORE.md` | Partial | All offsite parts are code only until applied; today prod has on-host dumps only. |
| **A1.3** Recovery testing | Restore drill 2026-10-12 recorded in `docs/ops/BACKUP-RESTORE.md` (all 917 tables + migrations verified; found and fixed lost GRANTs) | Partial | Drill was on the dev DB, not from S3 onto a fresh host; not scheduled. |
| **C1.1** Identify & protect confidential info | Data classes per field (`scripts/check_field_classes.py`, `make check-field-classes`), redaction plan `docs/compliance/data-masking-redaction-control-plan.md`, `docs/DLP.md`, `../scripts/check_no_card_logging.py`, region pinning `../scripts/check_region_pinning.py` | Evidence exists | — |
| **C1.2** Disposal | Soft-delete guardrail trigger on ~711 tables, purge of churn tables (#4689); S3 lifecycle on backups | Partial | No documented retention schedule per data class; erasure path "not built" (`CERTIFICATION-READINESS.md` §4). |
| **PI1** Processing integrity | Compile-time SQL (`.sqlx/`), Zod response validation, transactional outbox with retry/DLQ (`crates/medbrains-outbox/`), hash-chained audit log, server-verified clinical safety flags, test suites under `crates/*/tests`, `apps/web/e2e` | Partial | Test runs not evidenced in CI; no reconciliation reports on record. |
| **P** Privacy (notice, choice, consent, access, disclosure, quality, monitoring) | `crates/medbrains-consent/`, `patient_consents`/`consent_records`/`consent_audit_log`, marketing consent + suppressions (`migrations/0996_marketing_consent.sql`), PHI access log | Partial | No published privacy notice; data-subject access/erasure and breach notification not built; no DPO named (DPDP Act 2023). |

## ISO/IEC 27001:2022 Annex A

| Theme | Controls | Evidence in repo | Status |
|---|---|---|---|
| **A.5 Organisational** (37) | 5.1 policies, 5.2-5.4 roles, 5.7 threat intel, 5.9 asset inventory, 5.15-5.18 access control & identity, 5.19-5.23 suppliers & cloud, 5.24-5.28 incident mgmt, 5.29-5.30 continuity/ICT readiness, 5.31-5.36 legal, privacy, compliance | 5.15-5.18: authz crate, permissions, RLS, SSO, MFA (as CC6). 5.9: terraform modules list cloud assets for terraform-managed tiers. 5.29-5.30: `docs/ops/BACKUP-RESTORE.md`, `docs/ops/MONITORING.md`. 5.31/5.34: `docs/CERTIFICATIONS.md`, `docs/CERTIFICATION-READINESS.md`, consent crate. | **Partial** — technical access control is strong; policies, roles, supplier mgmt, threat intel (incident mgmt: draft plan only), asset register for prod (attach host is not in terraform) are **Missing**. |
| **A.6 People** (8) | screening, terms, awareness/training, disciplinary, termination, confidentiality/NDA, remote working, event reporting | none | **Missing** — entirely organisational. |
| **A.7 Physical** (14) | perimeters, entry, equipment, media, utilities, cabling, maintenance, disposal | AWS data centre (inherited — obtain AWS SOC 2 / ISO certificates via AWS Artifact) | **Partial (inherited)** — nothing for MedBrains' own offices/laptops. |
| **A.8 Technological** (34) | 8.2 privileged access, 8.3 information access restriction, 8.5 secure auth, 8.7 malware, 8.8 vuln mgmt, 8.9 config mgmt, 8.10 deletion, 8.11 masking, 8.12 DLP, 8.13 backup, 8.15 logging, 8.16 monitoring, 8.17 clock sync, 8.20-8.22 network security/segregation, 8.24 cryptography, 8.25-8.29 secure SDLC & testing, 8.31 env separation, 8.32 change mgmt | 8.3: RLS + authz. 8.5: Argon2id, MFA, SSO. 8.9: terraform + `deploy/standalone/`. 8.11: redaction plan + field classes. 8.12: `docs/DLP.md`. 8.13: backup script + `ops.tf` + drill. 8.15: `audit_log` hash chain, `access_log`. 8.16: `ops.tf` alarms, host checks. 8.24: KMS module, `medbrains-crypto`. 8.25-8.29: CLAUDE.md standards, clippy denies, `make check-all`, tests. 8.32: PR workflow, migrations. | **Partial** — 8.2 (privileged access to prod: SSH key + ad-hoc SG rules, no PAM/session log), 8.7/8.8 (scans never run), 8.17 (NTP to NIC/NPL unverified), 8.31 (dev/prod separation undocumented), 8.15 (180-day log retention in India unverified) are weak or Missing. |

## Policy documents the organisation must write

These cannot be produced from code and must not be fabricated. Each needs an owner, approval and a review date:

1. Information Security Policy (top-level, management-approved) and ISMS scope statement (ISO 4.3).
2. Statement of Applicability (ISO 6.1.3) and risk assessment & treatment methodology + risk register.
3. Access Control Policy, including quarterly access reviews and joiner/mover/leaver procedure.
4. Incident Response Plan, including CERT-In 6-hour reporting and DPDP breach notification, with contacts.
5. Business Continuity & Disaster Recovery Plan (RPO/RTO targets approved by the business; the numbers in
   `docs/ops/BACKUP-RESTORE.md` are engineering estimates).
6. Change Management Policy (who approves prod deploys, emergency change process).
7. Vendor / Supplier Management Policy and vendor inventory.
8. Data Classification, Retention & Disposal Policy (per data class; medical-record retention law).
9. Privacy Notice and DPDP policy; DPO / grievance officer appointment.
10. Acceptable Use, HR security (screening, NDA, training, disciplinary) and remote-work/BYOD policies.
11. Cryptography & Key Management Policy.
12. Vulnerability & Patch Management Policy (including pen-test cadence).
13. Logging & Monitoring Policy (retention, review cadence, who responds).

## Top gaps to close first

1. **Prod backup is on-host only and alerts are silent** — apply `infra/terraform/envs/medbrains-in/ops.tf`, set
   `BACKUP_BUCKET` + `ALERT_TOPIC_ARN` on the host (`docs/ops/BACKUP-RESTORE.md`); then decide on WAL archiving.
2. **CI does not run** (`startup_failure`, billing) — the security workflows now sit at the repo root but have no run on
   record until that is fixed.
3. **Incident response** — fill and approve `INCIDENT-RESPONSE.md`, register the CERT-In point of contact, verify
   180-day log retention in India and NTP.
4. **Access reviews** — run the first one with `ACCESS-REVIEW.md` and keep the sign-off.
5. **Prod database role** — verify prod runs as `medbrains_app` so RLS actually applies.
6. **Rotate the credential** found in git history and record the rotation.
