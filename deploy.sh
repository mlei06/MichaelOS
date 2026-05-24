#!/usr/bin/env bash
set -euo pipefail

BUCKET="michael-lei.com"
DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

if [[ -z "$DISTRIBUTION_ID" ]]; then
  echo "Set CLOUDFRONT_DISTRIBUTION_ID env var before running." >&2
  exit 1
fi

npm run build

aws s3 sync dist/ "s3://${BUCKET}" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "robots.txt" \
  --exclude "sitemap.xml"

aws s3 sync dist/ "s3://${BUCKET}" \
  --delete \
  --cache-control "public, max-age=60, must-revalidate" \
  --exclude "*" \
  --include "index.html" \
  --include "robots.txt" \
  --include "sitemap.xml"

aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*"
