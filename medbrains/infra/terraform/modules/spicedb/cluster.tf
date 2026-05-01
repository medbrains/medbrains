# SpiceDBCluster CRD instance + supporting Secrets + ServiceAccount
# annotations + NetworkPolicy + schema-write Job.

# Pre-shared key for the SpiceDB grpc API. medbrains-server reads the
# same secret to authenticate. Generated once; rotation is a separate
# track (out of scope for Phase 3).
resource "random_password" "preshared_key" {
  length  = 64
  special = false
}

resource "kubernetes_secret_v1" "preshared_key" {
  metadata {
    name      = local.pre_shared_key_secret_name
    namespace = var.namespace
  }
  data = {
    "preshared_key" = random_password.preshared_key.result
    # Datastore URI is referenced by the operator via secretRef so we
    # don't include it here. The operator pulls the connection string
    # from the kubernetes secret created by ESO from
    # `var.datastore_secret_arn` (caller wires that up).
  }
  type = "Opaque"

  depends_on = [kubernetes_namespace_v1.spicedb]
}

# SpiceDBCluster — the operator reads this CRD instance and reconciles
# Deployment + Service + Job.
resource "kubectl_manifest" "spicedb_cluster" {
  yaml_body = yamlencode({
    apiVersion = "authzed.com/v1alpha1"
    kind       = "SpiceDBCluster"
    metadata = {
      name      = "medbrains"
      namespace = var.namespace
    }
    spec = {
      version  = var.spicedb_image_version
      replicas = var.replicas
      config = {
        datastoreEngine = "postgres"
        # Postgres revision-quantization is the only currently-tested
        # serialization on Aurora; off-default revision modes can race
        # under heavy ZedToken churn.
        datastoreFollowerReadDelay = "0s"

        # Telemetry endpoint disabled — we forward our own metrics
        # via OTEL Collector (Phase 4 observability module).
        telemetryEndpoint = ""

        # Watch API tuning — the cloud spicedb_watch task tails this.
        # 30s buffer balances WAN-tunnel cadence against memory.
        watchBufferLength = "300"
      }
      secretRef          = "spicedb-secrets" # caller wires this via ESO
      serviceAccountName = "medbrains-spicedb"
    }
  })

  depends_on = [
    kubectl_manifest.operator_bundle,
    kubernetes_secret_v1.preshared_key,
  ]
}

# Annotate the operator-generated ServiceAccount with the IRSA role.
# The operator creates `medbrains-spicedb` SA on its own; we patch the
# annotation post-hoc. Using kubectl_manifest with server_side_apply
# avoids fighting the operator's reconciliation loop.
resource "kubectl_manifest" "service_account_irsa" {
  yaml_body = yamlencode({
    apiVersion = "v1"
    kind       = "ServiceAccount"
    metadata = {
      name      = "medbrains-spicedb"
      namespace = var.namespace
      annotations = {
        "eks.amazonaws.com/role-arn" = aws_iam_role.spicedb.arn
      }
    }
  })

  server_side_apply = true
  force_conflicts   = true

  depends_on = [kubectl_manifest.spicedb_cluster]
}

# NetworkPolicy — only medbrains-server pods may dial grpc/http.
# kube-system DNS and the operator's metrics-scrape are allowed via
# default kube-system selector.
resource "kubectl_manifest" "network_policy" {
  yaml_body = yamlencode({
    apiVersion = "networking.k8s.io/v1"
    kind       = "NetworkPolicy"
    metadata = {
      name      = "medbrains-spicedb-ingress"
      namespace = var.namespace
    }
    spec = {
      podSelector = {
        matchLabels = {
          "authzed.com/cluster" = "medbrains"
        }
      }
      policyTypes = ["Ingress"]
      ingress = [{
        from = [
          {
            namespaceSelector = {}
            podSelector = {
              matchLabels = { app = var.server_app_label }
            }
          },
          {
            # Allow Prometheus / OTEL Collector scrape from any pod
            # with the metrics-allow label. Set on the OTEL daemonset
            # in the observability module.
            namespaceSelector = {}
            podSelector = {
              matchLabels = { "spicedb.medbrains/metrics" = "scrape" }
            }
          },
        ]
        ports = [
          { port = 50051, protocol = "TCP" }, # grpc
          { port = 8443, protocol = "TCP" },  # http
          { port = 9090, protocol = "TCP" },  # metrics
        ]
      }]
    }
  })

  depends_on = [kubectl_manifest.spicedb_cluster]
}

# ── Schema-write Job ──────────────────────────────────────────────────
# A one-shot Job that POSTs the schema to SpiceDB on first apply. The
# operator manages migrations on the datastore itself; this Job only
# loads the application-level Zanzibar schema.

resource "kubernetes_config_map_v1" "schema" {
  metadata {
    name      = "medbrains-spicedb-schema"
    namespace = var.namespace
  }
  data = {
    "schema.zed" = file(local.schema_file_resolved)
  }

  depends_on = [kubernetes_namespace_v1.spicedb]
}

resource "kubectl_manifest" "schema_write_job" {
  yaml_body = yamlencode({
    apiVersion = "batch/v1"
    kind       = "Job"
    metadata = {
      # Job name embeds the schema's content hash so terraform
      # naturally re-runs the load when schema.zed changes (Job names
      # are immutable; a hash mismatch forces replace).
      name      = "schema-write-${substr(sha256(file(local.schema_file_resolved)), 0, 10)}"
      namespace = var.namespace
    }
    spec = {
      backoffLimit = 5
      template = {
        spec = {
          restartPolicy = "OnFailure"
          containers = [{
            name  = "zed"
            image = "ghcr.io/authzed/zed:latest"
            env = [
              {
                name  = "ZED_ENDPOINT"
                value = "medbrains-spicedb.${var.namespace}.svc.cluster.local:50051"
              },
              {
                name = "ZED_TOKEN"
                valueFrom = {
                  secretKeyRef = {
                    name = local.pre_shared_key_secret_name
                    key  = "preshared_key"
                  }
                }
              },
              {
                name  = "ZED_INSECURE"
                value = "true"
              },
            ]
            volumeMounts = [{
              name      = "schema"
              mountPath = "/schema"
            }]
            command = ["/bin/sh", "-c"]
            args = [
              "zed schema write /schema/schema.zed"
            ]
          }]
          volumes = [{
            name = "schema"
            configMap = {
              name = kubernetes_config_map_v1.schema.metadata[0].name
            }
          }]
        }
      }
    }
  })

  depends_on = [
    kubectl_manifest.spicedb_cluster,
    kubectl_manifest.service_account_irsa,
    kubernetes_config_map_v1.schema,
  ]
}
