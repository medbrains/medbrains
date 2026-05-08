# Hospital package — buyer-tier router.
#
# Picks one of four AWS shapes based on var.tier and forwards into the
# matching standalone-vm sub-module. Outputs are coalesced via
# try() so callers see one stable interface regardless of tier.

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

locals {
  hostname = "${var.hospital_id}-hims"

  is_single_host    = contains(["test", "demo", "starter"], var.tier)
  is_starter        = local.is_single_host
  is_growth         = var.tier == "growth"
  is_enterprise     = var.tier == "enterprise"
  is_enterprise_k3s = var.tier == "enterprise-k3s"

  package_defaults = {
    test = {
      instance_type = "t4g.small"
      cost_guard    = "single-host-test"
    }
    demo = {
      instance_type = "t4g.medium"
      cost_guard    = "single-host-demo"
    }
    starter = {
      instance_type = "t4g.medium"
      cost_guard    = "single-host-starter"
    }
    growth = {
      instance_type = "unused"
      cost_guard    = "fargate-rds-growth"
    }
    enterprise-k3s = {
      instance_type = "t4g.medium"
      cost_guard    = "k3s-rds-enterprise"
    }
    enterprise = {
      instance_type = "unused"
      cost_guard    = "eks-aurora-enterprise"
    }
  }

  single_host_instance_type = (
    var.aws_instance_type != "" ? var.aws_instance_type : local.package_defaults[var.tier].instance_type
  )
  enterprise_k3s_instance_type = (
    var.aws_instance_type != "" ? var.aws_instance_type : local.package_defaults["enterprise-k3s"].instance_type
  )
  cost_guard = try(local.package_defaults[var.tier].cost_guard, var.tier)

  # Starter (aws-ec2) uses only `app` (EBS, S3 SSE) and `audit` (backup
  # bucket SSE). `db` and `secrets` are wired only by Fargate/EKS/k3s
  # tiers — Starter runs dockerized Postgres on the EBS vol and has no
  # Secrets Manager usage. Skip them to avoid idle CMK charges.
  kms_purposes_all = {
    app     = "Application and object-storage data"
    db      = "PostgreSQL storage and performance data"
    audit   = "Audit logs, backup archives, and operational logs"
    secrets = "Secrets Manager and Kubernetes secret envelope encryption"
  }
  kms_purposes = local.is_starter ? {
    app   = local.kms_purposes_all.app
    audit = local.kms_purposes_all.audit
  } : local.kms_purposes_all

  kms_key_arns = {
    for purpose, key in aws_kms_key.purpose : purpose => key.arn
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_kms_key" "purpose" {
  for_each                = local.kms_purposes
  description             = "MedBrains ${var.hospital_id} ${each.key} CMK - ${each.value}"
  enable_key_rotation     = true
  rotation_period_in_days = 365
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableAccountRootPermissions"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowCloudWatchLogsUse"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" }
        Action = [
          "kms:Decrypt*",
          "kms:Describe*",
          "kms:Encrypt*",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*",
        ]
        Resource = "*"
      },
    ]
  })

  tags = {
    Name       = "medbrains-${var.hospital_id}-${each.key}"
    Project    = "medbrains"
    HospitalId = var.hospital_id
    Tier       = var.tier
    CostGuard  = local.cost_guard
    Purpose    = each.key
    ManagedBy  = "terraform"
  }
}

resource "aws_kms_alias" "purpose" {
  for_each      = aws_kms_key.purpose
  name          = "alias/medbrains-${var.hospital_id}-${each.key}"
  target_key_id = each.value.key_id
}

# ── Starter (EC2 + docker postgres + LocalFs) — shipped, production ──

module "starter" {
  count  = local.is_starter ? 1 : 0
  source = "../standalone-vm"

  provider_kind = "aws-ec2"

  hostname             = local.hostname
  domain               = var.domain
  admin_email          = var.admin_email
  edge_proxy           = var.edge_proxy
  ssh_user             = "ubuntu"
  ssh_private_key      = file(var.ssh_private_key_path)
  ssh_private_key_path = var.ssh_private_key_path

  aws_instance_type = local.single_host_instance_type
  aws_ssh_key_name  = var.aws_ssh_key_name

  binaries_dir   = var.binaries_dir
  spa_dist_dir   = var.spa_dist_dir
  deploy_kit_dir = var.deploy_kit_dir
  reset_pgdata   = var.reset_pgdata
  kms_key_arns   = local.kms_key_arns
}

# ── Growth (Fargate + RDS + S3) — Phase 1 scaffold ────────────────────

module "growth" {
  count  = local.is_growth ? 1 : 0
  source = "../standalone-vm"

  provider_kind = "aws-fargate"

  hostname    = local.hostname
  domain      = var.domain
  admin_email = var.admin_email

  image_uri              = var.image_uri
  fargate_task_cpu       = var.fargate_task_cpu
  fargate_task_memory    = var.fargate_task_memory
  rds_instance_class     = var.rds_instance_class
  scale_to_zero_at_night = var.scale_to_zero_at_night
  hot_to_cold_days       = var.hot_to_cold_days
  kms_key_arns           = local.kms_key_arns
}

# ── Enterprise-k3s (EC2 + k3s + RDS + S3 Glacier) — Phase 1 scaffold ─

module "enterprise_k3s" {
  count  = local.is_enterprise_k3s ? 1 : 0
  source = "../standalone-vm"

  provider_kind = "aws-k3s"

  hostname        = local.hostname
  domain          = var.domain
  admin_email     = var.admin_email
  ssh_user        = "ubuntu"
  ssh_private_key = file(var.ssh_private_key_path)

  aws_instance_type  = local.enterprise_k3s_instance_type
  aws_ssh_key_name   = var.aws_ssh_key_name
  image_uri          = var.image_uri
  rds_instance_class = var.rds_instance_class
  hot_to_cold_days   = var.hot_to_cold_days
  helm_chart_dir     = var.helm_chart_dir
  ghcr_pull_token    = var.ghcr_pull_token
  github_username    = var.github_username
  kms_key_arns       = local.kms_key_arns
}

# ── Enterprise (EKS + Aurora + S3 Glacier) — Phase 1 scaffold ────────

module "enterprise" {
  count  = local.is_enterprise ? 1 : 0
  source = "../standalone-vm"

  provider_kind = "aws-eks"

  hostname    = local.hostname
  domain      = var.domain
  admin_email = var.admin_email

  image_uri        = var.image_uri
  hot_to_cold_days = var.hot_to_cold_days
  kms_key_arns     = local.kms_key_arns
}
