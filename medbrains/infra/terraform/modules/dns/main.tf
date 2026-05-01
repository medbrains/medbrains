terraform {
  required_version = ">= 1.7"
  required_providers {
    cloudflare = {
      source                = "cloudflare/cloudflare"
      version               = "~> 5.0"
      configuration_aliases = [cloudflare]
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.50"
      configuration_aliases = [aws.dns]
    }
    azurerm = {
      source                = "hashicorp/azurerm"
      version               = "~> 3.0"
      configuration_aliases = [azurerm.dns]
    }
    google = {
      source                = "hashicorp/google"
      version               = "~> 5.0"
      configuration_aliases = [google.dns]
    }
    digitalocean = {
      source                = "digitalocean/digitalocean"
      version               = "~> 2.0"
      configuration_aliases = [digitalocean]
    }
    namecheap = {
      source                = "namecheap/namecheap"
      version               = "~> 2.0"
      configuration_aliases = [namecheap]
    }
    godaddy-dns = {
      source                = "veksh/godaddy-dns"
      version               = "~> 0.3"
      configuration_aliases = [godaddy-dns]
    }
  }
}

# ── Dispatch: each sub-module is enabled iff its provider_kind matches ──

module "cloudflare" {
  count     = var.provider_kind == "cloudflare" ? 1 : 0
  source    = "./cloudflare"
  zone_name = var.zone_name
  records   = var.records
  tenant_id = var.tenant_id
  providers = {
    cloudflare = cloudflare
  }
}

module "route53" {
  count     = var.provider_kind == "route53" ? 1 : 0
  source    = "./route53"
  zone_name = var.zone_name
  records   = var.records
  tenant_id = var.tenant_id
  providers = {
    aws = aws.dns
  }
}

module "azure" {
  count               = var.provider_kind == "azure" ? 1 : 0
  source              = "./azure"
  zone_name           = var.zone_name
  records             = var.records
  tenant_id           = var.tenant_id
  resource_group_name = var.azure_resource_group_name
  providers = {
    azurerm = azurerm.dns
  }
}

module "google" {
  count        = var.provider_kind == "google" ? 1 : 0
  source       = "./google"
  zone_name    = var.zone_name
  records      = var.records
  tenant_id    = var.tenant_id
  project      = var.google_project
  managed_zone = var.google_managed_zone
  providers = {
    google = google.dns
  }
}

module "digitalocean" {
  count     = var.provider_kind == "digitalocean" ? 1 : 0
  source    = "./digitalocean"
  zone_name = var.zone_name
  records   = var.records
  tenant_id = var.tenant_id
  providers = {
    digitalocean = digitalocean
  }
}

module "namecheap" {
  count     = var.provider_kind == "namecheap" ? 1 : 0
  source    = "./namecheap"
  zone_name = var.zone_name
  records   = var.records
  overwrite = var.namecheap_overwrite
  providers = {
    namecheap = namecheap
  }
}

module "godaddy" {
  count     = var.provider_kind == "godaddy" ? 1 : 0
  source    = "./godaddy"
  zone_name = var.zone_name
  records   = var.records
  providers = {
    godaddy-dns = godaddy-dns
  }
}
