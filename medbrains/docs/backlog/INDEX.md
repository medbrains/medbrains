# Backlog Index — Enterprise Readiness Audit

| Issue | Type | Title | Priority | Milestone |
|---|---|---|---|---|
| #151 | epic | Epic: Security hardening | P0-critical | M1 — Week 1: Critical security & infra |
| #152 | story | Fail startup when production JWT keys are missing | P0-critical | M1 — Week 1: Critical security & infra |
| #153 | story | Gate seed credentials and force first-login password change | P0-critical | M1 — Week 1: Critical security & infra |
| #154 | story | Restrict SSH ingress on EC2 security group | P0-critical | M1 — Week 1: Critical security & infra |
| #155 | story | Rotate leaked PAT/AWS credentials and move secrets out of git | P0-critical | M1 — Week 1: Critical security & infra |
| #156 | story | Add per-account lockout after failed logins | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #157 | story | Build password reset / forgot-password flow | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #158 | story | Add TOTP MFA, mandatory for doctor/admin roles | P0-critical | M3 — Weeks 5-8: Hardening & onboarding |
| #159 | epic | Epic: Multi-tenancy & database integrity | P0-critical | M1 — Week 1: Critical security & infra |
| #160 | story | Enable RLS on the 44 tenant tables missing it | P0-critical | M1 — Week 1: Critical security & infra |
| #161 | story | Backfill FK and (tenant_id, status) composite indexes | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #162 | story | Add GIN indexes on queried JSONB columns | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #163 | story | Add CHECK constraints to free-text status columns | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #164 | story | Partition and archive log/event tables | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #165 | epic | Epic: Backend hardening | P0-critical | M1 — Week 1: Critical security & infra |
| #166 | story | Scope bridge heartbeat UPDATE by tenant | P0-critical | M1 — Week 1: Critical security & infra |
| #167 | story | Default pagination + LIMIT on all list endpoints | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #168 | story | Add permission checks to unchecked setup handlers | P0-critical | M1 — Week 1: Critical security & infra |
| #169 | story | Implement graceful shutdown on SIGTERM | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #170 | story | Extend rate limiting beyond login | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #171 | story | Audit PHI list/read endpoints | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #172 | story | Enforce data retention with a purge job | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #173 | story | Verify public booking identity with OTP | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #174 | epic | Epic: Infrastructure reliability | P0-critical | M1 — Week 1: Critical security & infra |
| #175 | story | Add CloudWatch alarms and EC2 auto-recovery | P0-critical | M1 — Week 1: Critical security & infra |
| #176 | story | Keep EBS on termination and split data volume | P0-critical | M1 — Week 1: Critical security & infra |
| #177 | story | Move standalone terraform state to S3 with locking | P0-critical | M1 — Week 1: Critical security & infra |
| #178 | story | Add deploy rollback and pre-deploy backup gate | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #179 | story | Add log rotation and uptime synthetics | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #180 | story | Run a backup restore drill and write the runbook | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #181 | epic | Epic: Clinical safety & compliance | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #182 | story | Deliver critical lab values via SMS with acknowledgment | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #183 | story | Build NABH/JCI checklist engine | P0-critical | M4 — Weeks 9-12: Compliance & platform |
| #184 | story | Enforce WHO surgical safety checklist in OT flow | P0-critical | M4 — Weeks 9-12: Compliance & platform |
| #185 | story | Add lab QC hold/recheck/supervisor-approval workflow | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #186 | story | Track dialyzer reuse and machine scheduling | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #187 | story | Generate PCPNDT statutory form for maternity scans | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #188 | epic | Epic: Revenue & module linkages | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #189 | story | Auto-bill room rent daily on IPD admission | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #190 | story | Finalize invoice on IPD discharge | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #191 | story | Deliver appointment reminders via SMS/email job | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #192 | story | Enforce TPA pre-authorization at billing | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #193 | story | Create OPD queue entry on appointment check-in | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #194 | story | Auto-reverse billing lines on clinical cancellation | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #195 | epic | Epic: Frontend stability & UX safety | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #196 | story | Add onError handling to all mutations | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #197 | story | Wrap destructive actions in confirmation dialogs | P0-critical | M2 — Weeks 2-4: Reliability & revenue |
| #198 | story | Render query error states on all pages | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #199 | story | Validate API responses with Zod at runtime | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #200 | story | Add skeletons and empty states | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #201 | story | Move hardcoded notification strings into i18n | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #202 | epic | Epic: Notifications & connector delivery | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #203 | story | Implement real SMTP email delivery | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #204 | story | Implement WhatsApp connector delivery | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #205 | story | Wire the 8 missing notification events | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #206 | story | Add on-call roster lookup for alert routing | P1-high | M2 — Weeks 2-4: Reliability & revenue |
| #207 | epic | Epic: Onboarding & ETL | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #208 | story | Bulk import lab catalog, formulary, tariffs, patients via CSV/Excel | P1-high | M3 — Weeks 5-8: Hardening & onboarding |
| #209 | story | Make operational settings configurable via UI | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #210 | story | Export/import tenant configuration between environments | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #211 | epic | Epic: Component library consolidation | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #212 | story | Consolidate status→color maps into StatusBadge | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #213 | story | Migrate raw Mantine tables to shared DataTable | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #214 | story | Extract FormModal scaffold for RHF+Zod forms | P2-medium | M3 — Weeks 5-8: Hardening & onboarding |
| #215 | story | Centralize formatters (money, percent, bytes) | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #216 | story | Add showNotification helper and migrate inline calls | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #217 | story | Promote StatCard and add useCRUDMutation hook | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #218 | epic | Epic: Workflow engine & forms/printing runtime | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #219 | story | Decide: activate or remove the workflow engine | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #220 | story | Build form-builder routes and runtime renderer | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #221 | story | Build print-job daemon and thermal ZPL/ESC-POS output | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #222 | story | Add pharmacy dispensing-label endpoint | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #223 | epic | Epic: External integration & API platform | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #224 | story | Build API key issuance, scopes, and outbound webhooks | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #225 | story | Add FHIR DiagnosticReport resource | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #226 | story | Implement PACS/DICOM integration | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #227 | story | Implement HL7 outbound and ASTM analyzer parser | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #228 | epic | Epic: Missing modules — build or decide | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #229 | story | Build telemedicine module | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #230 | story | Build dental charting backend and UI | P1-high | M4 — Weeks 9-12: Compliance & platform |
| #231 | story | Build ophthalmology module | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #232 | story | Implement CMS content handlers (replace 501s) | P2-medium | M4 — Weeks 9-12: Compliance & platform |
| #233 | story | Decide marketing/CRM scope | P2-medium | M4 — Weeks 9-12: Compliance & platform |
