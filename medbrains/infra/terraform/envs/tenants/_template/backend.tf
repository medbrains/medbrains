# Tenant state backend.
#
# Per-tenant state lives in cloud S3 with prefix tenants/<tenant_id>/
# encrypted by the tenant's KMS key. Hospital admin gets read-only IAM
# credentials so they can `terraform plan` for diagnostics; cloud
# admin team holds the write credentials needed for `terraform apply`.
#
# AIR-GAPPED VARIANT — for hospitals refusing any internet exit, swap
# to a local backend:
#   terraform { backend "local" { path = "./terraform.tfstate" } }
# and rsync the file to a hospital-side NAS / MinIO. Document this
# choice in the tenant's runbook.

terraform {
  required_version = ">= 1.7"

  backend "s3" {
    # Replace these with the cloud-side bucket created by the bootstrap
    # composition (infra/terraform/envs/cloud/prod/regions/ap-south-1/).
    # Per-tenant key path keeps tenants isolated.
    bucket         = "medbrains-prod-tfstate"
    key            = "tenants/REPLACE_TENANT_ID/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    kms_key_id     = "alias/medbrains-prod-tfstate"
    dynamodb_table = "medbrains-prod-tfstate-locks"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.101"
      configuration_aliases = [proxmox.onprem]
    }
  }
}
