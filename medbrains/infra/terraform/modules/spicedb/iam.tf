# IRSA role assumed by SpiceDB pods. Grants:
#   - secretsmanager:GetSecretValue on the datastore secret
#   - kms:Decrypt on the CMK that encrypts that secret

data "aws_iam_policy_document" "spicedb_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${var.oidc_issuer_host}:sub"
      # The Operator generates a SA named after the SpiceDBCluster.
      # Our cluster is named `medbrains` so the SA is
      # `medbrains-spicedb` in our namespace.
      values = ["system:serviceaccount:${var.namespace}:medbrains-spicedb"]
    }
    condition {
      test     = "StringEquals"
      variable = "${var.oidc_issuer_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "spicedb" {
  name               = "${var.cluster_name}-spicedb"
  assume_role_policy = data.aws_iam_policy_document.spicedb_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "spicedb" {
  statement {
    sid       = "ReadDatastoreSecret"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.datastore_secret_arn]
  }
  statement {
    sid       = "DecryptSecret"
    actions   = ["kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "spicedb" {
  name   = "${var.cluster_name}-spicedb"
  role   = aws_iam_role.spicedb.id
  policy = data.aws_iam_policy_document.spicedb.json
}
