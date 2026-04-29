# Bridge Agent — small VM that runs medbrains-bridge + tailscale.
#
# This VM is the on-prem foothold of the Headscale tailnet. It runs:
#   1. tailscale (BSD-3 client) joined to our Headscale URL
#   2. medbrains-bridge daemon (HL7 listener, outbox publisher, heartbeat)
#
# It does NOT run on the K3s cluster nodes deliberately:
#   - tailscale on the bridge VM stays up even if K3s is rebooted
#   - clean blast-radius separation (bridge is the only path off-prem)
#   - smaller VM than a K3s node (1 vCPU, 1GB RAM is enough)
#
# Cloud-init writes /etc/medbrains/bridge.toml with cluster details
# and starts both systemd units. tailscale registers using a single-
# use pre-auth key issued by the cloud admin via the Headscale API.

terraform {
  required_version = ">= 1.7"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.101"
    }
  }
}

variable "tenant_id" {
  type = string
}

variable "proxmox_node" {
  type = string
}

variable "vm_template_id" {
  type        = string
  description = "Cloud-init Debian 12 template id"
}

variable "vcpus" {
  type    = number
  default = 1
}

variable "memory_mb" {
  type    = number
  default = 1024
}

variable "disk_gb" {
  type    = number
  default = 10
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
  type = string
}

variable "headscale_login_server" {
  type        = string
  description = "https://headscale.<your-domain>"
}

variable "headscale_preauth_key" {
  type        = string
  sensitive   = true
  description = "Single-use Headscale pre-auth key (from cloud-side terraform output)"
}

variable "headscale_node_tag" {
  type        = string
  description = "ACL tag this node will claim, e.g. 'tag:hospital-A'"
}

variable "k3s_server_ip" {
  type        = string
  description = "On-prem K3s server IP (the bridge points medbrains-bridge at this for HL7 forwarding)"
}

variable "cloud_event_bus_url" {
  type        = string
  description = "https://api.medbrains.cloud/internal/events — bridge publishes redacted events here"
}

variable "bridge_version" {
  type        = string
  default     = "0.1.0"
  description = "medbrains-bridge binary version (built and pushed to a release artifact registry)"
}

variable "bridge_artifact_url" {
  type        = string
  description = "URL where the medbrains-bridge ARM64/x86_64 binary is hosted (e.g. S3 presigned URL or GitHub release)"
}

locals {
  vm_name = "medbrains-${var.tenant_id}-bridge"
}

resource "proxmox_virtual_environment_file" "userdata" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.proxmox_node

  source_raw {
    file_name = "${local.vm_name}.yaml"
    data = templatefile("${path.module}/cloud-init-bridge.yaml.tmpl", {
      tenant_id              = var.tenant_id
      headscale_login_server = var.headscale_login_server
      headscale_preauth_key  = var.headscale_preauth_key
      headscale_node_tag     = var.headscale_node_tag
      k3s_server_ip          = var.k3s_server_ip
      cloud_event_bus_url    = var.cloud_event_bus_url
      bridge_version         = var.bridge_version
      bridge_artifact_url    = var.bridge_artifact_url
    })
  }
}

resource "proxmox_virtual_environment_vm" "bridge" {
  name      = local.vm_name
  node_name = var.proxmox_node
  tags      = ["medbrains", "onprem", "bridge", var.tenant_id]

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
    user_data_file_id = proxmox_virtual_environment_file.userdata.id
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

# ── Outputs ───────────────────────────────────────────────────────────

output "bridge_ip" {
  value = proxmox_virtual_environment_vm.bridge.ipv4_addresses[1][0]
}

output "headscale_node_name_hint" {
  value = "After first boot the node appears in Headscale as ${local.vm_name}; verify with `headscale nodes list`"
}

output "smoke_test_command" {
  value = "ssh medbrains@${proxmox_virtual_environment_vm.bridge.ipv4_addresses[1][0]} 'systemctl is-active tailscaled medbrains-bridge && tailscale status'"
}
