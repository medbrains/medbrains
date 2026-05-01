# Cilium CNI replacing kube-proxy. eBPF-native data plane, identity-
# aware NetworkPolicy, Hubble for L7 observability. We skip the EKS
# default vpc-cni / kube-proxy installs because they fight Cilium's
# kube-proxy-replacement mode.

resource "helm_release" "cilium" {
  name             = "cilium"
  repository       = "https://helm.cilium.io"
  chart            = "cilium"
  version          = var.cilium_version
  namespace        = "kube-system"
  create_namespace = false
  atomic           = true
  cleanup_on_fail  = true

  values = [yamlencode({
    # Required for kube-proxy replacement on EKS — Cilium needs the
    # API server's reachable host:port pair before kube-proxy is gone.
    kubeProxyReplacement = "true"
    k8sServiceHost       = trimprefix(aws_eks_cluster.this.endpoint, "https://")
    k8sServicePort       = 443

    # ENI mode — Cilium allocates pod IPs from the VPC CIDR so pods
    # are first-class members of the AWS network (compatible with VPC
    # peering, security groups, flow logs).
    eni = {
      enabled = true
    }
    ipam = {
      mode = "eni"
    }
    # Disable Cilium's tunneling — ENI mode routes natively.
    routingMode = "native"

    # Hubble — flow visibility, the reason we picked Cilium over
    # vpc-cni for compliance.
    hubble = {
      enabled = true
      relay = {
        enabled = true
      }
      ui = {
        enabled = true
      }
    }

    # Run only on Linux nodes; tolerate the system taint so the
    # CNI lands on system pool nodes.
    tolerations = [{ operator = "Exists" }]

    operator = {
      replicas = 1
    }
  })]

  depends_on = [
    aws_eks_cluster.this,
    helm_release.karpenter,
  ]
}
