# S3 module — 4 buckets per region:
#   - medbrains-audit-archive-<region>   (Object Lock COMPLIANCE 7y)
#   - medbrains-static-<region>          (CloudFront origin)
#   - medbrains-uploads-<region>         (KMS, Glacier after 90d)
#   - medbrains-tf-state-<region>        (managed by bootstrap module)
# Phase 4.6 deliverable.

variable "region"      { type = string }
variable "environment" { type = string }
variable "kms_key_arns" {
  type = object({
    app     = string
    db      = string
    audit   = string
    secrets = string
  })
}

# TODO Phase 4.6:
# - aws_s3_bucket × 3 with versioning + KMS SSE
# - aws_s3_bucket_object_lock_configuration on audit (compliance 7y)
# - aws_s3_bucket_lifecycle_configuration for uploads (Glacier 90d)
# - aws_s3_bucket_public_access_block on all
# - aws_s3_bucket_replication_configuration for cross-region replication
#   on audit + uploads (Phase 6)

output "audit_archive_bucket" { value = "TODO" }
output "static_bucket"        { value = "TODO" }
output "uploads_bucket"       { value = "TODO" }
