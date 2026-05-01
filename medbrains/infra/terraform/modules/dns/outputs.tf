output "managed_record_count" {
  description = "Number of DNS records managed for the tenant zone."
  value       = length(var.records)
}

output "zone_name" {
  description = "Echo of the zone name for downstream modules to consume."
  value       = var.zone_name
}

output "provider_kind" {
  description = "DNS backend selected for this zone. cert-manager wiring needs this to pick the right credential source."
  value       = var.provider_kind
}
