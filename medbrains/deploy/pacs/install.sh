#!/usr/bin/env bash
# Install the on-site PACS on a fresh Ubuntu machine (run as root):
#
#   sudo PACS_BIND_IP=192.168.10.20 ./install.sh
#
# PACS_BIND_IP is this machine's address on the hospital LAN; the PACS
# listens there only. Writes /etc/medbrains-pacs/pacs.env with a generated
# password (shown once), starts Orthanc, and installs the nightly backup.
set -euo pipefail
: "${PACS_BIND_IP:?set PACS_BIND_IP to the hospital-LAN address of this machine}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if ! command -v docker >/dev/null; then
    apt-get update -q && apt-get install -yq docker.io docker-compose-v2
fi
apt-get install -yq sqlite3 awscli >/dev/null

install -d -m 700 /etc/medbrains-pacs /srv/orthanc/db /srv/orthanc/backup
if [[ ! -f /etc/medbrains-pacs/pacs.env ]]; then
    PASSWORD="$(openssl rand -hex 24)"
    umask 077
    cat > /etc/medbrains-pacs/pacs.env <<ENV
PACS_BIND_IP=${PACS_BIND_IP}
PACS_NAME=${PACS_NAME:-Hospital PACS}
PACS_AET=${PACS_AET:-HOSPPACS}
# MedBrains signs in as this user (Radiology -> PACS, ORTHANC_PASSWORD secret).
ORTHANC__REGISTERED_USERS={"medbrains": "${PASSWORD}"}
# Every scanner allowed to store and query: {"CT1": ["CT1AET", "192.168.10.31", 104]}
ORTHANC__DICOM_MODALITIES={}
ENV
    echo "PACS user 'medbrains' password (store it as ORTHANC_PASSWORD in MedBrains): ${PASSWORD}"
fi
if [[ ! -f /etc/medbrains-pacs/backup.env ]]; then
    install -m 600 /dev/null /etc/medbrains-pacs/backup.env
    printf 'PACS_BACKUP_BUCKET=\nAWS_ACCESS_KEY_ID=\nAWS_SECRET_ACCESS_KEY=\nAWS_DEFAULT_REGION=ap-south-1\n' \
        > /etc/medbrains-pacs/backup.env
    echo "Fill /etc/medbrains-pacs/backup.env from create-backup-bucket.sh before the first night."
fi

install -d /opt/medbrains-pacs
install -m 644 "$HERE/docker-compose.yml" /opt/medbrains-pacs/docker-compose.yml
set -a
# shellcheck disable=SC1091
source /etc/medbrains-pacs/pacs.env
set +a
docker compose -f /opt/medbrains-pacs/docker-compose.yml up -d

install -m 755 "$HERE/pacs-backup" /usr/local/bin/pacs-backup
install -m 644 "$HERE/pacs-backup.service" "$HERE/pacs-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pacs-backup.timer
echo "PACS running at http://${PACS_BIND_IP}:8042 (DICOM ${PACS_BIND_IP}:4242, AET ${PACS_AET:-HOSPPACS})."
