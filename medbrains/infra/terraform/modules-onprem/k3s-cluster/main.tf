# K3s on-prem cluster — Proxmox VMs.
#
# Provisions a K3s Kubernetes cluster on a hospital's Proxmox host for
# the on-prem data plane. K3s is chosen for its small footprint
# (~85MB binary, 512MB RAM floor) and ARM64 support.
#
# Defaults: 1 server VM. Set node_count=3 for HA (1 server + 2
# agents). The first VM (server) bootstraps with a generated cluster
# token; subsequent VMs join using that token over cloud-init.
#
# The tailscale BSD-3 client + tailscale-operator are NOT installed by
# Terraform — they're applied via Flux from the GitOps repo (see
# modules-onprem/flux-bootstrap/) so the hospital admin doesn't have
# to run terraform every time we ship a manifest change.
#
# Hospital-side prereqs:
#   - Proxmox VE 8 with cloud-init storage configured
#   - A cloud-init Debian 12 ARM64 (or x86_64) template
#   - Enough disk on `storage_pool` for ~100GB per node

terraform {
  required_version = ">= 1.7"
  required_providers {
    # bpg/proxmox is the actively-maintained provider as of 2026 (telmate
    # is mostly unmaintained). Resource names: proxmox_virtual_environment_*.
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.101"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "tenant_id" {
  type        = string
  description = "Stable id for this hospital tenant; appears in VM names + tags"
}

variable "proxmox_node" {
  type        = string
  description = "Proxmox node name (e.g. pve-1)"
}

variable "vm_template_id" {
  type        = string
  description = "ID of a pre-built cloud-init Debian 12 template on the Proxmox host"
}

variable "node_count" {
  type        = number
  default     = 1
  description = "1 = single-node cluster (clinic); 3 = HA (1 server + 2 agents)"
  validation {
    condition     = contains([1, 3], var.node_count)
    error_message = "node_count must be 1 (single-node) or 3 (HA)."
  }
}

variable "vcpus" {
  type    = number
  default = 2
}

variable "memory_mb" {
  type    = number
  default = 4096
}

variable "disk_gb" {
  type    = number
  default = 60
}

variable "network_bridge" {
  type    = string
  default = "vmbr0"
}

variable "vlan_tag" {
  type    = number
  default = null
}

variable "storage_pool" {
  type    = string
  default = "local-lvm"
}

variable "ssh_public_key" {
  type        = string
  description = "Authorized public key for the medbrains user"
}

variable "k3s_version" {
  type    = string
  default = "v1.30.5+k3s1"
}

variable "headscale_login_server" {
  type        = string
  description = "https://headscale.<your-domain> — used at boot only by the bootstrap script to verify reachability; tailscale itself is installed via Flux"
}

variable "headscale_preauth_key" {
  type        = string
  sensitive   = true
  description = "Single-use Headscale pre-auth key issued by the cloud admin"
}

locals {
  cluster_id = "medbrains-${var.tenant_id}-onprem-k3s"
  is_ha      = var.node_count == 3
}

# Cluster token used by additional nodes to join. Generated once;
# changes only on full cluster recreation.
resource "random_password" "k3s_token" {
  length  = 48
  special = false
}

# ── Cloud-init user_data_file_id (uploaded as snippet) ───────────────

resource "proxmox_virtual_environment_file" "server_userdata" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.proxmox_node

  source_raw {
    file_name = "${local.cluster_id}-server.yaml"
    data = templatefile("${path.module}/cloud-init-server.yaml.tmpl", {
      cluster_id      = local.cluster_id
      k3s_version     = var.k3s_version
      k3s_token       = random_password.k3s_token.result
      is_ha           = local.is_ha ? "true" : "false"
      headscale_login = var.headscale_login_server
    })
  }
}

resource "proxmox_virtual_environment_file" "agent_userdata" {
  count        = local.is_ha ? 2 : 0
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.proxmox_node

  source_raw {
    file_name = "${local.cluster_id}-agent-${count.index + 1}.yaml"
    data = templatefile("${path.module}/cloud-init-agent.yaml.tmpl", {
      cluster_id  = local.cluster_id
      k3s_version = var.k3s_version
      k3s_token   = random_password.k3s_token.result
      server_ip   = proxmox_virtual_environment_vm.server.ipv4_addresses[1][0]
    })
  }
}

# ── Server (control-plane) node ───────────────────────────────────────

resource "proxmox_virtual_environment_vm" "server" {
  name      = "${local.cluster_id}-server"
  node_name = var.proxmox_node
  tags      = ["medbrains", "onprem", "k3s-server", var.tenant_id]

  clone {
    vm_id = tonumber(var.vm_template_id)
  }

  cpu {
    cores = var.vcpus
    type  = "host"
  }

  memory {
    dedicated = var.memory_mb
  }

  network_device {
    bridge  = var.network_bridge
    model   = "virtio"
    vlan_id = var.vlan_tag
  }

  disk {
    interface    = "scsi0"
    datastore_id = var.storage_pool
    size         = var.disk_gb
    file_format  = "raw"
  }

  initialization {
    user_account {
      username = "medbrains"
      keys     = [var.ssh_public_key]
    }
    user_data_file_id = proxmox_virtual_environment_file.server_userdata.id
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
  }

  agent {
    enabled = true
    timeout = "5m"
  }
}

# ── Agent nodes (HA only) ─────────────────────────────────────────────

resource "proxmox_virtual_environment_vm" "agent" {
  count     = local.is_ha ? 2 : 0
  name      = "${local.cluster_id}-agent-${count.index + 1}"
  node_name = var.proxmox_node
  tags      = ["medbrains", "onprem", "k3s-agent", var.tenant_id]

  clone {
    vm_id = tonumber(var.vm_template_id)
  }

  cpu {
    cores = var.vcpus
    type  = "host"
  }

  memory {
    dedicated = var.memory_mb
  }

  network_device {
    bridge  = var.network_bridge
    model   = "virtio"
    vlan_id = var.vlan_tag
  }

  disk {
    interface    = "scsi0"
    datastore_id = var.storage_pool
    size         = var.disk_gb
    file_format  = "raw"
  }

  initialization {
    user_account {
      username = "medbrains"
      keys     = [var.ssh_public_key]
    }
    user_data_file_id = proxmox_virtual_environment_file.agent_userdata[count.index].id
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
  }

  agent {
    enabled = true
    timeout = "5m"
  }

  depends_on = [proxmox_virtual_environment_vm.server]
}

# ── Outputs ───────────────────────────────────────────────────────────

output "cluster_id" {
  value = local.cluster_id
}

output "server_ip" {
  value = proxmox_virtual_environment_vm.server.ipv4_addresses[1][0]
}

output "agent_ips" {
  value = [for vm in proxmox_virtual_environment_vm.agent : vm.ipv4_addresses[1][0]]
}

output "kubeconfig_fetch_command" {
  value       = "ssh medbrains@${proxmox_virtual_environment_vm.server.ipv4_addresses[1][0]} 'sudo cat /etc/rancher/k3s/k3s.yaml' | sed 's/127.0.0.1/${proxmox_virtual_environment_vm.server.ipv4_addresses[1][0]}/' > kubeconfig-${var.tenant_id}.yaml"
  description = "Run this on the hospital admin laptop to pull a kubeconfig for cluster access"
}

output "k3s_token_arn_hint" {
  value       = "Store the cluster token in Secrets Manager for ops recovery; do not commit. Token is in terraform state (sensitive)."
  description = "Operational reminder"
}

