output "namespace" {
  description = "Namespace containing kube-prom-stack, Loki, Tempo, Falco, Velero is in 'velero' and Kyverno in 'kyverno'."
  value       = var.namespace
}

output "grafana_admin_secret" {
  description = "Kubernetes secret holding Grafana admin credentials."
  value       = kubernetes_secret_v1.grafana_admin.metadata[0].name
}

output "audit_log_group" {
  description = "CloudWatch log group fed by app + control-plane audit logs."
  value       = aws_cloudwatch_log_group.audit.name
}

output "audit_firehose_arn" {
  description = "Firehose stream archiving audit logs to S3."
  value       = aws_kinesis_firehose_delivery_stream.audit.arn
}

output "velero_bucket" {
  description = "S3 bucket Velero writes cluster backups to."
  value       = aws_s3_bucket.velero.id
}

output "velero_role_arn" {
  description = "IAM role assumed by Velero pods via IRSA."
  value       = aws_iam_role.velero.arn
}

output "loki_endpoint" {
  description = "In-cluster Loki HTTP endpoint."
  value       = "http://loki.${var.namespace}.svc.cluster.local:3100"
}

output "tempo_endpoint" {
  description = "In-cluster Tempo HTTP endpoint."
  value       = "http://tempo.${var.namespace}.svc.cluster.local:3100"
}

output "tempo_otlp_grpc_endpoint" {
  description = "OTLP/gRPC ingress for Tempo. Point the OTEL Collector trace exporter here."
  value       = "tempo.${var.namespace}.svc.cluster.local:4317"
}
