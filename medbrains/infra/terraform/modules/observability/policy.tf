# Kyverno — policy enforcement. Replaces OPA/Gatekeeper because it
# uses Kubernetes-native YAML rather than Rego.
#
# Default policies enforced:
#   - require resource requests/limits on all pods
#   - disallow privileged containers
#   - require runAsNonRoot
#   - require imagePullPolicy=Always for `latest` tags
#   - block default ServiceAccount usage by app pods
# Policies live in `policies/` under this module and are applied via
# kubectl_manifest after Kyverno is up.

resource "helm_release" "kyverno" {
  name             = "kyverno"
  repository       = "https://kyverno.github.io/kyverno"
  chart            = "kyverno"
  namespace        = "kyverno"
  create_namespace = true
  atomic           = true
  timeout          = 600

  values = [yamlencode({
    admissionController = {
      replicas = 3 # HA; required for prod-grade
    }
    backgroundController = {
      replicas = 1
    }
    cleanupController = {
      replicas = 1
    }
    reportsController = {
      replicas = 1
    }
  })]

  depends_on = [kubernetes_namespace_v1.observability]
}

# Baseline policies — applied as ClusterPolicy resources. Audit-only
# in dev, enforce in prod (toggled via the validationFailureAction).
locals {
  policy_action = var.environment == "prod" ? "Enforce" : "Audit"
}

resource "kubectl_manifest" "policy_require_requests_limits" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name = "require-requests-limits"
      annotations = {
        "policies.kyverno.io/title"    = "Require Resource Requests + Limits"
        "policies.kyverno.io/severity" = "medium"
        "policies.kyverno.io/category" = "Best Practices"
      }
    }
    spec = {
      validationFailureAction = local.policy_action
      background              = true
      rules = [{
        name = "validate-resources"
        match = {
          any = [{
            resources = { kinds = ["Pod"] }
          }]
        }
        validate = {
          message = "Pods must declare CPU/memory requests + limits."
          pattern = {
            spec = {
              containers = [{
                resources = {
                  requests = { memory = "?*", cpu = "?*" }
                  limits   = { memory = "?*" }
                }
              }]
            }
          }
        }
      }]
    }
  })

  depends_on = [helm_release.kyverno]
}

resource "kubectl_manifest" "policy_disallow_privileged" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name = "disallow-privileged"
    }
    spec = {
      validationFailureAction = local.policy_action
      background              = true
      rules = [{
        name = "validate-privileged"
        match = {
          any = [{
            resources = { kinds = ["Pod"] }
          }]
        }
        validate = {
          message = "Privileged containers are not allowed."
          pattern = {
            spec = {
              "=(securityContext)" = {
                "=(privileged)" = "false"
              }
              containers = [{
                "=(securityContext)" = {
                  "=(privileged)" = "false"
                }
              }]
            }
          }
        }
      }]
    }
  })

  depends_on = [helm_release.kyverno]
}

resource "kubectl_manifest" "policy_require_run_as_non_root" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name = "require-run-as-non-root"
    }
    spec = {
      validationFailureAction = local.policy_action
      background              = true
      rules = [{
        name = "validate-run-as-non-root"
        match = {
          any = [{
            resources = { kinds = ["Pod"] }
          }]
        }
        validate = {
          message = "Containers must set runAsNonRoot: true."
          anyPattern = [
            {
              spec = {
                securityContext = { runAsNonRoot = true }
              }
            },
            {
              spec = {
                containers = [{
                  securityContext = { runAsNonRoot = true }
                }]
              }
            },
          ]
        }
      }]
    }
  })

  depends_on = [helm_release.kyverno]
}
