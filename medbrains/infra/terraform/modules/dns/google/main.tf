terraform {
  required_providers {
    google = {
      source                = "hashicorp/google"
      version               = "~> 5.0"
      configuration_aliases = [google]
    }
  }
}

variable "zone_name" {
  type = string
}

variable "records" {
  type = list(object({
    name     = string
    type     = string
    value    = string
    ttl      = optional(number, 300)
    priority = optional(number)
    proxied  = optional(bool, false)
  }))
}

variable "tenant_id" {
  type    = string
  default = ""
}

variable "project" {
  type        = string
  description = "GCP project id hosting the managed zone."
}

variable "managed_zone" {
  type        = string
  description = "Managed zone resource name in Cloud DNS (often differs from zone_name)."
}

data "google_dns_managed_zone" "this" {
  name    = var.managed_zone
  project = var.project
}

# google_dns_record_set is authoritative for the (name, type) pair —
# group multi-value records by (name, type) before emitting.

locals {
  grouped = {
    for k, v in {
      for r in var.records :
      "${r.type}-${r.name}" => r...
    } :
    k => {
      name = "${v[0].name}.${data.google_dns_managed_zone.this.dns_name}"
      type = v[0].type
      ttl  = v[0].ttl
      rrdatas = [
        for r in v : (
          r.type == "MX" && r.priority != null ? "${r.priority} ${r.value}" : r.value
        )
      ]
    }
  }
}

resource "google_dns_record_set" "this" {
  for_each = local.grouped

  project      = var.project
  managed_zone = data.google_dns_managed_zone.this.name
  name         = each.value.name
  type         = each.value.type
  ttl          = each.value.ttl
  rrdatas      = each.value.rrdatas
}
