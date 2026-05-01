terraform {
  required_version = ">= 1.7"
  required_providers {
    digitalocean = {
      source                = "digitalocean/digitalocean"
      version               = "~> 2.0"
      configuration_aliases = [digitalocean]
    }
  }
}

# ── Dispatcher: each sub-module enabled iff its provider_kind matches ──

module "digitalocean" {
  count  = var.provider_kind == "digitalocean" ? 1 : 0
  source = "./digitalocean"
  providers = {
    digitalocean = digitalocean
  }

  hostname        = var.hostname
  domain          = var.domain
  admin_email     = var.admin_email
  region          = var.region
  size            = var.size
  image           = var.image
  ssh_public_keys = var.ssh_public_keys
  ssh_user        = var.ssh_user
  ssh_private_key = var.ssh_private_key
  binaries_dir    = var.binaries_dir
  spa_dist_dir    = var.spa_dist_dir
  deploy_kit_dir  = var.deploy_kit_dir
}

module "existing_host" {
  count  = var.provider_kind == "existing-host" ? 1 : 0
  source = "./existing-host"

  hostname        = var.hostname
  domain          = var.domain
  admin_email     = var.admin_email
  existing_ipv4   = var.existing_ipv4
  ssh_user        = var.ssh_user
  ssh_private_key = var.ssh_private_key
  binaries_dir    = var.binaries_dir
  spa_dist_dir    = var.spa_dist_dir
  deploy_kit_dir  = var.deploy_kit_dir
}
