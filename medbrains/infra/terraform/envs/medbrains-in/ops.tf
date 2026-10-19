# ── Operations: monitoring + offsite backups for the prod host ──────────
# docs/ops/MONITORING.md and docs/ops/BACKUP-RESTORE.md.
#
# Prod is the attach tier on data.aws_instance.prod (app.tf). That tier
# creates no AWS resources, so it had no alarms, no alert topic and only an
# on-disk dump in /var/backups/medbrains. This file adds them, outside the
# hospital env so applying it never touches the deploy.

variable "company_alarm_email" {
  description = "Address paged by every alarm here. Empty = topics without a subscription."
  type        = string
  default     = ""
}

data "aws_caller_identity" "current" {}

locals {
  prod_name     = "medbrains-prod"
  backup_prefix = "pg-backups"   # nightly pg_dump (medbrains-pg-backup)
  files_prefix  = "file-backups" # /var/lib/medbrains mirror (same script)
  wal_prefix    = "wal-g"        # opt-in WAL archive + base backups
}

variable "company_wal_archiving" {
  description = "Grant the prod host WAL-G access (wal-g/ prefix). Opt-in: BACKUP-RESTORE.md, 'WAL archiving'."
  type        = bool
  default     = false
}

# ── Alerts topic (Mumbai): EC2 alarms + the host's own checks ───────────
# The host publishes here too: medbrains-alert@ (OnFailure of the backup and
# host-check units) reads ALERT_TOPIC_ARN from /etc/medbrains/env.
resource "aws_sns_topic" "prod_alerts" {
  name = "${local.prod_name}-alerts"
}

resource "aws_sns_topic_subscription" "prod_alerts_email" {
  count     = var.company_alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.prod_alerts.arn
  protocol  = "email"
  endpoint  = var.company_alarm_email
}

locals {
  ec2_alarms = {
    # Hypervisor/hardware fault: AWS moves the instance (same id, EBS, IP).
    system-status-failed = {
      metric    = "StatusCheckFailed_System", stat = "Maximum", op = "GreaterThanOrEqualToThreshold"
      threshold = 1, period = 60, periods = 2, missing = "breaching"
      recover   = true
    }
    # OS hang. Notify only: this host is shared, an automatic reboot is the
    # operator's call.
    instance-status-failed = {
      metric    = "StatusCheckFailed_Instance", stat = "Maximum", op = "GreaterThanOrEqualToThreshold"
      threshold = 1, period = 60, periods = 3, missing = "breaching"
      recover   = false
    }
    cpu-high = {
      metric    = "CPUUtilization", stat = "Average", op = "GreaterThanThreshold"
      threshold = 80, period = 300, periods = 3, missing = "missing"
      recover   = false
    }
  }
  # t-family throttles on credit exhaustion long before CPU looks high.
  burstable = startswith(data.aws_instance.prod.instance_type, "t")
}

resource "aws_cloudwatch_metric_alarm" "prod_ec2" {
  for_each            = local.ec2_alarms
  alarm_name          = "${local.prod_name}-${each.key}"
  namespace           = "AWS/EC2"
  metric_name         = each.value.metric
  statistic           = each.value.stat
  comparison_operator = each.value.op
  threshold           = each.value.threshold
  period              = each.value.period
  evaluation_periods  = each.value.periods
  # A stopped/terminated instance publishes no status metric; missing data
  # on a status check is the outage, not an absence of news.
  treat_missing_data = each.value.missing

  dimensions = { InstanceId = data.aws_instance.prod.id }

  alarm_actions = concat(
    each.value.recover ? ["arn:aws:automate:${var.company_region}:ec2:recover"] : [],
    [aws_sns_topic.prod_alerts.arn],
  )
  ok_actions = [aws_sns_topic.prod_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "prod_cpu_credits" {
  count               = local.burstable ? 1 : 0
  alarm_name          = "${local.prod_name}-cpu-credits-low"
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 20
  period              = 300
  evaluation_periods  = 2
  dimensions          = { InstanceId = data.aws_instance.prod.id }
  alarm_actions       = [aws_sns_topic.prod_alerts.arn]
  ok_actions          = [aws_sns_topic.prod_alerts.arn]
}

# ponytail: no disk alarm. AWS/EC2 has no disk metric and the host runs no
# CloudWatch agent; medbrains-host-check (hourly) pages through the topic
# above at <15% free. Add the agent + a disk_used_percent alarm if that is
# ever not enough.

# ── Outside-in uptime (Route53 checkers; alarms live in us-east-1) ──────
module "uptime_app" {
  source    = "../../modules/uptime-route53"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  name          = "${local.prod_name}-app"
  domain        = "app.${var.company_domain}"
  resource_path = "/api/health"
  # 200 + "degraded" means Postgres is unreachable — still an outage.
  search_string = "\"status\":\"ok\""
  alarm_email   = var.company_alarm_email
}

module "uptime_www" {
  source    = "../../modules/uptime-route53"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  name          = "${local.prod_name}-www"
  domain        = local.site
  resource_path = "/"
  alarm_email   = var.company_alarm_email
}

# ── Offsite Postgres backups ────────────────────────────────────────────
# medbrains-pg-backup ships here once BACKUP_BUCKET is set in
# /etc/medbrains/env. The host can write and list, never read or delete:
# a compromised host cannot destroy or exfiltrate past dumps.
resource "aws_kms_key" "prod_backups" {
  description             = "${local.prod_name} Postgres backup encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "prod_backups" {
  name          = "alias/${local.prod_name}-backups"
  target_key_id = aws_kms_key.prod_backups.key_id
}

resource "aws_s3_bucket" "prod_backups" {
  bucket = "${local.prod_name}-pg-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "prod_backups" {
  bucket = aws_s3_bucket.prod_backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "prod_backups" {
  bucket = aws_s3_bucket.prod_backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.prod_backups.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "prod_backups" {
  bucket                  = aws_s3_bucket.prod_backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "prod_backups" {
  bucket = aws_s3_bucket.prod_backups.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.prod_backups.arn, "${aws_s3_bucket.prod_backups.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# Retention per prefix, all under the same SSE-KMS key and versioning.
#   pg-backups/    daily dumps: 30 days Standard, then IA, gone at 90 days.
#   file-backups/  a mirror (`aws s3 sync`, never --delete): current objects
#                  are kept while they exist on the host; an overwritten or
#                  replaced file's old version stays 90 days.
#   wal-g/         WAL + base backups: 35 days. Base backups are at most 7
#                  days apart, so every point in the last ~28 days keeps its
#                  base and its WAL. The host never deletes - WAL-G's own
#                  `delete` would need s3:DeleteObject; lifecycle does it.
resource "aws_s3_bucket_lifecycle_configuration" "prod_backups" {
  bucket = aws_s3_bucket.prod_backups.id
  rule {
    id     = "pg-dumps"
    status = "Enabled"
    filter { prefix = "${local.backup_prefix}/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    expiration { days = 90 }
    noncurrent_version_expiration { noncurrent_days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
  rule {
    id     = "file-mirror"
    status = "Enabled"
    filter { prefix = "${local.files_prefix}/" }
    noncurrent_version_expiration { noncurrent_days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
  rule {
    id     = "wal-g"
    status = "Enabled"
    filter { prefix = "${local.wal_prefix}/" }
    expiration { days = 35 }
    noncurrent_version_expiration { noncurrent_days = 7 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}

resource "aws_iam_policy" "prod_backup_writer" {
  name = "${local.prod_name}-backup-writer"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "WriteDumpsAndFiles"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:AbortMultipartUpload"]
        Resource = [
          "${aws_s3_bucket.prod_backups.arn}/${local.backup_prefix}/*",
          "${aws_s3_bucket.prod_backups.arn}/${local.files_prefix}/*",
        ]
      },
      {
        # host-check lists the dump prefix; `aws s3 sync` lists the mirror.
        Sid      = "ListDumpsAndFiles"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.prod_backups.arn
        Condition = { StringLike = { "s3:prefix" = [
          "${local.backup_prefix}/*",
          "${local.files_prefix}/*",
        ] } }
      },
      {
        Sid      = "EncryptDumps"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Encrypt"]
        Resource = aws_kms_key.prod_backups.arn
      },
      {
        Sid      = "PageOnFailure"
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.prod_alerts.arn
      },
    ]
  })
}

# WAL-G needs read on its own prefix (delta base backups read the previous
# backup's metadata; wal-push checks for an existing segment). The host can
# already read the live database, so this exposes nothing new. Still no delete.
resource "aws_iam_policy" "prod_wal_g" {
  count = var.company_wal_archiving ? 1 : 0
  name  = "${local.prod_name}-wal-g"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WalGObjects"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:AbortMultipartUpload"]
        Resource = "${aws_s3_bucket.prod_backups.arn}/${local.wal_prefix}/*"
      },
      {
        Sid       = "WalGList"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = aws_s3_bucket.prod_backups.arn
        Condition = { StringLike = { "s3:prefix" = ["${local.wal_prefix}/*", local.wal_prefix] } }
      },
      {
        Sid      = "WalGKms"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Encrypt", "kms:Decrypt"]
        Resource = aws_kms_key.prod_backups.arn
      },
    ]
  })
}

# Attached only when the instance already carries a profile. Without one the
# policy still exists; attaching a role to the instance is a prod change the
# operator makes by hand (MONITORING.md).
data "aws_iam_instance_profile" "prod" {
  count = data.aws_instance.prod.iam_instance_profile == "" ? 0 : 1
  name  = data.aws_instance.prod.iam_instance_profile
}

resource "aws_iam_role_policy_attachment" "prod_backup_writer" {
  count      = length(data.aws_iam_instance_profile.prod)
  role       = data.aws_iam_instance_profile.prod[0].role_name
  policy_arn = aws_iam_policy.prod_backup_writer.arn
}

resource "aws_iam_role_policy_attachment" "prod_wal_g" {
  count      = var.company_wal_archiving ? length(data.aws_iam_instance_profile.prod) : 0
  role       = data.aws_iam_instance_profile.prod[0].role_name
  policy_arn = aws_iam_policy.prod_wal_g[0].arn
}

output "prod_ops" {
  description = "Values for /etc/medbrains/env on the prod host (BACKUP_BUCKET, ALERT_TOPIC_ARN)."
  value = {
    BACKUP_BUCKET          = aws_s3_bucket.prod_backups.id
    ALERT_TOPIC_ARN        = aws_sns_topic.prod_alerts.arn
    instance_profile       = data.aws_instance.prod.iam_instance_profile
    backup_policy_attached = length(aws_iam_role_policy_attachment.prod_backup_writer) > 0
    # For /etc/medbrains/wal-g.env when company_wal_archiving = true.
    WALG_S3_PREFIX     = "s3://${aws_s3_bucket.prod_backups.id}/${local.wal_prefix}"
    WALG_S3_SSE_KMS_ID = aws_kms_key.prod_backups.arn
  }
}
