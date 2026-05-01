# Single-source standalone deploy on AWS via the hospital-package
# buyer-tier router.
#
# Reads everything from `medbrains/infra/.env`. The `make apply`
# target in this directory sources that file, then runs terraform
# with the matching TF_VAR_* / provider env vars set. No manual
# exports, no -var flags, no second config file.
#
# Required keys in medbrains/infra/.env:
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_REGION                  (default ap-south-1)
#   GODADDY_API_KEY
#   GODADDY_API_SECRET
#   TF_VAR_tier                 (starter | growth | enterprise | enterprise-k3s)
#   TF_VAR_aws_ssh_key_name     (existing EC2 keypair name, Starter / k3s only)
#   TF_VAR_ssh_private_key_path (default ~/.ssh/id_ed25519, Starter / k3s only)
#   TF_VAR_admin_email
#   TF_VAR_binaries_dir / spa_dist_dir / deploy_kit_dir   (Starter only)

terraform {
  required_version = ">= 1.7"

  backend "local" {
    path = "./terraform.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    godaddy-dns = {
      source  = "veksh/godaddy-dns"
      version = "~> 0.3"
    }
  }
}

# Both providers read credentials from env vars set by `make apply`.
provider "aws" {}
provider "godaddy-dns" {}

module "hospital" {
  source = "../../../modules/hospital-package"

  tier        = var.tier
  hospital_id = "alagappa"
  domain      = var.domain
  zone_name   = var.zone_name
  admin_email = var.admin_email

  aws_ssh_key_name     = var.aws_ssh_key_name
  ssh_private_key_path = var.ssh_private_key_path
  aws_instance_type    = var.aws_instance_type

  binaries_dir   = var.binaries_dir
  spa_dist_dir   = var.spa_dist_dir
  deploy_kit_dir = var.deploy_kit_dir

  image_uri       = var.image_uri
  helm_chart_dir  = var.helm_chart_dir
  ghcr_pull_token = var.ghcr_pull_token
  github_username = var.github_username
  reset_pgdata    = var.reset_pgdata
}

# DNS — single GoDaddy A record. Skipped for tiers whose endpoint is
# a hostname (Fargate ALB, EKS) — those need a CNAME, which the env
# can wire up in a follow-up once the tier ships.
resource "godaddy-dns_record" "hims" {
  count = var.tier == "starter" || var.tier == "enterprise-k3s" ? 1 : 0

  domain = var.zone_name
  type   = "A"
  name   = trimsuffix(replace(var.domain, ".${var.zone_name}", ""), ".")
  data   = module.hospital.public_endpoint
  ttl    = 600
}

output "tier" {
  value = module.hospital.tier
}

output "public_endpoint" {
  value = module.hospital.public_endpoint
}

output "domain" {
  value = var.domain
}

output "health_url" {
  value = module.hospital.health_url
}

output "db_endpoint" {
  value = module.hospital.db_endpoint
}

output "object_store_bucket" {
  value = module.hospital.object_store_bucket
}

output "backup_bucket" {
  value       = module.hospital.backup_bucket
  description = "S3 bucket holding daily pg dumps + 5y Object Lock retention. Used by `make pre-apply-backup`."
}
