terraform {
  required_version = ">= 1.7"

  # Local state for the pilot — once we have multiple deployed
  # tenants, swap to the shared S3 backend used by envs/tenants/.
  backend "local" {
    path = "./terraform.tfstate"
  }

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    godaddy-dns = {
      source  = "veksh/godaddy-dns"
      version = "~> 0.3"
    }
    # The DNS module's dispatcher declares configuration_aliases for
    # every supported backend; we wire them all here even though
    # alagappa only uses GoDaddy. Unused aliases route to count=0
    # sub-modules, so no API calls happen.
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    namecheap = {
      source  = "namecheap/namecheap"
      version = "~> 2.0"
    }
  }
}

# DigitalOcean droplet for the host. Token from DIGITALOCEAN_TOKEN env.
provider "digitalocean" {
  alias = "tenant"
}

# GoDaddy DNS for the alagappahospital.com zone. Creds from
# GODADDY_API_KEY / GODADDY_API_SECRET env (run setup-tenant-dns
# first to push them into the OS keychain).
provider "godaddy-dns" {
  alias = "tenant"
}

# Inert provider blocks — required because the DNS module's
# dispatcher declares configuration_aliases for every backend.
# These never make API calls (their sub-modules have count = 0).
provider "cloudflare" { alias = "stub" }
provider "aws" {
  alias  = "dns"
  region = "ap-south-1"
}
provider "azurerm" {
  alias = "dns"
  features {}
  skip_provider_registration = true
}
provider "google" {
  alias   = "dns"
  project = "stub"
}
provider "namecheap" {
  alias     = "stub"
  user_name = "stub"
  api_user  = "stub"
  api_key   = "stub"
  client_ip = "0.0.0.0"
}

# Pre-existing SSH key in the DO account; operator adds the public
# key once via the DO web UI / API. The fingerprint is stable.
data "digitalocean_ssh_key" "ops" {
  name = var.do_ssh_key_name
}

module "vm" {
  source = "../../../modules/standalone-vm"
  providers = {
    digitalocean = digitalocean.tenant
  }

  provider_kind = "digitalocean"

  hostname        = "alagappa-hims"
  domain          = var.domain
  admin_email     = var.admin_email
  region          = "blr1" # Bangalore — closest DO region to South India
  size            = "s-2vcpu-4gb"
  ssh_public_keys = [data.digitalocean_ssh_key.ops.fingerprint]
  ssh_user        = "root"
  ssh_private_key = file(var.ssh_private_key_path)

  binaries_dir   = var.binaries_dir
  spa_dist_dir   = var.spa_dist_dir
  deploy_kit_dir = var.deploy_kit_dir
}

module "dns" {
  source = "../../../modules/dns"
  providers = {
    godaddy-dns  = godaddy-dns.tenant
    cloudflare   = cloudflare.stub
    aws.dns      = aws.dns
    azurerm.dns  = azurerm.dns
    google.dns   = google.dns
    digitalocean = digitalocean.tenant
    namecheap    = namecheap.stub
  }

  provider_kind = "godaddy"
  zone_name     = var.zone_name
  tenant_id     = "alagappa"

  records = [
    {
      name  = "hims"
      type  = "A"
      value = module.vm.public_ip
      ttl   = 600
    },
  ]
}

output "public_ip" {
  value = module.vm.public_ip
}

output "ssh_endpoint" {
  value = module.vm.ssh_endpoint
}

output "health_url" {
  value = module.vm.health_url
}
