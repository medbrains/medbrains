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

resource "aws_eks_cluster" "this" {
  name     = "${var.hostname}-eks"
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version

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

  depends_on = [aws_iam_role_policy_attachment.cluster_policy]
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
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

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

resource "aws_db_instance" "this" {
  identifier        = "${var.hostname}-pg"
  engine            = "postgres"
  engine_version    = "17.2"
  instance_class    = "db.t4g.small"
  allocated_storage = 50
  # Storage-full puts Postgres read-only: writes fail, reads succeed, so
  # the screen stays alive while nothing is being recorded. Autoscaling
  # removes the failure mode; the alarm below only reports the ceiling.
  max_allocated_storage     = 200
  storage_type              = "gp3"
  storage_encrypted         = true
  kms_key_id                = local.db_kms_key_arn
  db_name                   = "medbrains"
  username                  = "medbrains_admin"
  password                  = random_password.db.result
  multi_az                  = var.multi_az
  publicly_accessible       = false
  db_subnet_group_name      = aws_db_subnet_group.this.name
  vpc_security_group_ids    = [aws_security_group.db.id]
  backup_retention_period   = 14
  final_snapshot_identifier = "${var.hostname}-pg-final-snapshot"
  skip_final_snapshot       = !var.deletion_protection
  deletion_protection       = var.deletion_protection

  tags = local.tags
}

# ── S3 with lifecycle to Glacier ─────────────────────────────────────

resource "aws_s3_bucket" "this" {
  bucket = "${var.hostname}-mrd"
  tags   = local.tags
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
  }
}

# ── Tags ──────────────────────────────────────────────────────────────

locals {
  app_kms_key_arn     = lookup(var.kms_key_arns, "app", null)
  db_kms_key_arn      = lookup(var.kms_key_arns, "db", null)
  secrets_kms_key_arn = lookup(var.kms_key_arns, "secrets", null)

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
