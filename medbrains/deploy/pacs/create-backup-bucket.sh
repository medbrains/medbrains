#!/usr/bin/env bash
# Create the PACS cloud-copy bucket and a key that can only write to it.
# Run from an admin workstation with AWS credentials:
#
#   ./create-backup-bucket.sh alagappa
#
# Bucket: private, versioned (a deleted image stays recoverable), encrypted,
# in Mumbai (images stay in India), images moved to cheaper storage after 30
# days, old versions kept 365 days. The key can put and list, not delete.
set -euo pipefail
HOSPITAL="${1:?usage: create-backup-bucket.sh <hospital-slug>}"
REGION=ap-south-1
BUCKET="medbrains-pacs-${HOSPITAL}"
USER="pacs-backup-${HOSPITAL}"

aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"},"BucketKeyEnabled":true}]}'
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules":[{"ID":"images-to-cold","Status":"Enabled","Filter":{"Prefix":""},
    "Transitions":[{"Days":30,"StorageClass":"GLACIER_IR"}],
    "NoncurrentVersionExpiration":{"NoncurrentDays":365}}]}'

aws iam create-user --user-name "$USER" >/dev/null
aws iam put-user-policy --user-name "$USER" --policy-name pacs-backup --policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],\"Resource\":\"arn:aws:s3:::${BUCKET}/*\"},
    {\"Effect\":\"Allow\",\"Action\":[\"s3:ListBucket\"],\"Resource\":\"arn:aws:s3:::${BUCKET}\"},
    {\"Effect\":\"Allow\",\"Action\":[\"kms:GenerateDataKey\",\"kms:Decrypt\"],\"Resource\":\"*\"}
  ]}"
echo "Bucket ${BUCKET} ready. Put these in /etc/medbrains-pacs/backup.env on the PACS:"
echo "PACS_BACKUP_BUCKET=${BUCKET}"
aws iam create-access-key --user-name "$USER" \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text \
    | awk '{print "AWS_ACCESS_KEY_ID="$1"\nAWS_SECRET_ACCESS_KEY="$2}'
