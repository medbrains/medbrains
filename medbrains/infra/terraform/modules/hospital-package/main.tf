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

  is_starter        = var.tier == "starter"
  is_growth         = var.tier == "growth"
  is_enterprise     = var.tier == "enterprise"
  is_enterprise_k3s = var.tier == "enterprise-k3s"
}

# ── Starter (EC2 + docker postgres + LocalFs) — shipped, production ──

module "starter" {
  count  = local.is_starter ? 1 : 0
  source = "../standalone-vm"

  provider_kind = "aws-ec2"

  hostname        = local.hostname
  domain          = var.domain
  admin_email     = var.admin_email
  ssh_user        = "ubuntu"
  ssh_private_key = file(var.ssh_private_key_path)

  aws_instance_type = var.aws_instance_type
  aws_ssh_key_name  = var.aws_ssh_key_name

  binaries_dir   = var.binaries_dir
  spa_dist_dir   = var.spa_dist_dir
  deploy_kit_dir = var.deploy_kit_dir
  reset_pgdata   = var.reset_pgdata
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

  aws_instance_type  = var.aws_instance_type
  aws_ssh_key_name   = var.aws_ssh_key_name
  image_uri          = var.image_uri
  rds_instance_class = var.rds_instance_class
  hot_to_cold_days   = var.hot_to_cold_days
  helm_chart_dir     = var.helm_chart_dir
  ghcr_pull_token    = var.ghcr_pull_token
  github_username    = var.github_username
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
}
