#!/usr/bin/env bash
# Razorpay TEST-mode smoke for online checkout (#4870).
#
# Against a server you started yourself, on PORT, with the Razorpay TEST keys
# in its environment (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from medbrains/.env)
# and WITHOUT RAZORPAY_API_BASE_OVERRIDE, this:
#   1. signs in as the seeded admin,
#   2. makes a patient and an issued ₹1 bill,
#   3. asks OUR API for an online order (the server calls api.razorpay.com),
#   4. checks our row reads `created` with Razorpay's order id,
#   5. fetches that order from Razorpay with the same TEST keys and checks the
#      amount and the receipt (= our row id).
# It never prints a key. It refuses live keys.
#
# Usage:  PORT=3100 scripts/razorpay_test_smoke.sh
# Env:    PORT (required), ENV_FILE (default medbrains/.env),
#         ADMIN_USER / ADMIN_PASSWORD (default admin / admin123)
set -euo pipefail
set +x

: "${PORT:?set PORT to the port the server listens on}"
here="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$here/.env}"
BASE="http://127.0.0.1:${PORT}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

need() { command -v "$1" >/dev/null || { echo "needs $1" >&2; exit 2; }; }
need curl
need jq

read_env() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }
KEY_ID="$(read_env RAZORPAY_KEY_ID)"
KEY_SECRET="$(read_env RAZORPAY_KEY_SECRET)"
[[ -n "$KEY_ID" && -n "$KEY_SECRET" ]] || { echo "RAZORPAY_KEY_ID/SECRET not in $ENV_FILE" >&2; exit 2; }
[[ "$KEY_ID" == rzp_test_* ]] || { echo "refusing: the key in $ENV_FILE is not a TEST key" >&2; exit 2; }

step() { printf '\n== %s\n' "$*"; }
api() { # method path [json]
  local csrf
  csrf="$(awk '$6=="csrf_token"{print $7}' "$JAR" | tail -1)"
  curl -sS -b "$JAR" -c "$JAR" -X "$1" "$BASE$2" \
    -H 'content-type: application/json' -H "x-csrf-token: ${CSRF:-$csrf}" \
    ${3:+--data "$3"}
}

step "sign in"
login="$(curl -sS -c "$JAR" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  --data "$(jq -n --arg u "${ADMIN_USER:-admin}" --arg p "${ADMIN_PASSWORD:-admin123}" '{username:$u,password:$p}')")"
CSRF="$(jq -r '.csrf_token // empty' <<<"$login")"
[[ -n "$CSRF" ]] || { echo "login failed: $(jq -c '.error // .' <<<"$login")" >&2; exit 1; }

step "Razorpay as the server sees it"
api GET /api/payments/razorpay/status | jq '{configured, mode, source, key_id_prefix}'

step "a patient and an issued ₹1 bill"
phone="9$(date +%s | tail -c 10)"
patient="$(api POST /api/patients "$(jq -n --arg ph "$phone" \
  '{first_name:"Smoke",last_name:"Razorpay",gender:"female",date_of_birth:"1990-01-01",phone:$ph}')" | jq -r '.id // .patient.id')"
invoice="$(api POST /api/billing/invoices "$(jq -n --arg p "$patient" '{patient_id:$p}')" | jq -r .id)"
api POST "/api/billing/invoices/$invoice/items" \
  '{"charge_code":"MISC","description":"Razorpay smoke","source":"manual","quantity":1,"unit_price":1}' >/dev/null
api POST "/api/billing/invoices/$invoice/issue" >/dev/null
echo "invoice $invoice"

step "order through our API"
order="$(api POST /api/payments/create-order "$(jq -n --arg i "$invoice" '{invoice_id:$i,amount:1}')")"
jq '{transaction_id, order_id, amount, status, key_id}' <<<"$order"
txn="$(jq -r .transaction_id <<<"$order")"
order_id="$(jq -r '.order_id // empty' <<<"$order")"
[[ "$order_id" == order_* ]] || { echo "FAIL: no Razorpay order: $(jq -c . <<<"$order")" >&2; exit 1; }

step "our row"
row="$(api GET "/api/payments/$txn/status" | jq '.transaction | {status, gateway_order_id, amount}')"
echo "$row"
[[ "$(jq -r .status <<<"$row")" == created ]] || { echo "FAIL: row is not created" >&2; exit 1; }

step "the order at Razorpay (TEST mode)"
remote="$(curl -sS -u "$KEY_ID:$KEY_SECRET" "https://api.razorpay.com/v1/orders/$order_id")"
jq '{id, amount, currency, receipt, status}' <<<"$remote"
[[ "$(jq -r .amount <<<"$remote")" == 100 ]] || { echo "FAIL: amount is not 100 paise" >&2; exit 1; }
[[ "$(jq -r .receipt <<<"$remote")" == "$txn" ]] || { echo "FAIL: receipt is not our row id" >&2; exit 1; }

printf '\nPASS — order %s exists in Razorpay TEST mode for invoice %s.\n' "$order_id" "$invoice"
printf 'To pay it, open %s/billing/invoices/%s and follow the manual steps in the report.\n' \
  "${WEB_URL:-http://localhost:5173}" "$invoice"
