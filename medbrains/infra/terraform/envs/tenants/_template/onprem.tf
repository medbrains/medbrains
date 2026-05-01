# On-prem stack — Patroni HA + K3s + bridge agent.
#
# Two substrate paths via var.onprem_substrate:
#  - "proxmox"   → modules-onprem/* (VM-based)
#  - "baremetal" → modules-onprem-baremetal/* (Ansible-driven)
#
# Both produce the same logical cluster. Pick at provision time
# based on what the hospital's IT team is willing to operate.

provider "proxmox" {
  alias    = "onprem"
  endpoint = var.proxmox_endpoint
  api_token = var.proxmox_api_token_id != "" ? "${var.proxmox_api_token_id}=${var.proxmox_api_token_secret}" : null
  insecure = false
}

# ── Proxmox path ─────────────────────────────────────────────────────

module "patroni_proxmox" {
  count  = var.onprem_substrate == "proxmox" ? 1 : 0
  source = "../../../modules-onprem/patroni-onprem"
  providers = {
    proxmox = proxmox.onprem
  }

  tenant_id      = var.tenant_id
  proxmox_node   = var.proxmox_node
  vm_template_id = var.proxmox_vm_template_id
  ssh_public_key = var.ssh_public_key
}

module "k3s_proxmox" {
  count  = var.onprem_substrate == "proxmox" ? 1 : 0
  source = "../../../modules-onprem/k3s-cluster"
  providers = {
    proxmox = proxmox.onprem
  }

  tenant_id              = var.tenant_id
  proxmox_node           = var.proxmox_node
  vm_template_id         = var.proxmox_vm_template_id
  node_count             = var.cluster_topology == "ha" ? 3 : 1
  ssh_public_key         = var.ssh_public_key
  headscale_login_server = var.headscale_url
  headscale_preauth_key  = file("/tmp/medbrains-${var.tenant_id}-preauth.json")
}

module "bridge_proxmox" {
  count  = var.onprem_substrate == "proxmox" ? 1 : 0
  source = "../../../modules-onprem/bridge-agent"
  providers = {
    proxmox = proxmox.onprem
  }

  tenant_id              = var.tenant_id
  proxmox_node           = var.proxmox_node
  vm_template_id         = var.proxmox_vm_template_id
  ssh_public_key         = var.ssh_public_key
  headscale_login_server = var.headscale_url
  headscale_preauth_key  = file("/tmp/medbrains-${var.tenant_id}-preauth.json")
  headscale_node_tag     = "tag:hospital-${var.tenant_id}-bridge"
  k3s_server_ip          = module.k3s_proxmox[0].server_ip
  cloud_event_bus_url    = coalesce(var.cloud_event_bus_url, "https://api.${var.cloud_apex_domain}/internal/events")
  bridge_artifact_url    = var.bridge_artifact_url
}

# ── Bare-metal path ──────────────────────────────────────────────────

module "patroni_baremetal" {
  count  = var.onprem_substrate == "baremetal" ? 1 : 0
  source = "../../../modules-onprem-baremetal/patroni-baremetal"

  tenant_id            = var.tenant_id
  pg_hosts             = var.baremetal_pg_hosts
  etcd_hosts           = var.baremetal_etcd_hosts
  ssh_private_key_path = var.ssh_private_key_path
}

module "k3s_baremetal" {
  count  = var.onprem_substrate == "baremetal" ? 1 : 0
  source = "../../../modules-onprem-baremetal/k3s-baremetal"

  tenant_id              = var.tenant_id
  server_host            = var.baremetal_k3s_server
  agent_hosts            = var.baremetal_k3s_agents
  ssh_private_key_path   = var.ssh_private_key_path
  headscale_login_server = var.headscale_url
}

# Bare-metal bridge: Ansible playbook only, no VM creation.
# Hospital admin runs the playbook against `var.baremetal_bridge_host`
# after the k3s + Patroni layers come up. Documenting the command
# here so the runbook references something concrete:
#
#   ansible-playbook -i "${var.baremetal_bridge_host}," \
#     --user medbrains \
#     --extra-vars "tenant_id=${var.tenant_id} \
#                   headscale_login=${var.headscale_url} \
#                   bridge_artifact_url=${var.bridge_artifact_url}" \
#     ../../../modules-onprem-baremetal/bridge-baremetal.yml

# ── Outputs ──────────────────────────────────────────────────────────

output "pg_endpoint_hint" {
  value = (var.onprem_substrate == "proxmox"
    ? join(",", module.patroni_proxmox[0].pg_ips)
    : join(",", var.baremetal_pg_hosts))
  description = "Patroni nodes — point app.medbrains-server at any one for /leader REST"
}

output "k3s_server" {
  value = (var.onprem_substrate == "proxmox"
    ? module.k3s_proxmox[0].server_ip
    : var.baremetal_k3s_server)
}
