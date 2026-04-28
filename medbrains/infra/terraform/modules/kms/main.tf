# KMS module — 4 CMKs per region: app, db, audit, secrets.
# Phase 4.5 deliverable.

variable "region"      { type = string }
variable "environment" { type = string }

locals {
  key_purposes = ["app", "db", "audit", "secrets"]
}

# TODO Phase 4.5:
# resource "aws_kms_key" "purpose" {
#   for_each            = toset(local.key_purposes)
#   description         = "MedBrains ${each.value} CMK (${var.environment}/${var.region})"
#   enable_key_rotation = true
#   policy              = data.aws_iam_policy_document.kms_purpose[each.value].json
# }
# resource "aws_kms_alias" "purpose" {
#   for_each      = toset(local.key_purposes)
#   name          = "alias/medbrains-${var.environment}-${each.value}"
#   target_key_id = aws_kms_key.purpose[each.value].key_id
# }

output "key_arns" {
  value = {
    app     = "TODO"
    db      = "TODO"
    audit   = "TODO"
    secrets = "TODO"
  }
}
