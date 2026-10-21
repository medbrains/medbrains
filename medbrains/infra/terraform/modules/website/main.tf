# Marketing website (medbrains.com) — static S3 + CloudFront + ACM.
# Same static path as apps/web; NOT an Argo/EKS workload (no container).
# DNS is emitted as `outputs.dns_records` (dns-module shape) so the caller wires
# it through the existing `modules/dns` with whatever provider owns the zone.
#
# Providers: pass the default aws provider + a us-east-1 alias (ACM for CloudFront
# must live in us-east-1):
#   module "website" {
#     source = "../../modules/website"
#     providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }
#     ...
#   }
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.50"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

locals {
  aliases = var.include_www ? [var.domain, "www.${var.domain}"] : [var.domain]
}

# ── Origin bucket (private; only CloudFront reads it via OAC) ──
resource "aws_s3_bucket" "site" {
  bucket = "medbrains-${var.environment}-marketing-${var.region}"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

# ── TLS cert (must be us-east-1 for CloudFront) ──
resource "aws_acm_certificate" "site" {
  provider                  = aws.us_east_1
  domain_name               = var.domain
  subject_alternative_names = var.include_www ? ["www.${var.domain}"] : []
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}

# CloudFront refuses a certificate that is not yet issued: wait for the
# caller to publish `validation_records` and pass their names back in.
resource "aws_acm_certificate_validation" "site" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = var.validation_record_fqdns
}

# ── CloudFront ──
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "medbrains-${var.environment}-marketing"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Pages are published at their clean address (/blog/heat-stroke-first-aid) —
# the sitemap and canonical links say so — but S3 has no directory index, so
# the same address with a trailing slash was a 404. A link shared as
# ".../heat-stroke-first-aid/" now redirects permanently to the clean one.
resource "aws_cloudfront_function" "trailing_slash" {
  name    = "medbrains-${var.environment}-marketing-trailing-slash"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var req = event.request;
      var uri = req.uri;
      if (uri.length > 1 && uri.charAt(uri.length - 1) === "/") {
        var qs = [];
        for (var k in req.querystring) {
          var v = req.querystring[k];
          qs.push(v.multiValue
            ? v.multiValue.map(function (m) { return k + "=" + m.value; }).join("&")
            : k + "=" + v.value);
        }
        var loc = uri.replace(/\/+$/, "") + (qs.length ? "?" + qs.join("&") : "");
        return {
          statusCode: 301,
          statusDescription: "Moved Permanently",
          headers: { location: { value: loc } },
        };
      }
      return req;
    }
  JS
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = local.aliases
  price_class         = "PriceClass_200" # incl. India edge locations

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-marketing"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-marketing"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS managed "CachingOptimized" policy id (static content).
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.trailing_slash.arn
    }
  }

  # SPA-less static site: a missing path should 404, not 200 the index.
  # S3 behind OAC answers a missing key with 403 (no ListBucket), so both
  # mean "not found" here.
  dynamic "custom_error_response" {
    for_each = [403, 404]
    content {
      error_code         = custom_error_response.value
      response_code      = 404
      response_page_path = "/404.html"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
}

# ── Let CloudFront (this distribution only) read the bucket ──
data "aws_iam_policy_document" "site" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}
