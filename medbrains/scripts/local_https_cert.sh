#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/var/local-https"
DOMAIN="${DEV_HTTPS_DOMAIN:-medbrains.localhost}"
ALT_DOMAINS="${DEV_HTTPS_ALT_DOMAINS:-medbrains-desktop.localhost,medbrains-simulator.localhost,medbrains-icd.localhost}"
CERT_PATH="$CERT_DIR/$DOMAIN.pem"
KEY_PATH="$CERT_DIR/$DOMAIN-key.pem"

mkdir -p "$CERT_DIR"

find_mkcert() {
  local candidate
  for candidate in "${MKCERT_BIN:-}" /opt/homebrew/bin/mkcert /usr/local/bin/mkcert mkcert; do
    [[ -z "$candidate" ]] && continue
    if ! command -v "$candidate" >/dev/null 2>&1; then
      continue
    fi
    candidate="$(command -v "$candidate")"
    if "$candidate" -CAROOT >/dev/null 2>&1; then
      printf "%s\n" "$candidate"
      return 0
    fi
  done
  return 1
}

trust_ios_simulator_cert() {
  if [[ "${DEV_HTTPS_TRUST_IOS_SIMULATOR:-true}" != "true" ]]; then
    return
  fi
  if ! command -v xcrun >/dev/null 2>&1; then
    return
  fi

  local devices
  devices="$(xcrun simctl list devices booted 2>/dev/null | awk -F'[()]' '/Booted/{print $2}')"
  if [[ -z "$devices" ]]; then
    return
  fi

  local trust_cert="$CERT_PATH"
  local mkcert_bin
  if mkcert_bin="$(find_mkcert)"; then
    local mkcert_caroot
    mkcert_caroot="$("$mkcert_bin" -CAROOT 2>/dev/null || true)"
    if [[ -n "$mkcert_caroot" && -f "$mkcert_caroot/rootCA.pem" ]]; then
      trust_cert="$mkcert_caroot/rootCA.pem"
    fi
  fi

  while IFS= read -r device; do
    [[ -z "$device" ]] && continue
    if xcrun simctl keychain "$device" add-root-cert "$trust_cert" >/dev/null 2>&1; then
      echo "trusted local HTTPS cert in iOS simulator: $device"
    else
      echo "warning: could not trust local HTTPS cert in iOS simulator: $device" >&2
    fi
  done <<<"$devices"
}

cert_has_all_names() {
  if [[ ! -f "$CERT_PATH" || ! -f "$KEY_PATH" ]]; then
    return 1
  fi

  if ! command -v openssl >/dev/null 2>&1; then
    return 0
  fi

  local cert_text
  cert_text="$(openssl x509 -in "$CERT_PATH" -noout -text 2>/dev/null || true)"
  [[ "$cert_text" == *"DNS:$DOMAIN"* ]] || return 1

  local alt_domain
  IFS=',' read -ra alt_domain_list <<<"$ALT_DOMAINS"
  for alt_domain in "${alt_domain_list[@]}"; do
    alt_domain="$(echo "$alt_domain" | xargs)"
    [[ -z "$alt_domain" ]] && continue
    [[ "$cert_text" == *"DNS:$alt_domain"* ]] || return 1
  done

  return 0
}

if cert_has_all_names; then
  echo "local HTTPS cert already exists: $CERT_PATH"
  trust_ios_simulator_cert
  exit 0
fi

if [[ -f "$CERT_PATH" || -f "$KEY_PATH" ]]; then
  echo "local HTTPS cert exists but is missing required SANs; regenerating: $CERT_PATH"
  rm -f "$CERT_PATH" "$KEY_PATH"
fi

mkcert_names=("$DOMAIN" localhost 127.0.0.1 ::1)
openssl_sans="DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1,IP:::1"
IFS=',' read -ra alt_domain_list <<<"$ALT_DOMAINS"
for alt_domain in "${alt_domain_list[@]}"; do
  alt_domain="$(echo "$alt_domain" | xargs)"
  [[ -z "$alt_domain" ]] && continue
  mkcert_names+=("$alt_domain")
  openssl_sans="$openssl_sans,DNS:$alt_domain"
done

if mkcert_bin="$(find_mkcert)"; then
  echo "Using mkcert for trusted local HTTPS certificates."
  "$mkcert_bin" -install
  "$mkcert_bin" -cert-file "$CERT_PATH" -key-file "$KEY_PATH" "${mkcert_names[@]}"
else
  echo "mkcert not found; generating a self-signed cert with openssl."
  echo "Browsers/devices will show a trust warning until this cert or CA is trusted."
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -subj "/CN=$DOMAIN" \
    -addext "subjectAltName=$openssl_sans"
fi

echo "cert: $CERT_PATH"
echo "key:  $KEY_PATH"
trust_ios_simulator_cert
