output "cluster_name" {
  description = "EKS cluster name."
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "Kubernetes API server endpoint. Pass to the helm/kubernetes provider config in the caller."
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_ca" {
  description = "Base64-encoded cluster CA certificate. Pass to the helm/kubernetes provider config."
  value       = aws_eks_cluster.this.certificate_authority[0].data
}

output "cluster_arn" {
  description = "EKS cluster ARN."
  value       = aws_eks_cluster.this.arn
}

output "oidc_provider_arn" {
  description = "IRSA OIDC provider ARN. Use as the trust principal in IAM roles assumed by service accounts."
  value       = aws_iam_openid_connect_provider.this.arn
}

output "oidc_issuer_host" {
  description = "OIDC issuer URL minus the https:// prefix. Used as the audience in IAM trust policies."
  value       = local.oidc_issuer_host
}

output "node_security_group_id" {
  description = "Security group attached to Karpenter-launched nodes. Reference from RDS / EFS security groups for pod-to-data ingress rules."
  value       = aws_security_group.nodes.id
}

output "karpenter_node_role_arn" {
  description = "IAM role assumed by Karpenter-launched EC2 instances."
  value       = aws_iam_role.karpenter_node.arn
}

output "karpenter_interruption_queue" {
  description = "SQS queue receiving spot-interruption events. Surfaced for monitoring / alerting."
  value       = aws_sqs_queue.karpenter_interruption.name
}
