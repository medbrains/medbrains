variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
}

variable "region" {
  description = "AWS region of the bucket."
  type        = string
}

variable "allowed_origins" {
  description = "Web app origins allowed to fetch the assets (CORS), e.g. [\"https://medbrains.amh.org.in\"]."
  type        = list(string)
}
