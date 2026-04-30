# Karpenter v1 — controller IAM (IRSA), node IAM, instance profile,
# Helm install, and three NodePools:
#   - system     (on-demand, t4g.small, system workloads only)
#   - app-spot   (Graviton spot, ~70% off, default for app pods)
#   - app-ondemand (fallback when spot capacity is exhausted)
#
# RFC: keep two pools at minimum so a spot eviction storm doesn't
# stall the cluster.

# ── Karpenter controller IAM (IRSA) ───────────────────────────────────

data "aws_iam_policy_document" "karpenter_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.this.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer_host}:sub"
      values   = ["system:serviceaccount:karpenter:karpenter"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "karpenter_controller" {
  name               = "${var.cluster_name}-karpenter-controller"
  assume_role_policy = data.aws_iam_policy_document.karpenter_assume.json
  tags               = local.tags
}

# Karpenter controller permissions — lifted from the upstream
# CloudFormation template at
# https://karpenter.sh/docs/getting-started/getting-started-with-karpenter/cloudformation/
data "aws_iam_policy_document" "karpenter_controller" {
  statement {
    sid = "AllowScopedEC2InstanceAccessActions"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateFleet",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}::image/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}::snapshot/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:security-group/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:subnet/*",
    ]
  }

  statement {
    sid = "AllowScopedEC2LaunchTemplateAccessActions"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateFleet",
      "ec2:CreateLaunchTemplate",
    ]
    resources = ["arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:launch-template/*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/kubernetes.io/cluster/${var.cluster_name}"
      values   = ["owned"]
    }
    condition {
      test     = "StringLike"
      variable = "aws:RequestTag/karpenter.sh/nodepool"
      values   = ["*"]
    }
  }

  statement {
    sid = "AllowScopedResourceCreationTagging"
    actions = [
      "ec2:CreateTags",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:fleet/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:instance/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:volume/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:network-interface/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:launch-template/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:spot-instances-request/*",
    ]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/kubernetes.io/cluster/${var.cluster_name}"
      values   = ["owned"]
    }
    condition {
      test     = "StringEquals"
      variable = "ec2:CreateAction"
      values   = ["RunInstances", "CreateFleet", "CreateLaunchTemplate"]
    }
  }

  statement {
    sid = "AllowScopedDeletion"
    actions = [
      "ec2:TerminateInstances",
      "ec2:DeleteLaunchTemplate",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:instance/*",
      "arn:${data.aws_partition.current.partition}:ec2:${var.region}:*:launch-template/*",
    ]
    condition {
      test     = "StringEquals"
      variable = "ec2:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
      values   = ["owned"]
    }
  }

  statement {
    sid = "AllowRegionalReadActions"
    actions = [
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeImages",
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceTypeOfferings",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeLaunchTemplates",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSpotPriceHistory",
      "ec2:DescribeSubnets",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.region]
    }
  }

  statement {
    sid = "AllowSSMReadActions"
    actions = [
      "ssm:GetParameter",
    ]
    resources = ["arn:${data.aws_partition.current.partition}:ssm:${var.region}::parameter/aws/service/*"]
  }

  statement {
    sid = "AllowPricingReadActions"
    actions = [
      "pricing:GetProducts",
    ]
    resources = ["*"]
  }

  statement {
    sid = "AllowInterruptionQueueActions"
    actions = [
      "sqs:DeleteMessage",
      "sqs:GetQueueUrl",
      "sqs:ReceiveMessage",
    ]
    resources = [aws_sqs_queue.karpenter_interruption.arn]
  }

  statement {
    sid       = "AllowPassingInstanceRole"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.karpenter_node.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ec2.amazonaws.com"]
    }
  }

  statement {
    sid = "AllowInstanceProfileManagement"
    actions = [
      "iam:AddRoleToInstanceProfile",
      "iam:CreateInstanceProfile",
      "iam:DeleteInstanceProfile",
      "iam:GetInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
      "iam:TagInstanceProfile",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/kubernetes.io/cluster/${var.cluster_name}"
      values   = ["owned"]
    }
  }

  statement {
    sid = "AllowEKSDescribe"
    actions = [
      "eks:DescribeCluster",
    ]
    resources = [aws_eks_cluster.this.arn]
  }
}

resource "aws_iam_policy" "karpenter_controller" {
  name   = "${var.cluster_name}-karpenter-controller"
  policy = data.aws_iam_policy_document.karpenter_controller.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "karpenter_controller" {
  role       = aws_iam_role.karpenter_controller.name
  policy_arn = aws_iam_policy.karpenter_controller.arn
}

# ── Karpenter node IAM (used by EC2Nodeclass for launched instances) ──

data "aws_iam_policy_document" "node_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "karpenter_node" {
  name               = "${var.cluster_name}-karpenter-node"
  assume_role_policy = data.aws_iam_policy_document.node_assume.json
  tags               = merge(local.tags, local.karpenter_discovery_tag)
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  role       = aws_iam_role.karpenter_node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "node_cni" {
  role       = aws_iam_role.karpenter_node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "node_registry" {
  role       = aws_iam_role.karpenter_node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "node_ssm" {
  role       = aws_iam_role.karpenter_node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Required for EKS access entry — the cluster auth maps this role to
# `system:nodes` automatically when an access entry exists for it.
resource "aws_eks_access_entry" "karpenter_node" {
  cluster_name  = aws_eks_cluster.this.name
  principal_arn = aws_iam_role.karpenter_node.arn
  type          = "EC2_LINUX"
}

# ── Spot interruption queue ───────────────────────────────────────────
# Karpenter consumes EC2 spot interruption notices from EventBridge so
# it can drain pods *before* AWS takes the instance.

resource "aws_sqs_queue" "karpenter_interruption" {
  name                      = "${var.cluster_name}-karpenter-interruption"
  message_retention_seconds = 300
  sqs_managed_sse_enabled   = true
  tags                      = local.tags
}

data "aws_iam_policy_document" "interruption_queue_policy" {
  statement {
    sid     = "EventBridgeWrite"
    actions = ["sqs:SendMessage"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com", "sqs.amazonaws.com"]
    }
    resources = [aws_sqs_queue.karpenter_interruption.arn]
  }
}

resource "aws_sqs_queue_policy" "karpenter_interruption" {
  queue_url = aws_sqs_queue.karpenter_interruption.id
  policy    = data.aws_iam_policy_document.interruption_queue_policy.json
}

resource "aws_cloudwatch_event_rule" "spot_interruption" {
  name        = "${var.cluster_name}-spot-interruption"
  description = "EC2 Spot Instance Interruption Warning → Karpenter"
  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Spot Instance Interruption Warning"]
  })
}

resource "aws_cloudwatch_event_target" "spot_interruption" {
  rule = aws_cloudwatch_event_rule.spot_interruption.name
  arn  = aws_sqs_queue.karpenter_interruption.arn
}

resource "aws_cloudwatch_event_rule" "rebalance" {
  name        = "${var.cluster_name}-rebalance-recommendation"
  description = "EC2 Instance Rebalance Recommendation → Karpenter"
  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Instance Rebalance Recommendation"]
  })
}

resource "aws_cloudwatch_event_target" "rebalance" {
  rule = aws_cloudwatch_event_rule.rebalance.name
  arn  = aws_sqs_queue.karpenter_interruption.arn
}

# ── Karpenter Helm install ────────────────────────────────────────────

resource "helm_release" "karpenter" {
  name             = "karpenter"
  repository       = "oci://public.ecr.aws/karpenter"
  chart            = "karpenter"
  version          = var.karpenter_version
  namespace        = "karpenter"
  create_namespace = true
  atomic           = true
  cleanup_on_fail  = true

  values = [yamlencode({
    settings = {
      clusterName       = aws_eks_cluster.this.name
      clusterEndpoint   = aws_eks_cluster.this.endpoint
      interruptionQueue = aws_sqs_queue.karpenter_interruption.name
    }
    serviceAccount = {
      annotations = {
        "eks.amazonaws.com/role-arn" = aws_iam_role.karpenter_controller.arn
      }
    }
    # Karpenter must run on a baseline, non-Karpenter-managed node so
    # it can bootstrap. EKS's default managed node group OR a pinned
    # Fargate profile would normally hold it; for dev we let it
    # tolerate everything and accept that the first scaling decision
    # bootstraps the system pool.
    tolerations = [{ operator = "Exists" }]
  })]

  depends_on = [
    aws_eks_access_entry.karpenter_node,
    aws_iam_role_policy_attachment.karpenter_controller,
  ]
}

# ── EC2NodeClass + 3 NodePools ────────────────────────────────────────
#
# The EC2NodeClass binds a NodePool to an AMI family + IAM role +
# subnets/SGs. NodePools are pure scheduling policy and reference the
# class via spec.template.spec.nodeClassRef.

resource "kubectl_manifest" "ec2_nodeclass" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.k8s.aws/v1"
    kind       = "EC2NodeClass"
    metadata = {
      name = "default"
    }
    spec = {
      amiFamily = "Bottlerocket"
      amiSelectorTerms = [
        { alias = "bottlerocket@latest" }
      ]
      role = aws_iam_role.karpenter_node.name
      subnetSelectorTerms = [
        { tags = local.karpenter_discovery_tag }
      ]
      securityGroupSelectorTerms = [
        { tags = local.karpenter_discovery_tag }
      ]
      tags = merge(local.tags, local.karpenter_discovery_tag)
    }
  })

  depends_on = [helm_release.karpenter]
}

resource "kubectl_manifest" "nodepool_system" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name = "system"
    }
    spec = {
      template = {
        metadata = {
          labels = { "node-role" = "system" }
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = "default"
          }
          requirements = [
            { key = "kubernetes.io/arch", operator = "In", values = ["arm64"] },
            { key = "karpenter.sh/capacity-type", operator = "In", values = ["on-demand"] },
            { key = "node.kubernetes.io/instance-type", operator = "In", values = ["t4g.small", "t4g.medium"] },
          ]
          taints = [{
            key    = "node-role"
            value  = "system"
            effect = "NoSchedule"
          }]
        }
      }
      limits = {
        cpu    = "8"
        memory = "16Gi"
      }
      disruption = {
        consolidationPolicy = "WhenEmptyOrUnderutilized"
        consolidateAfter    = "30s"
      }
    }
  })

  depends_on = [kubectl_manifest.ec2_nodeclass]
}

resource "kubectl_manifest" "nodepool_app_spot" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name = "app-spot"
    }
    spec = {
      template = {
        metadata = {
          labels = { "node-role" = "app", "node-capacity" = "spot" }
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = "default"
          }
          requirements = [
            { key = "kubernetes.io/arch", operator = "In", values = ["arm64"] },
            { key = "karpenter.sh/capacity-type", operator = "In", values = ["spot"] },
            { key = "karpenter.k8s.aws/instance-category", operator = "In", values = ["c", "m", "r"] },
            { key = "karpenter.k8s.aws/instance-generation", operator = "Gt", values = ["6"] },
          ]
        }
      }
      limits = {
        cpu    = "200"
        memory = "400Gi"
      }
      weight = 100
      disruption = {
        consolidationPolicy = "WhenEmptyOrUnderutilized"
        consolidateAfter    = "60s"
      }
    }
  })

  depends_on = [kubectl_manifest.ec2_nodeclass]
}

resource "kubectl_manifest" "nodepool_app_ondemand" {
  yaml_body = yamlencode({
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name = "app-ondemand"
    }
    spec = {
      template = {
        metadata = {
          labels = { "node-role" = "app", "node-capacity" = "on-demand" }
        }
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = "default"
          }
          requirements = [
            { key = "kubernetes.io/arch", operator = "In", values = ["arm64"] },
            { key = "karpenter.sh/capacity-type", operator = "In", values = ["on-demand"] },
            { key = "karpenter.k8s.aws/instance-category", operator = "In", values = ["c", "m", "r"] },
            { key = "karpenter.k8s.aws/instance-generation", operator = "Gt", values = ["6"] },
          ]
        }
      }
      limits = {
        cpu    = "100"
        memory = "200Gi"
      }
      # Lower weight than spot — Karpenter prefers higher-weighted
      # pools, so on-demand only fires when spot can't fulfill.
      weight = 50
      disruption = {
        consolidationPolicy = "WhenEmptyOrUnderutilized"
        consolidateAfter    = "60s"
      }
    }
  })

  depends_on = [kubectl_manifest.ec2_nodeclass]
}
