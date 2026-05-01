terraform {
  required_providers {
    azurerm = {
      source                = "hashicorp/azurerm"
      version               = "~> 3.0"
      configuration_aliases = [azurerm]
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

variable "resource_group_name" {
  type        = string
  description = "Resource group containing the dns zone."
}

# Azure exposes one resource per record type — we filter the input
# list per type and emit each in its own resource.

locals {
  by_key = {
    for r in var.records :
    "${r.type}-${r.name}-${substr(sha256(r.value), 0, 8)}" => r
  }

  a_records     = { for k, r in local.by_key : k => r if r.type == "A" }
  aaaa_records  = { for k, r in local.by_key : k => r if r.type == "AAAA" }
  cname_records = { for k, r in local.by_key : k => r if r.type == "CNAME" }
  txt_records   = { for k, r in local.by_key : k => r if r.type == "TXT" }
  mx_records    = { for k, r in local.by_key : k => r if r.type == "MX" }
  ns_records    = { for k, r in local.by_key : k => r if r.type == "NS" }
}

resource "azurerm_dns_a_record" "this" {
  for_each            = local.a_records
  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  records             = [each.value.value]
}

resource "azurerm_dns_aaaa_record" "this" {
  for_each            = local.aaaa_records
  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  records             = [each.value.value]
}

resource "azurerm_dns_cname_record" "this" {
  for_each            = local.cname_records
  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  record              = each.value.value
}

resource "azurerm_dns_txt_record" "this" {
  for_each            = local.txt_records
  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  record {
    value = each.value.value
  }
}

resource "azurerm_dns_mx_record" "this" {
  for_each            = local.mx_records
  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  record {
    preference = each.value.priority == null ? 10 : each.value.priority
    exchange   = each.value.value
  }
}

resource "azurerm_dns_ns_record" "this" {
  for_each            = local.ns_records
  name                = each.value.name
  zone_name           = var.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = each.value.ttl
  records             = [each.value.value]
}
