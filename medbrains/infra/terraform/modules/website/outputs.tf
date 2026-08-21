output "website_bucket" {
  description = "S3 origin bucket — feed to deploy.sh WEBSITE_BUCKET."
  value       = aws_s3_bucket.site.id
}

output "website_distribution_id" {
  description = "CloudFront distribution — feed to deploy.sh WEBSITE_DISTRIBUTION_ID."
  value       = aws_cloudfront_distribution.site.id
}

# Records in modules/dns shape. Wire into the existing dns module for the zone:
#   module "website_dns" {
#     source        = "../../modules/dns"
#     provider_kind = "cloudflare"   # or "godaddy" — whoever owns medbrains.com
#     zone_name     = "medbrains.com"
#     records       = module.website.dns_records
#     providers     = { ... }
#   }
# NOTE: apex (medbrains.com) -> CloudFront needs CNAME flattening (Cloudflare, proxied=true)
# or a Route53 ALIAS. GoDaddy DNS can't CNAME the apex — if the zone stays on GoDaddy,
# point `www` here and 301 the apex to www, or move the zone to Cloudflare.
output "dns_records" {
  description = "ACM validation CNAMEs + www/apex records pointing at CloudFront."
  value = concat(
    [for o in aws_acm_certificate.site.domain_validation_options : {
      name     = trimsuffix(o.resource_record_name, ".")
      type     = o.resource_record_type
      value    = trimsuffix(o.resource_record_value, ".")
      ttl      = 300
      priority = null
      proxied  = false
    }],
    [
      {
        name     = "www.${var.domain}"
        type     = "CNAME"
        value    = aws_cloudfront_distribution.site.domain_name
        ttl      = 300
        priority = null
        proxied  = true
      },
      {
        name     = var.domain
        type     = "CNAME"
        value    = aws_cloudfront_distribution.site.domain_name
        ttl      = 300
        priority = null
        proxied  = true
      },
    ]
  )
}
