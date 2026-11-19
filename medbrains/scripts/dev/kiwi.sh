#!/usr/bin/env bash
# Kiwi TCMS and its MariaDB under Apple `container`: Kiwi is a Django app
# shipped only as a Linux image. Mirrors `kiwi` + `kiwi_db` in
# docker-compose.yml, with the same two config drop-ins from infra/local.
# `container` has no compose, so Kiwi reaches MariaDB by its container IP.
#
#   scripts/dev/kiwi.sh start|stop
set -euo pipefail
# shellcheck source=scripts/dev/container_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/container_common.sh"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB=medbrains-kiwi-db
APP=medbrains-kiwi

case "${1:-}" in
  start)
    require_container
    if ! resume_container "$DB"; then
      container run -d --name "$DB" \
        -e MYSQL_ROOT_PASSWORD=kiwi -e MYSQL_DATABASE=kiwi \
        -e MYSQL_USER=kiwi -e MYSQL_PASSWORD=kiwi \
        -v medbrains-kiwi-dbdata:/var/lib/mysql \
        mariadb:11 >/dev/null
    fi
    for _ in $(seq 1 60); do
      container exec "$DB" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1 && break
      sleep 1
    done
    db_ip="$(container_ip "$DB")" || die "no IP for $DB"
    # The DB IP can change across restarts, so the app is recreated each start.
    remove_container "$APP" >/dev/null
    container run -d --name "$APP" \
      -p 127.0.0.1:9080:8080 \
      -e KIWI_DB_HOST="$db_ip" -e KIWI_DB_PORT=3306 -e KIWI_DB_NAME=kiwi \
      -e KIWI_DB_USER=kiwi -e KIWI_DB_PASSWORD=kiwi \
      -v medbrains-kiwi-uploads:/Kiwi/uploads \
      --mount "type=bind,source=$ROOT_DIR/infra/local/kiwi-proxy-tls.py,target=/venv/lib64/python3.11/site-packages/tcms_settings_dir/zz_proxy_tls.py,readonly" \
      --mount "type=bind,source=$ROOT_DIR/infra/local/kiwi-nginx.conf,target=/Kiwi/etc/nginx.conf,readonly" \
      kiwitcms/kiwi:latest >/dev/null
    echo "$APP: http://127.0.0.1:9080 (db $db_ip)" ;;
  stop)
    remove_container "$APP"
    remove_container "$DB" ;;
  *) die "usage: $0 start|stop" ;;
esac
