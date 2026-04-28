# EKS module — cluster + Karpenter + Cilium prereqs + IRSA OIDC.
# Phase 4.3 deliverable.

variable "region"             { type = string }
variable "environment"        { type = string }
variable "cluster_name"       { type = string }
variable "kubernetes_version" {
  type    = string
  default = "1.31"
}
variable "vpc_id"             { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "kms_key_arn"        { type = string }

# TODO Phase 4.3:
# - aws_eks_cluster (Bottlerocket, KMS-encrypted secrets, audit logs)
# - aws_iam_openid_connect_provider for IRSA
# - Karpenter NodePools: system, on-demand, spot, gpu
# - Cilium CNI install (helm_release)
# - Cluster add-ons: AWS LB Controller, External-DNS, Cert-Manager,
#   Argo CD, Argo Rollouts, OTEL Collector, Kyverno, Falco, Velero, KEDA,
#   ESO, EBS+EFS CSI, Reloader.

output "cluster_endpoint"  { value = "TODO" }
output "cluster_ca"        { value = "TODO" }
output "oidc_provider_arn" { value = "TODO" }
