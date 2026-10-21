# Names are prefixed `company_` so the TF_VAR_* that infra/.env exports for the
# prod hospital env (TF_VAR_domain=…) can never fill them.

variable "company_domain" {
  description = "The company domain."
  type        = string
  default     = "medbrains.in"
}

variable "company_region" {
  description = "AWS region for the site bucket and SES (Mumbai keeps mail data in India)."
  type        = string
  default     = "ap-south-1"
}

variable "company_prod_instance_id" {
  description = "The production EC2 instance app.<domain> and the bare domain point at (set TF_VAR_company_prod_instance_id, e.g. i-0123456789abcdef0)."
  type        = string
}
