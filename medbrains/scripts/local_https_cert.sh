#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/var/local-https"
DOMAIN="${DEV_HTTPS_DOMAIN:-medbrains.localhost}"
CERT_PATH="$CERT_DIR/$DOMAIN.pem"
KEY_PATH="$CERT_DIR/$DOMAIN-key.pem"

mkdir -p "$CERT_DIR"

if [[ -f "$CERT_PATH" && -f "$KEY_PATH" ]]; then
  echo "local HTTPS cert already exists: $CERT_PATH"
  exit 0
fi

if command -v mkcert >/dev/null 2>&1; then
  echo "Using mkcert for trusted local HTTPS certificates."
  mkcert -install
  mkcert -cert-file "$CERT_PATH" -key-file "$KEY_PATH" "$DOMAIN" localhost 127.0.0.1 ::1
else
  echo "mkcert not found; generating a self-signed cert with openssl."
  echo "Browsers/devices will show a trust warning until this cert or CA is trusted."
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1,IP:::1"
fi

echo "cert: $CERT_PATH"
echo "key:  $KEY_PATH"
