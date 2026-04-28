locals {
  base_tags = {
    Project     = "medbrains"
    ManagedBy   = "terraform"
    Environment = var.environment
    Region      = var.region
    RFC         = "RFC-INFRA-2026-002"
  }
}
