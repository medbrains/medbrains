# Epic: Infrastructure reliability

Single-EC2 deployment has no alarms, no auto-recovery, data-loss-on-termination, local TF state, and no rollback path. Make the Starter tier survivable and observable. Audit refs: P0 #12-#15, P1 Infra.

_Source: ENTERPRISE_READINESS_AUDIT.md (2026-06-11)._

Priority: P0-critical · Area: area:infra · Milestone: M1 — Week 1: Critical security & infra

## Add CloudWatch alarms and EC2 auto-recovery

> As a **devops engineer**, I want StatusCheckFailed auto-recovery plus CPU>80%, disk>80%, and 5xx alarms with notifications, so that instance death or disk-full is acted on instead of discovered by the hospital.

**Acceptance criteria**
- [ ] Terraform-managed alarms + SNS topic
- [ ] Starter-tier limits documented (single AZ, no LB)

**Audit ref:** P0 #12, #14 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `infra/terraform/modules/standalone-vm/aws-ec2/main.tf`
**Effort:** M (1-3 days)

Labels: P0-critical, area:infra · Milestone: M1 — Week 1: Critical security & infra

## Keep EBS on termination and split data volume

> As a **devops engineer**, I want root volume delete_on_termination=false and a separate persistent data volume for Postgres, so that terminating the instance cannot destroy hospital data.

**Acceptance criteria**
- [ ] Flags set in terraform; data volume mounted for docker Postgres
- [ ] Recreate-instance drill keeps data

**Audit ref:** P0 #13 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `infra/terraform/modules/standalone-vm/aws-ec2/main.tf:150-161`
**Effort:** S (<1 day)

Labels: P0-critical, area:infra · Milestone: M1 — Week 1: Critical security & infra

## Move standalone terraform state to S3 with locking

> As a **devops engineer**, I want S3 backend + DynamoDB lock for standalone/alagappa state, so that state is encrypted, shared, and protected from concurrent applies.

**Acceptance criteria**
- [ ] Backend block + migration of existing state
- [ ] Documented in infra README

**Audit ref:** P0 #15 (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `infra/terraform/envs/standalone/alagappa/main.tf:25-27`
**Effort:** S (<1 day)

Labels: P0-critical, area:infra · Milestone: M1 — Week 1: Critical security & infra

## Add deploy rollback and pre-deploy backup gate

> As a **devops engineer**, I want ship-cold to snapshot the previous binary + take a DB backup before swap, with one-command rollback, so that a failed deploy can be reverted instead of leaving the hospital down.

**Acceptance criteria**
- [ ] Previous binary retained; rollback make target
- [ ] Pre-deploy pg backup gate; migration stage separated from app startup

**Audit ref:** P1 Infra (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `Makefile:544-551`, `deploy.sh`
**Effort:** M (1-3 days)

Labels: P1-high, area:infra · Milestone: M3 — Weeks 5-8: Hardening & onboarding

## Add log rotation and uptime synthetics

> As a **devops engineer**, I want bounded journald/log storage and an external health-check on /api/health, so that disks don't silently fill and downtime is detected within minutes.

**Acceptance criteria**
- [ ] journald SystemMaxUse + StartLimitBurst on service unit
- [ ] Synthetic monitor (Route53 health check or equivalent) with alert

**Audit ref:** P1 Infra (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `infra (systemd unit, terraform)`
**Effort:** S (<1 day)

Labels: P1-high, area:infra · Milestone: M2 — Weeks 2-4: Reliability & revenue

## Run a backup restore drill and write the runbook

> As a **devops engineer**, I want a verified pg restore path from the S3 backups, documented as an incident runbook, so that backups are known-good before we need them.

**Acceptance criteria**
- [ ] Restore to clean instance succeeds; RTO/RPO recorded
- [ ] Runbook in docs/sops; backup-bucket IAM tightened

**Audit ref:** P1 Infra (ENTERPRISE_READINESS_AUDIT.md)
**Files:** `docs/sops/`
**Effort:** M (1-3 days)

Labels: P1-high, area:infra · Milestone: M2 — Weeks 2-4: Reliability & revenue
