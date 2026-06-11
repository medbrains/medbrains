# dev / ap-south-1 — single composite stack stitching the modules.
# RFC-INFRA-2026-002 Phase 4.

terraform {
  backend "s3" {
    bucket         = "medbrains-tf-state-ap-south-1"
    key            = "envs/dev/regions/ap-south-1/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "medbrains-tf-locks"
    encrypt        = true
  }
}

variable "region" {
  type    = string
  default = "ap-south-1"
}
variable "environment" {
  type    = string
  default = "dev"
}

# Tags + provider config from shared/
# (terraform doesn't allow `include` — we symlink or copy at apply time;
# Phase 4.2 follow-up adds a tiny shell wrapper in Makefile.)

# ── Stack composition ─────────────────────────────────────────────────

module "kms" {
  source      = "../../../../modules/kms"
  region      = var.region
  environment = var.environment
}

module "vpc" {
  source      = "../../../../modules/vpc"
  region      = var.region
  environment = var.environment
}

data "aws_caller_identity" "current" {}

module "s3" {
  source               = "../../../../modules/s3"
  region               = var.region
  environment          = var.environment
  kms_key_arns         = module.kms.key_arns
  account_id           = data.aws_caller_identity.current.account_id
  uploads_cors_origins = ["https://medbrains.localhost"]
}

module "iam_uploads" {
  source = "../../../../modules/iam-uploads"

  environment        = var.environment
  uploads_bucket_arn = module.s3.uploads_bucket_arn
  kms_key_arn        = module.kms.key_arns.app
  # EKS uses IRSA — no IAM user needed; instance role attachment also not
  # needed at the eks module level since pods get pod-level IAM.
  # For dev (non-EKS paths), set create_iam_user = true to generate creds.
  create_iam_user        = false
  ec2_instance_role_name = ""
}

module "aurora" {
  source        = "../../../../modules/aurora"
  region        = var.region
  environment   = var.environment
  vpc_id        = module.vpc.vpc_id
  db_subnet_ids = module.vpc.db_subnet_ids
  kms_key_arn   = module.kms.key_arns.db
  min_acu       = 0.5
  max_acu       = 4 # dev — small ceiling
}

module "eks" {
  source             = "../../../../modules/eks"
  region             = var.region
  environment        = var.environment
  cluster_name       = "medbrains-${var.environment}-${var.region}"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  kms_key_arn        = module.kms.key_arns.app
}
