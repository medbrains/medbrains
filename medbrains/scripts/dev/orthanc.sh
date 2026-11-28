#!/usr/bin/env bash
# Dev PACS (Orthanc) under Apple `container`: there is no maintained macOS
# build with the DICOMweb, OHIF and worklist plugins, which the radiology
# screens need. Mirrors the `orthanc` service in docker-compose.yml.
#
#   scripts/dev/orthanc.sh start|stop
set -euo pipefail
# shellcheck source=scripts/dev/container_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/container_common.sh"
NAME=medbrains-orthanc

case "${1:-}" in
  start)
    require_container
    resume_container "$NAME" && exit 0
    container run -d --name "$NAME" \
      -p 127.0.0.1:8042:8042 -p 127.0.0.1:4242:4242 \
      -e "ORTHANC__NAME=MedBrains dev PACS" \
      -e ORTHANC__AUTHENTICATION_ENABLED=false \
      -e ORTHANC__DICOM_AET=MEDBRAINS \
      -e DICOM_WEB_PLUGIN_ENABLED=true \
      -e OHIF_PLUGIN_ENABLED=true \
      -e WORKLISTS_PLUGIN_ENABLED=true \
      -e ORTHANC__WORKLISTS__SAVE_IN_ORTHANC_DATABASE=true \
      -e ORTHANC__WORKLISTS__DELETE_WORKLISTS_ON_STABLE_STUDY=true \
      -e ORTHANC__STABLE_AGE=5 \
      -v medbrains-orthanc-data:/var/lib/orthanc/db \
      orthancteam/orthanc:latest >/dev/null
    echo "$NAME: http://127.0.0.1:8042 (DICOM 4242)" ;;
  stop) remove_container "$NAME" ;;
  *) die "usage: $0 start|stop" ;;
esac
