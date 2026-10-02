output "bucket" {
  description = "Upload target: s3://<bucket>/anatomy/<commit>."
  value       = aws_s3_bucket.assets.bucket
}

output "origin" {
  description = "https origin for ANATOMY_CDN_ORIGIN (server CSP) and the base of VITE_ANATOMY_BASE_URL."
  value       = "https://${aws_cloudfront_distribution.assets.domain_name}"
}
