# Epic: Security hardening

Close the P0 security findings from the enterprise audit: leaked secrets, weak startup key handling, seed credentials, open SSH, and missing account-protection flows (lockout, reset, MFA). Audit refs: P0 #1-#7.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P0-critical · Area: area:security · Milestone: M1 — Week 1: Critical security & infra

## Fail startup when production JWT keys are missing

> As a **sysadmin**, I want the server to refuse to start in production if JWT_PRIVATE_KEY/JWT_PUBLIC_KEY are unset, so that a restart never silently regenerates keys and invalidates every active session.

**Acceptance criteria**
- [ ] Production env without both keys → startup error with clear message
- [ ] Dev/test keep auto-generated Ed25519 keypair behaviour
- [ ] Deployment docs updated with key provisioning steps

**Audit ref:** P0 #1 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/config.rs:186-306`
**Effort:** S (<1 day)

Labels: P0-critical, area:security · Milestone: M1 — Week 1: Critical security & infra

## Gate seed credentials and force first-login password change

> As a **hospital admin**, I want demo/seed accounts (admin/admin123 etc.) created only when MEDBRAINS_ALLOW_SEED=true and forced to change password on first login, so that default credentials can never reach a production tenant.

**Acceptance criteria**
- [ ] Seed runs only with MEDBRAINS_ALLOW_SEED=true
- [ ] Seeded users flagged must_change_password; login flow enforces change
- [ ] Existing deployments documented for credential rotation

**Audit ref:** P0 #2 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/seed/mod.rs:77`, `crates/medbrains-server/src/seed/demo_patients.rs:18-62`
**Effort:** M (1-3 days)

Labels: P0-critical, area:security · Milestone: M1 — Week 1: Critical security & infra

## Restrict SSH ingress on EC2 security group

> As a **devops engineer**, I want SSH limited to operator IPs or SSM Session Manager instead of 0.0.0.0/0, so that the hospital server is not exposed to internet-wide brute force.

**Acceptance criteria**
- [ ] Security group port 22 restricted to allowlisted CIDRs or removed in favour of SSM
- [ ] terraform apply produces working end-state (no manual steps)

**Audit ref:** P0 #3 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `infra/terraform/modules/standalone-vm/aws-ec2/main.tf:106-112`
**Effort:** S (<1 day)

Labels: P0-critical, area:infra · Milestone: M1 — Week 1: Critical security & infra

## Rotate leaked PAT/AWS credentials and move secrets out of git

> As a **security officer**, I want the committed GitHub PAT and AWS creds rotated immediately and all secrets sourced from Secrets Manager / env injection, so that leaked credentials cannot be abused and the repo holds no live secrets.

**Acceptance criteria**
- [ ] PAT and AWS keys rotated; old ones revoked
- [ ] .env files with secrets removed from git history tracking and gitignored
- [ ] Server reads secrets from AWS Secrets Manager or instance env

**Audit ref:** P0 #4 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `medbrains/.env:33`, `infra/.env:15-26`
**Effort:** M (1-3 days)

Labels: P0-critical, area:security · Milestone: M1 — Week 1: Critical security & infra

## Add per-account lockout after failed logins

> As a **security officer**, I want accounts to lock temporarily after N failed attempts (tracked per user, not just per IP), so that credential stuffing across distributed IPs is blocked.

**Acceptance criteria**
- [ ] users gain failed_login_attempts + locked_until columns
- [ ] Lockout threshold/window configurable per tenant
- [ ] Audit log entry on lockout; clear unlock path for admins

**Audit ref:** P0 #6 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/auth.rs`
**Effort:** M (1-3 days)

Labels: P0-critical, area:security · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Build password reset / forgot-password flow

> As a **staff user**, I want a self-service email/SMS reset with time-limited tokens, so that I can recover access without an admin manually resetting my password.

**Acceptance criteria**
- [ ] Reset request → time-limited single-use token via email/SMS
- [ ] Token verify + new password (Argon2id) endpoint
- [ ] Frontend pages for request + reset; rate-limited

**Audit ref:** P0 #7 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/auth.rs`, `apps/web/src/pages/login.tsx`
**Effort:** L (1-2 weeks)

Labels: P0-critical, area:security · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Add TOTP MFA, mandatory for doctor/admin roles

> As a **hospital admin**, I want TOTP-based MFA with enforced enrollment for privileged roles, so that PHI access meets HIPAA/NIST authentication requirements.

**Acceptance criteria**
- [ ] TOTP enroll/verify endpoints + recovery codes
- [ ] Role-based enforcement policy (doctor/admin mandatory)
- [ ] Login flow supports MFA challenge; E2E test

**Audit ref:** P0 #5 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `crates/medbrains-server/src/routes/auth.rs`
**Effort:** L (1-2 weeks)

Labels: P0-critical, area:security · Milestone: M3 — Weeks 5-8: Hardening & onboarding
