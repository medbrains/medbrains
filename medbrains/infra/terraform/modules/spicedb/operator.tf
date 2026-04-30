# spicedb-operator install. Applied as a multi-doc bundle pulled from
# the upstream release tarball — no Helm chart is published. We split
# the bundle into individual manifests with kubectl_manifest because
# applying one giant bundle blocks terraform's dependency graph from
# tracking individual CRD/Deployment readiness.

resource "kubernetes_namespace_v1" "spicedb" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name" = "spicedb"
      # Cilium honors this label to apply the Hubble L7 visibility
      # filter. Cluster default would also work but we set it
      # explicitly so the policy surface is auditable.
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

# Pull the operator bundle.yaml from GitHub at apply time. Pinning the
# version means changes flow through `var.operator_version` and the
# release notes — rather than a moving `latest`.
data "http" "operator_bundle" {
  url = "https://github.com/authzed/spicedb-operator/releases/download/v${var.operator_version}/bundle.yaml"
}

# Multi-doc YAML → list of manifests. kubectl provider's
# `data.kubectl_file_documents` does the splitting.
data "kubectl_file_documents" "operator_bundle" {
  content = data.http.operator_bundle.response_body
}

resource "kubectl_manifest" "operator_bundle" {
  for_each  = data.kubectl_file_documents.operator_bundle.manifests
  yaml_body = each.value

  # The bundle includes the `spicedb-operator` namespace. We don't
  # override it — the operator runs in its own namespace separate from
  # the SpiceDBCluster. medbrains-server connects to a Service in
  # `var.namespace`, not to the operator's namespace.
  server_side_apply = true

  depends_on = [kubernetes_namespace_v1.spicedb]
}
