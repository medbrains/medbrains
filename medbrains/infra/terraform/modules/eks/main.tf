# EKS module — control plane + IRSA OIDC + Karpenter + Cilium + addons.
#
# RFC-INFRA-2026-002 Phase 4.3. Composes:
#   cluster.tf   — aws_eks_cluster, IAM roles, log group, KMS encryption
#   karpenter.tf — Karpenter Helm + 3 NodePools (system, app-spot, app-ondemand)
#   cilium.tf    — Cilium CNI replacing kube-proxy
#   addons.tf    — LB controller, External-DNS, Cert-Manager, Argo CD,
#                  OTEL Collector, KEDA, External-Secrets, EBS/EFS CSI, Reloader
#
# Falco / Kyverno / Velero ship in the observability module so this
# module's blast radius stays scoped to "make a usable cluster" rather
# than "make an audited cluster". Argo CD does ship here so app
# deployments can land immediately after `terraform apply` returns.
#
# Provider note: helm + kubernetes + kubectl providers must be
# configured by the caller using cluster_endpoint, cluster_ca, and a
# token from `aws eks get-token`. The module declares requirements in
# versions.tf but does not configure providers itself — terraform
# requires provider config available at plan time, before this module
# has produced its outputs.

variable "region" {
  description = "AWS region the cluster lives in."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod). Used in tags."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name. Globally unique within the AWS account/region."
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes minor version. EKS supports n-2 of upstream."
  type        = string
  default     = "1.31"
}

variable "vpc_id" {
  description = "VPC the cluster ENIs and worker nodes attach to."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for control plane ENIs and Karpenter nodes. Must span >= 2 AZs."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "EKS requires private subnets across at least two availability zones."
  }
}

variable "kms_key_arn" {
  description = "KMS key ARN used to envelope-encrypt Kubernetes secrets at rest."
  type        = string
}

variable "endpoint_public_access" {
  description = "Whether the API server endpoint is reachable from the public internet. Disable for prod once CI/CD runners live in-VPC."
  type        = bool
  default     = true
}

variable "public_access_cidrs" {
  description = "CIDR ranges allowed to hit the public API endpoint. Default open for dev; lock down for prod."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "karpenter_version" {
  description = "Karpenter Helm chart version."
  type        = string
  default     = "1.0.6"
}

variable "cilium_version" {
  description = "Cilium Helm chart version."
  type        = string
  default     = "1.16.3"
}

# ── Locals ────────────────────────────────────────────────────────────

locals {
  tags = {
    Environment = var.environment
    Module      = "eks"
    ManagedBy   = "terraform"
    Cluster     = var.cluster_name
  }

  # OIDC issuer URL minus scheme — used as audience identifier in
  # IAM trust policies (IRSA).
  oidc_issuer_host = trimprefix(aws_eks_cluster.this.identity[0].oidc[0].issuer, "https://")

  # Karpenter discovers cluster resources via this tag on the VPC,
  # subnets, and worker security group.
  karpenter_discovery_tag = {
    "karpenter.sh/discovery" = var.cluster_name
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
