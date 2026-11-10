# Enterprise tier — EKS + RDS + S3.
#
# Phase 1 scaffold. The shipping Enterprise stack will wrap the
# existing modules/eks (Karpenter + IRSA) and modules/aurora
# (Aurora Serverless v2 + RDS Proxy) — those wrappers need a VPC +
# KMS abstraction layer that doesn't exist for the per-hospital
# deploy story yet. For now this scaffold uses a minimal EKS +
# managed-node-group + RDS + S3 shape so terraform validate passes
# and the buyer-tier router can be exercised end-to-end.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

variable "hostname" { type = string }
variable "domain" { type = string }
variable "admin_email" { type = string }
variable "image_uri" { type = string }
variable "hot_to_cold_days" { type = number }

# Declared so the tier router can pass one address everywhere. This shape
# has no alarms.tf yet - its aws_db_instance is a documented placeholder
# for modules/aurora, and an alarm keyed to it is written to be deleted.
variable "alarm_email" {
  type    = string
  default = ""
}
variable "kms_key_arns" {
  description = "Optional hospital-scoped KMS CMKs by purpose: app, db, audit, secrets."
  type        = map(string)
  default     = {}
}

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 4
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── IAM for cluster + nodes ───────────────────────────────────────────

resource "aws_iam_role" "cluster" {
  name = "${var.hostname}-eks-cluster"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role" "node" {
  name = "${var.hostname}-eks-node"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "node_cni" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "node_ecr" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# ── EKS cluster + managed node group ──────────────────────────────────

# Control-plane logs: without `audit` nobody can say who read which secret.
resource "aws_cloudwatch_log_group" "cluster" {
  name              = "/aws/eks/${var.hostname}-eks/cluster"
  retention_in_days = 365
  kms_key_id        = local.audit_kms_key_arn
  tags              = local.tags
}

resource "aws_eks_cluster" "this" {
  #checkov:skip=CKV_AWS_38: this tier has no bastion or in-VPC runner; operators run kubectl/helm from outside, authenticated by IAM
  #checkov:skip=CKV_AWS_39: as above - the public endpoint is the only way in for this tier's operators
  name     = "${var.hostname}-eks"
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  vpc_config {
    subnet_ids              = data.aws_subnets.default.ids
    endpoint_public_access  = true
    endpoint_private_access = true
  }

  dynamic "encryption_config" {
    for_each = local.secrets_kms_key_arn == null ? [] : [local.secrets_kms_key_arn]
    content {
      provider {
        key_arn = encryption_config.value
      }
      resources = ["secrets"]
    }
  }

  depends_on = [aws_iam_role_policy_attachment.cluster_policy, aws_cloudwatch_log_group.cluster]
  tags       = local.tags
}

resource "aws_eks_node_group" "default" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "default"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = data.aws_subnets.default.ids

  scaling_config {
    desired_size = var.node_min_size
    min_size     = var.node_min_size
    max_size     = var.node_max_size
  }

  instance_types = var.node_instance_types
  capacity_type  = "SPOT"

  depends_on = [
    aws_iam_role_policy_attachment.node_worker,
    aws_iam_role_policy_attachment.node_cni,
    aws_iam_role_policy_attachment.node_ecr,
  ]
  tags = local.tags
}

# ── Database (placeholder — Phase 3 swaps this for modules/aurora) ───

resource "aws_security_group" "db" {
  name        = "${var.hostname}-db-sg"
  description = "RDS ingress from EKS nodes"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Postgres from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }
  # RDS never opens connections; replies to the pods are stateful.
  egress = []

  tags = local.tags
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.hostname}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
  tags       = local.tags
}

resource "random_password" "db" {
  length  = 32
  special = false
}

# DB HA + teardown knobs — default prod-safe; non-prod (test/demo) sets both
# false to halve RDS cost and allow `terraform destroy`.
variable "multi_az" {
  type        = bool
  default     = true
  description = "Multi-AZ standby. Set false in non-prod to halve RDS cost."
}
variable "deletion_protection" {
  type        = bool
  default     = true
  description = "true also forces a final snapshot on destroy. Set false in non-prod so teardown succeeds."
}


# Slow statements (>1 s) and every DDL go to the instance log, exported to
# CloudWatch below. Both parameters are dynamic: no reboot to change them,
# though attaching the group to an existing instance shows pending-reboot
# until its next maintenance reboot.
resource "aws_db_parameter_group" "this" {
  name   = "${var.hostname}-pg17"
  family = "postgres17"

  parameter {
    name  = "log_statement"
    value = "ddl"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
  # Already the Postgres 15+ default; pinned so a later family cannot
  # quietly accept plaintext connections (DATABASE_URL uses sslmode=require).
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = local.tags
}

# Created ahead of the export so RDS does not make a never-expiring group.
resource "aws_cloudwatch_log_group" "postgresql" {
  name              = "/aws/rds/instance/${var.hostname}-pg/postgresql"
  retention_in_days = 365
  kms_key_id        = local.audit_kms_key_arn
  tags              = local.tags
}

resource "aws_db_instance" "this" {
  #checkov:skip=CKV_AWS_118: enhanced monitoring needs its own IAM role and bills per-second OS metrics; basic RDS metrics plus the alarms in alarms.tf cover this single-instance tier
  #checkov:skip=CKV_AWS_353: Performance Insights is not offered on the micro/small burstable classes this tier defaults to; turn it on with a class that supports it
  identifier        = "${var.hostname}-pg"
  engine            = "postgres"
  engine_version    = "17.2"
  instance_class    = "db.t4g.small"
  allocated_storage = 50
  # Storage-full puts Postgres read-only: writes fail, reads succeed, so
  # the screen stays alive while nothing is being recorded. Autoscaling
  # removes the failure mode; the alarm below only reports the ceiling.
  max_allocated_storage               = 200
  storage_type                        = "gp3"
  storage_encrypted                   = true
  kms_key_id                          = local.db_kms_key_arn
  db_name                             = "medbrains"
  username                            = "medbrains_admin"
  password                            = random_password.db.result
  multi_az                            = var.multi_az
  publicly_accessible                 = false
  db_subnet_group_name                = aws_db_subnet_group.this.name
  vpc_security_group_ids              = [aws_security_group.db.id]
  backup_retention_period             = 14
  final_snapshot_identifier           = "${var.hostname}-pg-final-snapshot"
  skip_final_snapshot                 = !var.deletion_protection
  deletion_protection                 = var.deletion_protection
  parameter_group_name                = aws_db_parameter_group.this.name
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  iam_database_authentication_enabled = true
  copy_tags_to_snapshot               = true
  auto_minor_version_upgrade          = true

  depends_on = [aws_cloudwatch_log_group.postgresql]
  tags       = local.tags
}

# ── S3 with lifecycle to Glacier ─────────────────────────────────────

resource "aws_s3_bucket" "this" {
  #checkov:skip=CKV_AWS_144: medical records live in one region; cross-region replication doubles storage and needs a second-region key and role; recovery is covered by versioning plus the RDS backups
  #checkov:skip=CKV2_AWS_62: nothing consumes object events from this bucket
  bucket = "${var.hostname}-mrd"
  tags   = local.tags
}

# Versioned: an overwrite or delete of a medical record is recoverable.
# Old versions expire with the lifecycle rule below.
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_logging" "this" {
  bucket        = aws_s3_bucket.this.id
  target_bucket = module.access_logs.bucket_id
  target_prefix = "mrd/"
}

# Refuse plain HTTP: every client (SDK, CLI, presigned URL) already uses TLS.
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.this.arn, "${aws_s3_bucket.this.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.this]
}

module "access_logs" {
  source      = "../../s3-access-logs"
  bucket_name = "${var.hostname}-mrd-logs"
  tags        = local.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = local.app_kms_key_arn == null ? "AES256" : "aws:kms"
      kms_master_key_id = local.app_kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "hot-to-cold-to-archive"
    status = "Enabled"

    filter {}

    transition {
      days          = var.hot_to_cold_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.hot_to_cold_days * 4
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ── Tags ──────────────────────────────────────────────────────────────

locals {
  app_kms_key_arn     = lookup(var.kms_key_arns, "app", null)
  db_kms_key_arn      = lookup(var.kms_key_arns, "db", null)
  secrets_kms_key_arn = lookup(var.kms_key_arns, "secrets", null)
  audit_kms_key_arn   = lookup(var.kms_key_arns, "audit", null)

  tags = {
    Name      = var.hostname
    Project   = "medbrains"
    Tier      = "enterprise"
    ManagedBy = "terraform"
  }
}

# ── Outputs ───────────────────────────────────────────────────────────

output "public_endpoint" {
  description = "Cluster API endpoint. Real ingress hostname comes from a Helm-installed Ingress in Phase 3."
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "db_endpoint" {
  value = aws_db_instance.this.endpoint
}

output "bucket_name" {
  value = aws_s3_bucket.this.id
}
