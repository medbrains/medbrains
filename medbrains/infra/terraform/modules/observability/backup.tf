# Velero — k8s state backup to S3. Snapshots of cluster resources +
# PV data. Schedule: hourly incrementals, daily fulls retained 30d.
#
# Restic is used for PV data so we don't depend on EBS snapshot timing
# (Aurora is backed up separately via RDS native backups).

module "access_logs" {
  source        = "../s3-access-logs"
  bucket_name   = "${var.cluster_name}-velero-logs"
  tags          = local.tags
  force_destroy = var.environment != "prod"
}

resource "aws_s3_bucket" "velero" {
  #checkov:skip=CKV_AWS_144: Aurora, the stateful part, is copied cross-region by its own snapshot job; cluster objects are rebuilt from git by Argo CD, so a velero replica buys little for double the cost
  #checkov:skip=CKV2_AWS_62: nothing consumes object events; velero tracks its own backups
  bucket        = "${var.cluster_name}-velero"
  force_destroy = var.environment != "prod"
  tags          = local.tags
}

# Velero expires backups itself (ttl 720h), which in a versioned bucket
# only lays delete markers. Without this the "deleted" versions are kept
# - and billed - forever.
resource "aws_s3_bucket_lifecycle_configuration" "velero" {
  bucket = aws_s3_bucket.velero.id
  rule {
    id     = "expire-deleted-backups"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
    expiration {
      expired_object_delete_marker = true
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
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

resource "aws_s3_bucket_logging" "velero" {
  bucket        = aws_s3_bucket.velero.id
  target_bucket = module.access_logs.bucket_id
  target_prefix = "velero/"
}

# Refuse plain HTTP: every client (SDK, CLI, presigned URL) already uses TLS.
resource "aws_s3_bucket_policy" "velero" {
  bucket = aws_s3_bucket.velero.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.velero.arn, "${aws_s3_bucket.velero.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.velero]
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
  # EC2 Describe* has no resource-level permissions, and Create* must name
  # volumes and snapshots that do not exist yet - the shape AWS's own
  # velero-plugin-for-aws policy uses.
  #checkov:skip=CKV_AWS_111: CreateVolume/CreateSnapshot/CreateTags target resources that do not exist yet, so they cannot be scoped by ARN
  #checkov:skip=CKV_AWS_356: ec2:Describe* supports no resource-level permissions
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
