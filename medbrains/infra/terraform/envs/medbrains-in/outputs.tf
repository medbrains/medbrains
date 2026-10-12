output "website_bucket" {
  description = "WEBSITE_BUCKET for website/deploy.sh."
  value       = module.website.website_bucket
}

output "website_distribution_id" {
  description = "WEBSITE_DISTRIBUTION_ID for website/deploy.sh."
  value       = module.website.website_distribution_id
}

output "smtp" {
  description = "How the app sends mail as noreply@ (EMAIL_PROVIDER=smtp)."
  value = {
    host     = "email-smtp.${var.company_region}.amazonaws.com"
    port     = 587
    username = aws_iam_access_key.ses_smtp.id
    from     = "noreply@${var.company_domain}"
  }
}

output "smtp_password" {
  description = "SMTP password for the app's SMTP_PASSWORD — read with `terraform output -raw smtp_password` straight into the server's env; never paste it anywhere."
  value       = aws_iam_access_key.ses_smtp.ses_smtp_password_v4
  sensitive   = true
}
