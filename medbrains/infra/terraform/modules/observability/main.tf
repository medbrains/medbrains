# Observability module — metrics + logs + traces + runtime threats +
# policy + state backup. RFC-INFRA-2026-002 Phase 4.5 / hybrid roadmap
# Phase 4.
#
# Composition:
#   metrics.tf  — kube-prometheus-stack (Prom + Grafana + Alertmanager)
#   logs.tf     — Loki + Promtail + CloudWatch Logs → Firehose → S3
#   traces.tf   — Tempo + Otel Collector trace pipeline
#   runtime.tf  — Falco (runtime threat detection)
#   policy.tf   — Kyverno (policy enforcement)
#   backup.tf   — Velero (k8s state backup)
#   dashboards.tf — pre-built Grafana dashboards via ConfigMap
#
# Note: this module is purely cluster-side; the EKS module already
# ships an OTEL Collector deployment. We extend it here with the
# Tempo/Loki receivers and the Falco/Kyverno/Velero stack.

variable "cluster_name" {
  description = "EKS cluster name. Used in CloudWatch log group + Velero IAM role names."
  type        = string
}

variable "region" {
  description = "AWS region the cluster lives in."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod)."
  type        = string
}

variable "oidc_provider_arn" {
  description = "IRSA OIDC provider ARN from the EKS module."
  type        = string
}

variable "oidc_issuer_host" {
  description = "OIDC issuer URL minus https:// prefix. Used as IRSA audience."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS CMK encrypting CloudWatch log groups, Firehose stream, and Velero S3 bucket."
  type        = string
}

variable "audit_bucket_name" {
  description = "S3 bucket for long-term audit log retention (Firehose target). Caller-managed (S3 module)."
  type        = string
}

variable "namespace" {
  description = "Namespace for all observability components."
  type        = string
  default     = "observability"
}

variable "grafana_admin_password" {
  description = "Initial Grafana admin password. Override via terraform.tfvars; rotate via the External Secrets pipeline post-bootstrap."
  type        = string
  sensitive   = true
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention before Firehose archive."
  type        = number
  default     = 30
}

# ── Locals ────────────────────────────────────────────────────────────

locals {
  tags = {
    Cluster     = var.cluster_name
    Environment = var.environment
    Module      = "observability"
    ManagedBy   = "terraform"
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

resource "kubernetes_namespace_v1" "observability" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name"             = "observability"
      "pod-security.kubernetes.io/enforce" = "baseline"
    }
  }
}
