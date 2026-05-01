# Velero — k8s state backup to S3. Snapshots of cluster resources +
# PV data. Schedule: hourly incrementals, daily fulls retained 30d.
#
# Restic is used for PV data so we don't depend on EBS snapshot timing
# (Aurora is backed up separately via RDS native backups).

resource "aws_s3_bucket" "velero" {
  bucket        = "${var.cluster_name}-velero"
  force_destroy = var.environment != "prod"
  tags          = local.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "velero" {
  bucket = aws_s3_bucket.velero.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "velero" {
  bucket = aws_s3_bucket.velero.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "velero" {
  bucket                  = aws_s3_bucket.velero.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IRSA for Velero
data "aws_iam_policy_document" "velero_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${var.oidc_issuer_host}:sub"
      values   = ["system:serviceaccount:velero:velero"]
    }
  }
}

resource "aws_iam_role" "velero" {
  name               = "${var.cluster_name}-velero"
  assume_role_policy = data.aws_iam_policy_document.velero_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "velero" {
  statement {
    actions = [
      "ec2:DescribeVolumes",
      "ec2:DescribeSnapshots",
      "ec2:CreateTags",
      "ec2:CreateVolume",
      "ec2:CreateSnapshot",
      "ec2:DeleteSnapshot",
    ]
    resources = ["*"]
  }
  statement {
    actions = [
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:PutObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
    ]
    resources = ["${aws_s3_bucket.velero.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.velero.arn]
  }
  statement {
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "velero" {
  name   = "${var.cluster_name}-velero"
  role   = aws_iam_role.velero.id
  policy = data.aws_iam_policy_document.velero.json
}

resource "helm_release" "velero" {
  name             = "velero"
  repository       = "https://vmware-tanzu.github.io/helm-charts"
  chart            = "velero"
  namespace        = "velero"
  create_namespace = true
  atomic           = true
  timeout          = 600

  values = [yamlencode({
    initContainers = [{
      name            = "velero-plugin-for-aws"
      image           = "velero/velero-plugin-for-aws:v1.10.0"
      imagePullPolicy = "IfNotPresent"
      volumeMounts = [{
        mountPath = "/target"
        name      = "plugins"
      }]
    }]
    serviceAccount = {
      server = {
        annotations = {
          "eks.amazonaws.com/role-arn" = aws_iam_role.velero.arn
        }
      }
    }
    configuration = {
      backupStorageLocation = [{
        name     = "default"
        provider = "aws"
        bucket   = aws_s3_bucket.velero.id
        config = {
          region = var.region
        }
      }]
      volumeSnapshotLocation = [{
        name     = "default"
        provider = "aws"
        config = {
          region = var.region
        }
      }]
    }
    schedules = {
      daily-full = {
        schedule = "0 2 * * *" # 02:00 UTC = 07:30 IST
        template = {
          ttl                = "720h" # 30d
          includedNamespaces = ["*"]
          snapshotVolumes    = true
        }
      }
    }
  })]

  depends_on = [
    aws_s3_bucket_server_side_encryption_configuration.velero,
    aws_iam_role_policy.velero,
  ]
}
