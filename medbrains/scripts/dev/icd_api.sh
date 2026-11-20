#!/usr/bin/env bash
# WHO ICD-API (ICD-11 search) under Apple `container`: WHO ships it only as a
# Linux image. Mirrors the `icd-api` service in docker-compose.yml, including
# its licence switch (ICD_API_ACCEPT_LICENSE=true, as `make icd-up` sets).
#
#   scripts/dev/icd_api.sh start|stop
set -euo pipefail
# shellcheck source=scripts/dev/container_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/container_common.sh"
NAME=medbrains-icd-api

case "${1:-}" in
  start)
    require_container
    resume_container "$NAME" && exit 0
    container run -d --name "$NAME" \
      -p "127.0.0.1:${ICD_API_PORT:-8382}:80" \
      -e "include=${ICD_API_INCLUDE:-2026-01_en}" \
      -e "acceptLicense=${ICD_API_ACCEPT_LICENSE:-false}" \
      -e "saveAnalytics=${ICD_API_SAVE_ANALYTICS:-false}" \
      "whoicd/icd-api:${ICD_API_IMAGE_TAG:-latest}" >/dev/null
    echo "$NAME: http://127.0.0.1:${ICD_API_PORT:-8382}" ;;
  stop) remove_container "$NAME" ;;
  *) die "usage: $0 start|stop" ;;
esac
