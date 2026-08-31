terraform {
  required_version = ">= 1.7"
  # Sub-modules declare their own required_providers. Dropping
  # configuration_aliases here so an env that only uses one provider
  # (e.g. AWS only) doesn't have to declare provider blocks for the
  # ones it doesn't use.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# ── Dispatcher: each sub-module enabled iff its provider_kind matches ──

module "aws_ec2" {
  count  = var.provider_kind == "aws-ec2" ? 1 : 0
  source = "./aws-ec2"

  hostname             = var.hostname
  domain               = var.domain
  admin_email          = var.admin_email
  edge_proxy           = var.edge_proxy
  instance_type        = var.aws_instance_type
  ami                  = var.aws_ami
  ssh_key_name         = var.aws_ssh_key_name
  ssh_user             = var.ssh_user
  ssh_private_key      = var.ssh_private_key
  ssh_private_key_path = var.ssh_private_key_path
  binaries_dir         = var.binaries_dir
  spa_dist_dir         = var.spa_dist_dir
  deploy_kit_dir       = var.deploy_kit_dir
  reset_pgdata         = var.reset_pgdata
  kms_key_arns         = var.kms_key_arns
  uploads_bucket_arn   = var.uploads_bucket_arn
  ssh_allowed_cidrs    = var.ssh_allowed_cidrs
  alarm_email          = var.alarm_email
}

module "aws_fargate" {
  count  = var.provider_kind == "aws-fargate" ? 1 : 0
  source = "./aws-fargate"

  hostname               = var.hostname
  domain                 = var.domain
  admin_email            = var.admin_email
  image_uri              = var.image_uri
  fargate_task_cpu       = var.fargate_task_cpu
  fargate_task_memory    = var.fargate_task_memory
  rds_instance_class     = var.rds_instance_class
  scale_to_zero_at_night = var.scale_to_zero_at_night
  hot_to_cold_days       = var.hot_to_cold_days
  kms_key_arns           = var.kms_key_arns
  alarm_email            = var.alarm_email
}

module "aws_k3s" {
  count  = var.provider_kind == "aws-k3s" ? 1 : 0
  source = "./aws-k3s"

  hostname           = var.hostname
  domain             = var.domain
  admin_email        = var.admin_email
  instance_type      = var.aws_instance_type
  ami                = var.aws_ami
  ssh_key_name       = var.aws_ssh_key_name
  ssh_user           = var.ssh_user
  ssh_private_key    = var.ssh_private_key
  image_uri          = var.image_uri
  rds_instance_class = var.rds_instance_class
  hot_to_cold_days   = var.hot_to_cold_days
  helm_chart_dir     = var.helm_chart_dir
  ghcr_pull_token    = var.ghcr_pull_token
  github_username    = var.github_username
  kms_key_arns       = var.kms_key_arns
  alarm_email        = var.alarm_email
}

module "aws_eks" {
  count  = var.provider_kind == "aws-eks" ? 1 : 0
  source = "./aws-eks"

  hostname         = var.hostname
  domain           = var.domain
  admin_email      = var.admin_email
  image_uri        = var.image_uri
  hot_to_cold_days = var.hot_to_cold_days
  kms_key_arns     = var.kms_key_arns
  alarm_email      = var.alarm_email
}

module "digitalocean" {
  count  = var.provider_kind == "digitalocean" ? 1 : 0
  source = "./digitalocean"

  hostname        = var.hostname
  domain          = var.domain
  admin_email     = var.admin_email
  edge_proxy      = var.edge_proxy
  region          = var.region
  size            = var.size
  image           = var.image
  ssh_public_keys = var.ssh_public_keys
  ssh_user        = var.ssh_user
  ssh_private_key = var.ssh_private_key
  binaries_dir    = var.binaries_dir
  spa_dist_dir    = var.spa_dist_dir
  deploy_kit_dir  = var.deploy_kit_dir
}

module "existing_host" {
  count  = var.provider_kind == "existing-host" ? 1 : 0
  source = "./existing-host"

  hostname        = var.hostname
  domain          = var.domain
  admin_email     = var.admin_email
  edge_proxy      = var.edge_proxy
  existing_ipv4   = var.existing_ipv4
  ssh_user        = var.ssh_user
  ssh_private_key = var.ssh_private_key
  binaries_dir    = var.binaries_dir
  spa_dist_dir    = var.spa_dist_dir
  deploy_kit_dir  = var.deploy_kit_dir

  attach_mode           = var.attach_mode
  attach_reuse_tls      = var.attach_reuse_tls
  attach_reuse_postgres = var.attach_reuse_postgres
  attach_database_url   = var.attach_database_url
}
