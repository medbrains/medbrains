# SpiceDB module — Operator install + SpiceDBCluster pointing at Aurora
# + per-pod IRSA + NetworkPolicy + schema-write Job.
#
# RFC-INFRA-2026-002 Phase 4.4 / hybrid roadmap Phase 3.
#
# Dependencies:
#   - EKS module (cluster + OIDC provider) must be applied first
#   - Aurora module's cluster parameter group must include
#     `track_commit_timestamp = on` (Phase 3 amendment in this PR)
#   - Caller is responsible for creating a Secrets Manager secret with
#     the SpiceDB datastore connection string and passing its ARN as
#     `datastore_secret_arn`. Secret format:
#       postgres://<user>:<pass>@<host>:5432/<db>?sslmode=require
#
# Production posture:
#   - 2 SpiceDB replicas (HA), spread across AZs via topology constraints
#   - NetworkPolicy: only medbrains-server pods (selector
#     app=medbrains-server) can dial 50051/8443
#   - IRSA grants Secrets Manager + KMS read for the datastore secret
#   - Schema is loaded by a one-shot Job from infra/spicedb/schema.zed
#   - track_commit_timestamp on Aurora powers the Watch API used by
#     spicedb_watch on the cloud side and CacheInvalidate frames on
#     the edge (roadmap Phase 9)

variable "cluster_name" {
  description = "EKS cluster name. Used in IAM role names and tags."
  type        = string
}

variable "oidc_provider_arn" {
  description = "IRSA OIDC provider ARN from the EKS module."
  type        = string
}

variable "oidc_issuer_host" {
  description = "OIDC issuer URL minus the https:// prefix. Used as the IRSA audience."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS CMK that encrypts the datastore secret. SpiceDB pods need kms:Decrypt on this key."
  type        = string
}

variable "datastore_secret_arn" {
  description = "Secrets Manager ARN of the SpiceDB datastore connection-string secret."
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace for the operator + SpiceDBCluster."
  type        = string
  default     = "spicedb-system"
}

variable "operator_version" {
  description = "spicedb-operator release tag (without leading 'v')."
  type        = string
  default     = "1.21.0"
}

variable "spicedb_image_version" {
  description = "SpiceDB image tag the SpiceDBCluster runs."
  type        = string
  default     = "v1.36.1"
}

variable "schema_file" {
  description = "Absolute path to the schema.zed file loaded into the cluster on first apply. Default resolves the repo's infra/spicedb/schema.zed relative to this module."
  type        = string
  default     = ""
}

variable "replicas" {
  description = "SpiceDBCluster replica count. 2 is the minimum for HA."
  type        = number
  default     = 2
}

variable "server_app_label" {
  description = "Pod label selector authorized to reach SpiceDB. Must match medbrains-server's pod label."
  type        = string
  default     = "medbrains-server"
}

# ── Locals ────────────────────────────────────────────────────────────

locals {
  schema_file_resolved = var.schema_file == "" ? "${path.module}/../../../spicedb/schema.zed" : var.schema_file

  tags = {
    Cluster   = var.cluster_name
    Module    = "spicedb"
    ManagedBy = "terraform"
  }

  pre_shared_key_secret_name = "spicedb-preshared-key"
}

data "aws_partition" "current" {}
