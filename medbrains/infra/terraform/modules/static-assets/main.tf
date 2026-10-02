# Static reference assets (the body-site picker's anatomy model, ~33 MB) —
# private S3 behind CloudFront. Versioned paths (`anatomy/<commit>/…`) are
# immutable, so a new model is a new path and nothing is ever invalidated.
#
# The web app fetches cross-origin, so CORS is limited to the app origins,
# and the server's CSP must name this distribution: set ANATOMY_CDN_ORIGIN to
# the `origin` output. Upload with `scripts/sync_anatomy_atlas.py --upload`.
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = "medbrains-${var.environment}-static-assets-${var.region}"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "medbrains-${var.environment}-static-assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "cors" {
  name = "medbrains-${var.environment}-static-assets-cors"
  cors_config {
    access_control_allow_credentials = false
    access_control_allow_headers { items = ["*"] }
    access_control_allow_methods { items = ["GET", "HEAD"] }
    access_control_allow_origins { items = var.allowed_origins }
    access_control_max_age_sec = 86400
    origin_override            = true
  }
}

resource "aws_cloudfront_distribution" "assets" {
  enabled     = true
  price_class = "PriceClass_200" # incl. India edge locations
  comment     = "MedBrains ${var.environment} static assets (anatomy model)"

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "s3-static-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-static-assets"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = false                                  # chunks are already gzip
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # managed CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
}

data "aws_iam_policy_document" "assets" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.assets.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = data.aws_iam_policy_document.assets.json
}
