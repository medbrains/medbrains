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
# hashed assets: cache forever. html + sitemap + the search index: never cache
# (so redeploys show instantly; Pagefind's entry files keep the same names).
aws s3 sync dist/ "s3://$WEBSITE_BUCKET" --delete \
  --exclude "*.html" --exclude "*.xml" --exclude "pagefind/*" \
  --cache-control "public,max-age=31536000,immutable"
aws s3 sync dist/ "s3://$WEBSITE_BUCKET" --delete \
  --exclude "*" --include "*.html" --include "*.xml" --include "pagefind/*" \
  --cache-control "public,max-age=0,must-revalidate"

# S3 behind CloudFront has no directory index below the root: give each page
# its clean address too (/pharmacy-management-software, /blog/heat-stroke-first-aid).
find dist -mindepth 2 -name index.html | while read -r page; do
  slug="${page#dist/}"; slug="${slug%/index.html}"
  aws s3 cp "$page" "s3://$WEBSITE_BUCKET/$slug" --content-type "text/html; charset=utf-8" \
    --cache-control "public,max-age=0,must-revalidate" --only-show-errors
done

echo "→ invalidating CloudFront $WEBSITE_DISTRIBUTION_ID"
aws cloudfront create-invalidation --distribution-id "$WEBSITE_DISTRIBUTION_ID" --paths "/*" >/dev/null

# Tell Bing/Yandex/Seznam (IndexNow) every page changed. The key file lives in
# public/; a failed ping never fails a deploy that already shipped.
echo "→ pinging IndexNow"
key=3cbf7f7268ccd4af2f168909cf6cfe46  # public/$key.txt
host=www.medbrains.in
urls=$(grep -ho '<loc>[^<]*</loc>' dist/sitemap-*.xml | sed 's#</*loc>##g' | grep -v 'sitemap-' \
  | awk 'BEGIN{ORS=","} {printf "\"%s\",", $0}' | sed 's/,*$//' || true)
curl -fsS -m 20 -X POST https://api.indexnow.org/indexnow \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"host\":\"$host\",\"key\":\"$key\",\"keyLocation\":\"https://$host/$key.txt\",\"urlList\":[$urls]}" \
  >/dev/null && echo "  submitted" || echo "  ! IndexNow ping failed (non-fatal)"

echo "✓ deployed"
