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
