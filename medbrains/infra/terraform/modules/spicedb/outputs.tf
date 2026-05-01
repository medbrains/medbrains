output "namespace" {
  description = "Namespace the SpiceDBCluster runs in. medbrains-server needs the address `medbrains-spicedb.<ns>.svc.cluster.local`."
  value       = var.namespace
}

output "grpc_endpoint" {
  description = "In-cluster gRPC endpoint for SpiceDB. host:port."
  value       = "medbrains-spicedb.${var.namespace}.svc.cluster.local:50051"
}

output "http_endpoint" {
  description = "In-cluster HTTP endpoint (REST + Watch). host:port."
  value       = "medbrains-spicedb.${var.namespace}.svc.cluster.local:8443"
}

output "preshared_key_secret" {
  description = "Kubernetes secret name holding the SpiceDB preshared key. Mount into medbrains-server."
  value       = local.pre_shared_key_secret_name
}

output "iam_role_arn" {
  description = "IAM role assumed by SpiceDB pods via IRSA."
  value       = aws_iam_role.spicedb.arn
}
