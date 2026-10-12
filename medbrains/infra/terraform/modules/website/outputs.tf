output "website_bucket" {
  description = "S3 origin bucket — feed to deploy.sh WEBSITE_BUCKET."
  value       = aws_s3_bucket.site.id
}

output "website_distribution_id" {
  description = "CloudFront distribution — feed to deploy.sh WEBSITE_DISTRIBUTION_ID."
  value       = aws_cloudfront_distribution.site.id
}

# Records in two maps with keys known at plan time, so the caller can publish the
# certificate's validation records before CloudFront exists (it needs the
# issued certificate) and the site records after. Wire them to whichever DNS
# provider owns the zone, and pass the validation records' names back as
# `validation_record_fqdns`.
#
# NOTE: apex -> CloudFront needs CNAME flattening (Cloudflare does it unproxied too)
# or a Route53 ALIAS. Records are DNS-only: proxying CloudFront through
# Cloudflare loops on redirects unless the zone's SSL mode is Full (strict).
output "validation_records" {
  description = "ACM validation CNAMEs, keyed by the domain they validate."
  value = {
    for o in aws_acm_certificate.site.domain_validation_options : o.domain_name => {
      name  = trimsuffix(o.resource_record_name, ".")
      type  = o.resource_record_type
      value = trimsuffix(o.resource_record_value, ".")
    }
  }
}

output "site_records" {
  description = "The domain (and www, if included) pointing at CloudFront, keyed apex/www."
  value = merge(
    { apex = { name = var.domain, type = "CNAME", value = aws_cloudfront_distribution.site.domain_name } },
    var.include_www ? { www = { name = "www.${var.domain}", type = "CNAME", value = aws_cloudfront_distribution.site.domain_name } } : {},
  )
}
