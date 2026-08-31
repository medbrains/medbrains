# Coalesced outputs — every tier returns the same surface so the
# env doesn't need to know which sub-module is active.

output "tier" {
  description = "The active tier."
  value       = var.tier
}

output "cost_guard" {
  description = "Human-readable cost profile enforced by this package."
  value       = local.cost_guard
}

output "public_endpoint" {
  description = "Public IP (Starter / Attach / Enterprise-k3s), ALB DNS (Growth), or EKS ingress hostname (Enterprise)."
  value = try(
    module.starter[0].public_ip,
    module.attach[0].public_ip,
    module.growth[0].public_endpoint,
    module.enterprise_k3s[0].public_ip,
    module.enterprise[0].public_endpoint,
    "pending",
  )
}

output "ssh_endpoint" {
  description = "user@host string for SSH-capable single-host tiers. Empty for image-based tiers."
  value = try(
    module.starter[0].ssh_endpoint,
    module.attach[0].ssh_endpoint,
    module.enterprise_k3s[0].ssh_endpoint,
    "",
  )
}

output "health_url" {
  description = "Probe URL for /api/health."
  value       = "https://${var.domain}/api/health"
}

output "domain" {
  description = "Public domain bound to the deployment."
  value       = var.domain
}

output "db_endpoint" {
  description = "Database endpoint. Empty string for Starter (postgres lives in docker on the EC2 host)."
  value = try(
    module.growth[0].db_endpoint,
    module.enterprise_k3s[0].db_endpoint,
    module.enterprise[0].db_endpoint,
    "",
  )
}

output "object_store_bucket" {
  description = "S3 bucket name backing the object-storage tier (empty for Starter)."
  value = try(
    module.growth[0].bucket_name,
    module.enterprise_k3s[0].bucket_name,
    module.enterprise[0].bucket_name,
    "",
  )
}

output "backup_bucket" {
  description = "S3 bucket holding daily pg dumps with 5y Object Lock (Starter tier only — Growth/Enterprise rely on RDS automated backups)."
  value       = try(module.starter[0].backup_bucket, "")
}

output "kms_key_arns" {
  description = "Hospital-scoped KMS CMKs by purpose: app, db, audit, secrets."
  value       = local.kms_key_arns
}

output "uploads_bucket" {
  description = "S3 bucket name for patient document uploads (PHI). Set S3_BUCKET env var on the app server to this value."
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "ARN of the patient-uploads S3 bucket."
  value       = aws_s3_bucket.uploads.arn
}
