terraform {
  required_providers {
    digitalocean = {
      source                = "digitalocean/digitalocean"
      version               = "~> 2.0"
      configuration_aliases = [digitalocean]
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

# DigitalOcean's domain doubles as the zone identifier — we look up
# the existing one rather than create it (operator registers the
# domain at DigitalOcean out-of-band).

data "digitalocean_domain" "this" {
  name = var.zone_name
}

resource "digitalocean_record" "this" {
  for_each = {
    for r in var.records :
    "${r.type}-${r.name}-${substr(sha256(r.value), 0, 8)}" => r
  }

  domain   = data.digitalocean_domain.this.id
  type     = each.value.type
  name     = each.value.name
  value    = each.value.value
  ttl      = each.value.ttl
  priority = each.value.type == "MX" || each.value.type == "SRV" ? each.value.priority : null
}
