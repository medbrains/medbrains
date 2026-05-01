terraform {
  required_providers {
    cloudflare = {
      source                = "cloudflare/cloudflare"
      version               = "~> 5.0"
      configuration_aliases = [cloudflare]
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

data "cloudflare_zone" "this" {
  filter = {
    name = var.zone_name
  }
}

resource "cloudflare_dns_record" "this" {
  for_each = {
    for r in var.records :
    "${r.type}-${r.name}-${substr(sha256(r.value), 0, 8)}" => r
  }

  zone_id = data.cloudflare_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.value
  ttl     = each.value.proxied ? 1 : each.value.ttl
  proxied = each.value.proxied
  comment = var.tenant_id != "" ? "managed by terraform / tenant=${var.tenant_id}" : "managed by terraform"
}

output "zone_id" {
  value = data.cloudflare_zone.this.zone_id
}

output "record_ids" {
  value = { for k, r in cloudflare_dns_record.this : k => r.id }
}
