# Aurora module — Aurora Serverless v2 PostgreSQL 16 + RDS Proxy.
# Phase 4.4 deliverable.

variable "region"        { type = string }
variable "environment"   { type = string }
variable "vpc_id"        { type = string }
variable "db_subnet_ids" { type = list(string) }
variable "kms_key_arn"   { type = string }
variable "min_acu" {
  type    = number
  default = 0.5
}
variable "max_acu" {
  type    = number
  default = 16
}

# TODO Phase 4.4:
# - aws_rds_cluster (postgres 16, Serverless v2 scaling 0.5-16 ACU,
#   PITR 35d, KMS-encrypted, IAM auth, deletion protection in prod)
# - aws_db_proxy + endpoint (connection pooling)
# - aws_security_group (ingress from EKS VPC CIDR only)
# - aws_db_subnet_group (3 AZs)
# - Cross-region snapshot copy schedule

output "cluster_endpoint"  { value = "TODO" }
output "proxy_endpoint"    { value = "TODO" }
output "secret_master_arn" { value = "TODO" }
