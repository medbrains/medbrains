variable "domain" {
  description = "Apex domain for the marketing site (e.g. medbrains.com). www is added automatically."
  type        = string
}

variable "environment" {
  description = "Deploy environment (prod, staging) — part of the bucket name."
  type        = string
}

variable "region" {
  description = "AWS region for the origin bucket (e.g. ap-south-1)."
  type        = string
}

variable "validation_record_fqdns" {
  description = "Names of the published `validation_records` — the certificate is validated against them before CloudFront uses it."
  type        = list(string)
}

variable "include_www" {
  description = "Also serve www.<domain>. Off for a subdomain such as app.example.org."
  type        = bool
  default     = true
}
