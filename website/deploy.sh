#!/usr/bin/env bash
# Deploy ONLY the marketing website: build -> sync to S3 -> invalidate CloudFront.
# Static site, so it does NOT go through Argo/EKS — it rides the same S3+CloudFront
# path as apps/web. Provision the bucket + distribution via the `website` terraform
# module (infra/terraform/modules/website), then this script ships the content.
#
# Usage:
#   WEBSITE_BUCKET=medbrains-prod-marketing-ap-south-1 \
#   WEBSITE_DISTRIBUTION_ID=E1234ABCDEF \
#   ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

: "${WEBSITE_BUCKET:?set WEBSITE_BUCKET (terraform output website_bucket)}"
: "${WEBSITE_DISTRIBUTION_ID:?set WEBSITE_DISTRIBUTION_ID (terraform output website_distribution_id)}"

echo "→ building"
pnpm install --frozen-lockfile
pnpm build

echo "→ syncing dist/ to s3://$WEBSITE_BUCKET"
# hashed assets: cache forever. html + sitemap: never cache (so redeploys show instantly).
aws s3 sync dist/ "s3://$WEBSITE_BUCKET" --delete \
  --exclude "*.html" --exclude "*.xml" \
  --cache-control "public,max-age=31536000,immutable"
aws s3 sync dist/ "s3://$WEBSITE_BUCKET" --delete \
  --exclude "*" --include "*.html" --include "*.xml" \
  --cache-control "public,max-age=0,must-revalidate"

echo "→ invalidating CloudFront $WEBSITE_DISTRIBUTION_ID"
aws cloudfront create-invalidation --distribution-id "$WEBSITE_DISTRIBUTION_ID" --paths "/*" >/dev/null

echo "✓ deployed"
