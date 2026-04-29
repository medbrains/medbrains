# K3s on bare-metal — Ansible-driven.
#
# For hospitals that refuse a hypervisor and run Linux directly on
# hardware. Same K3s cluster shape as the Proxmox variant; only the
# IaaS substrate differs. Hospital admin provides:
#   - A list of pre-installed Debian 12 / Ubuntu 24.04 host IPs
#   - SSH key access to the `medbrains` user (added separately)
# Terraform runs an Ansible playbook against those hosts via
# null_resource + local-exec.
#
# Why not skip Terraform and use Ansible alone? — to keep the same
# `terraform apply` UX as the Proxmox variant. The tenant directory
# selects which sub-module to call based on a single variable; the
# rest of the world (state, GitOps, secrets) is identical.

terraform {
  required_version = ">= 1.7"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "tenant_id" {
  type = string
}

variable "server_host" {
  type        = string
  description = "IP/FQDN of the K3s control-plane host"
}

variable "agent_hosts" {
  type        = list(string)
  default     = []
  description = "Optional agent host IPs (HA mode = 2)"
}

variable "ssh_user" {
  type    = string
  default = "medbrains"
}

variable "ssh_private_key_path" {
  type        = string
  description = "Path to the SSH private key on the operator's machine"
}

variable "k3s_version" {
  type    = string
  default = "v1.30.5+k3s1"
}

variable "headscale_login_server" {
  type = string
}

resource "random_password" "k3s_token" {
  length  = 48
  special = false
}

locals {
  cluster_id = "medbrains-${var.tenant_id}-baremetal-k3s"
  inventory = templatefile("${path.module}/ansible/inventory.tmpl", {
    server_host = var.server_host
    agent_hosts = var.agent_hosts
    ssh_user    = var.ssh_user
  })
}

resource "local_file" "inventory" {
  filename = "${path.module}/ansible/inventory-${var.tenant_id}.ini"
  content  = local.inventory
}

resource "null_resource" "server" {
  triggers = {
    server_host  = var.server_host
    k3s_version  = var.k3s_version
    inventory    = local_file.inventory.content
  }

  provisioner "local-exec" {
    command = <<-EOT
      ANSIBLE_HOST_KEY_CHECKING=False \
      ansible-playbook \
        -i ${local_file.inventory.filename} \
        --private-key=${var.ssh_private_key_path} \
        --extra-vars 'cluster_id=${local.cluster_id} k3s_version=${var.k3s_version} k3s_token=${random_password.k3s_token.result} headscale_login_server=${var.headscale_login_server}' \
        ${path.module}/ansible/k3s-server.yml
    EOT
  }
}

resource "null_resource" "agents" {
  count = length(var.agent_hosts)
  triggers = {
    agent_host  = var.agent_hosts[count.index]
    server_host = var.server_host
    k3s_version = var.k3s_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      ANSIBLE_HOST_KEY_CHECKING=False \
      ansible-playbook \
        -i ${local_file.inventory.filename} \
        --private-key=${var.ssh_private_key_path} \
        --limit=${var.agent_hosts[count.index]} \
        --extra-vars 'cluster_id=${local.cluster_id} k3s_version=${var.k3s_version} k3s_token=${random_password.k3s_token.result} server_host=${var.server_host}' \
        ${path.module}/ansible/k3s-agent.yml
    EOT
  }

  depends_on = [null_resource.server]
}

output "cluster_id" {
  value = local.cluster_id
}

output "server_host" {
  value = var.server_host
}

output "agent_hosts" {
  value = var.agent_hosts
}

output "kubeconfig_fetch_command" {
  value = "ssh ${var.ssh_user}@${var.server_host} 'sudo cat /etc/rancher/k3s/k3s.yaml' | sed 's/127.0.0.1/${var.server_host}/' > kubeconfig-${var.tenant_id}.yaml"
}
