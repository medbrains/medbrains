# medbrains.in — the company's own domain (not a hospital's).
#
#   www.medbrains.in    the marketing site (website/), S3 + CloudFront
#   medbrains.in        redirects to www (Caddy on the prod host — GoDaddy
#                       DNS cannot point a bare domain at CloudFront)
#   app.medbrains.in    the hospital app, on the prod host (app.tf)
#   noreply@            product mail via Amazon SES (mail.tf)
#
# DNS is GoDaddy's (the registrar). The operator applies — see README.md.

terraform {
  required_version = ">= 1.7"
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

provider "aws" {
  region = var.company_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Reads GODADDY_API_KEY / GODADDY_API_SECRET from the environment.
provider "godaddy-dns" {}

locals {
  site = "www.${var.company_domain}"
}

module "website" {
  source                  = "../../modules/website"
  providers               = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  domain                  = local.site
  include_www             = false
  environment             = "prod"
  region                  = var.company_region
  validation_record_fqdns = [for r in godaddy-dns_record.cert_validation : "${r.name}.${var.company_domain}"]
}

# Published before CloudFront: it needs the issued certificate.
resource "godaddy-dns_record" "cert_validation" {
  for_each = toset([local.site])
  domain   = var.company_domain
  type     = "CNAME"
  name     = trimsuffix(module.website.validation_records[each.key].name, ".${var.company_domain}")
  data     = module.website.validation_records[each.key].value
  ttl      = 600
}

resource "godaddy-dns_record" "www" {
  domain = var.company_domain
  type   = "CNAME"
  name   = "www"
  data   = module.website.site_records["apex"].value
  ttl    = 600
}
