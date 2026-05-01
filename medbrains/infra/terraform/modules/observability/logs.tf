# Loki + Promtail for in-cluster logs, plus a CloudWatch Logs →
# Firehose → S3 audit trail for HIPAA-class long-term retention.

# ── Loki + Promtail ───────────────────────────────────────────────────

resource "helm_release" "loki" {
  name             = "loki"
  repository       = "https://grafana.github.io/helm-charts"
  chart            = "loki"
  namespace        = var.namespace
  create_namespace = false
  atomic           = true
  timeout          = 600

  values = [yamlencode({
    deploymentMode = "SingleBinary"
    loki = {
      auth_enabled = false
      schemaConfig = {
        configs = [{
          from         = "2024-01-01"
          store        = "tsdb"
          object_store = "filesystem"
          schema       = "v13"
          index = {
            prefix = "loki_index_"
            period = "24h"
          }
        }]
      }
      storage = {
        type = "filesystem"
      }
      commonConfig = {
        replication_factor = 1
      }
    }
    singleBinary = {
      replicas = 1
      persistence = {
        enabled      = true
        storageClass = "gp3"
        size         = "30Gi"
      }
    }
    test         = { enabled = false }
    lokiCanary   = { enabled = false }
    chunksCache  = { enabled = false }
    resultsCache = { enabled = false }
    backend      = { replicas = 0 }
    read         = { replicas = 0 }
    write        = { replicas = 0 }
  })]

  depends_on = [helm_release.kube_prom_stack]
}

resource "helm_release" "promtail" {
  name             = "promtail"
  repository       = "https://grafana.github.io/helm-charts"
  chart            = "promtail"
  namespace        = var.namespace
  create_namespace = false
  atomic           = true

  values = [yamlencode({
    config = {
      clients = [{
        url = "http://loki.${var.namespace}.svc.cluster.local:3100/loki/api/v1/push"
      }]
    }
  })]

  depends_on = [helm_release.loki]
}

# ── CloudWatch → Firehose → S3 audit pipeline ─────────────────────────
# EKS control-plane audit logs (created by the cluster module) and
# application audit logs flow into CloudWatch Logs, then a Firehose
# subscription filter ships them to S3 for long-term retention.

resource "aws_cloudwatch_log_group" "audit" {
  name              = "/medbrains/${var.environment}/audit"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

# IAM role assumed by Firehose to read CloudWatch + write S3 + decrypt KMS.
data "aws_iam_policy_document" "firehose_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["firehose.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "firehose" {
  name               = "${var.cluster_name}-audit-firehose"
  assume_role_policy = data.aws_iam_policy_document.firehose_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "firehose" {
  statement {
    actions = [
      "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:s3:::${var.audit_bucket_name}",
      "arn:${data.aws_partition.current.partition}:s3:::${var.audit_bucket_name}/*",
    ]
  }
  statement {
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
  statement {
    actions   = ["logs:PutLogEvents", "logs:CreateLogStream"]
    resources = ["${aws_cloudwatch_log_group.audit.arn}:*"]
  }
}

resource "aws_iam_role_policy" "firehose" {
  name   = "${var.cluster_name}-audit-firehose"
  role   = aws_iam_role.firehose.id
  policy = data.aws_iam_policy_document.firehose.json
}

resource "aws_kinesis_firehose_delivery_stream" "audit" {
  name        = "${var.cluster_name}-audit"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn            = aws_iam_role.firehose.arn
    bucket_arn          = "arn:${data.aws_partition.current.partition}:s3:::${var.audit_bucket_name}"
    prefix              = "cloudwatch-audit/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "cloudwatch-audit-errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    buffering_size      = 64
    buffering_interval  = 300
    compression_format  = "GZIP"

    kms_key_arn = var.kms_key_arn
  }

  server_side_encryption {
    enabled  = true
    key_type = "CUSTOMER_MANAGED_CMK"
    key_arn  = var.kms_key_arn
  }

  tags = local.tags
}

# CloudWatch trust policy for the subscription destination.
data "aws_iam_policy_document" "logs_to_firehose_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "logs_to_firehose" {
  name               = "${var.cluster_name}-logs-to-firehose"
  assume_role_policy = data.aws_iam_policy_document.logs_to_firehose_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "logs_to_firehose" {
  statement {
    actions   = ["firehose:PutRecord", "firehose:PutRecordBatch"]
    resources = [aws_kinesis_firehose_delivery_stream.audit.arn]
  }
}

resource "aws_iam_role_policy" "logs_to_firehose" {
  name   = "${var.cluster_name}-logs-to-firehose"
  role   = aws_iam_role.logs_to_firehose.id
  policy = data.aws_iam_policy_document.logs_to_firehose.json
}

resource "aws_cloudwatch_log_subscription_filter" "audit" {
  name            = "${var.cluster_name}-audit-to-s3"
  log_group_name  = aws_cloudwatch_log_group.audit.name
  filter_pattern  = ""
  destination_arn = aws_kinesis_firehose_delivery_stream.audit.arn
  role_arn        = aws_iam_role.logs_to_firehose.arn
}
