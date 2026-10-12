# Monitoring — production (app.medbrains.in, www.medbrains.in)

Last reviewed 2026-10-12. Code: `infra/terraform/envs/medbrains-in/ops.tf`, module `modules/uptime-route53`.
Validated with `terraform fmt` + `terraform validate` (`init -backend=false`) only. **Not applied.**

## Why it lives in envs/medbrains-in

Prod is the attach tier (`TF_VAR_tier=attach`): the hospital-package router creates no AWS resources for it, so the
EC2 alarms in `modules/standalone-vm/aws-ec2/alarms.tf` never existed for prod. `envs/medbrains-in` already reads the
prod instance (`data.aws_instance.prod`, `app.tf`), and applying it does not touch the hospital deploy.

## What it creates

| Signal | Mechanism | Fires when | Goes to |
|---|---|---|---|
| App up **and DB connected** | Route53 HTTPS_STR_MATCH on `https://app.medbrains.in/api/health`, body must contain `"status":"ok"`, 30 s interval, 3 failures | 3 min of failures (alarm `medbrains-prod-app-endpoint-down`, us-east-1) | SNS `medbrains-prod-app-uptime-alerts` (us-east-1) |
| Website up | Route53 HTTPS on `https://www.medbrains.in/` | same | SNS `medbrains-prod-www-uptime-alerts` (us-east-1) |
| Hardware/hypervisor fault | `StatusCheckFailed_System` ≥ 1 for 2 min, missing = breaching | instance unreachable at the AWS layer | **EC2 auto-recover** + SNS `medbrains-prod-alerts` (Mumbai) |
| OS hang | `StatusCheckFailed_Instance` ≥ 1 for 3 min, missing = breaching | kernel/OS unresponsive | SNS only (reboot is the operator's call on a shared host) |
| CPU saturation | `CPUUtilization` > 80 % avg, 3 × 5 min | sustained load | SNS `medbrains-prod-alerts` |
| Credit exhaustion | `CPUCreditBalance` < 20, 2 × 5 min (only if the instance is t-family — prod is `t4g.medium`) | burst credits nearly gone | SNS `medbrains-prod-alerts` |
| Disk < 15 % free, cert < 14 d, no backup in 26 h | `medbrains-host-check.timer` (hourly, on the host) → `medbrains-alert@` | as stated | SNS `medbrains-prod-alerts` **once `ALERT_TOPIC_ARN` is set on the host** |
| WAL archiving failing (opt-in) | `medbrains-host-check`: `pg_stat_archiver.last_failed_time` newer than `last_archived_time` | first failure | SNS `medbrains-prod-alerts` |
| Nightly dump failed | `OnFailure=medbrains-alert@` on `medbrains-pg-backup.service` | pg_dump/upload error | same |
| SES bounce/complaint/reject | SES configuration set → SNS `medbrains-in-ses-feedback` | per event | email (see `SES-PRODUCTION-ACCESS.md`) |

The health route is `GET /api/health` (`crates/medbrains-server/src/routes/health.rs`, registered in
`routes/mod.rs`). It returns **HTTP 200 even when Postgres is down** (`"status":"degraded"`), so a status-code check
alone would stay green through a database outage — hence the string match. The module change is opt-in
(`search_string`, default empty), so other callers keep their behaviour.

**No CloudWatch disk alarm**: AWS/EC2 publishes no disk metric and the host runs no CloudWatch agent. Disk is covered by
the host check above. If you want it in CloudWatch, install the agent and add a `disk_used_percent` alarm.

Cost: 2 Route53 checks (HTTPS, one string-match) ≈ $3/month; 4-5 alarms ≈ $0.50/month; SNS email free; KMS key
$1/month; S3 backups pennies at this size.

## Apply (operator)

```sh
cd medbrains/infra/terraform/envs/medbrains-in
( set -a; source ../../../.env; set +a            # AWS + GoDaddy credentials, never echoed
  terraform init                                   # new module references → init is required
  terraform plan -var 'company_alarm_email=ops@medbrains.in' -out ops.tfplan
  terraform apply ops.tfplan )
```

- The `plan.tfplan` already in this directory predates this change — do not apply it.
- Review the plan: expected adds are the SNS topics/subscriptions, 4-5 CloudWatch alarms, 2 Route53 checks + their
  us-east-1 alarms, the KMS key/alias, the backup bucket + its 5 configuration resources, the IAM policy (+ attachment if
  the instance has a profile), the SES suppression attributes, configuration set, feedback topic + policy + event
  destination; one **in-place update** to `aws_sesv2_email_identity.domain` (default configuration set). Anything else
  in the plan is pre-existing drift — stop and look.
- Confirm **four** subscription emails (prod-alerts, app-uptime, www-uptime, ses-feedback) or nothing is delivered.
- Then the host steps in `BACKUP-RESTORE.md` → "The fix, as code": set `ALERT_TOPIC_ARN` and `BACKUP_BUCKET` in
  `/etc/medbrains/env`. Until `ALERT_TOPIC_ARN` is set, every host-side alert is silent.

Test after apply: `aws cloudwatch set-alarm-state --region us-east-1 --alarm-name medbrains-prod-app-endpoint-down
--state-value ALARM --state-reason test` (and the same in ap-south-1 for `medbrains-prod-cpu-high`) — an email must
arrive; the alarm returns to OK on the next evaluation.

## Not covered

- The old name `medbrains.amh.org.in` was probed by `envs/clients/alagappa` `module "uptime"`; behind the host move's
  301 it would stay green with the app down. That module and its us-east-1 provider are **removed** (the next apply of
  that env destroys the check, its alarm and topic); `module.uptime_app` here is the one probe.
- No application metrics/APM or log shipping for prod (the `observability` module targets other tiers).
- No on-call rota or escalation beyond email.
