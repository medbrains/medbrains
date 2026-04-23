#!/usr/bin/env bash
# ── End-to-end test: simulated lab analyzer → device-ingest → lab_result ──
set -euo pipefail

API="http://127.0.0.1:3000/api"

echo "═══ MedBrains Device Ingest E2E Test ═══"
echo ""

# ── Step 1: Login + extract cookies and CSRF ──
echo "1. Logging in as admin..."
LOGIN_RESP=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c /tmp/mb_cookies.txt -D /tmp/mb_headers.txt)

CSRF=$(grep -i 'x-csrf-token\|csrf' /tmp/mb_cookies.txt 2>/dev/null | awk '{print $NF}' || true)
# Also try extracting from response body
if [ -z "$CSRF" ]; then
  CSRF=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("csrf_token",""))' 2>/dev/null || true)
fi

USER=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("user",{}).get("username","FAILED"))' 2>/dev/null || echo "FAILED")
echo "   Login: $USER | CSRF: ${CSRF:0:12}..."

AUTH_HEADERS=(-b /tmp/mb_cookies.txt -H "x-csrf-token: $CSRF")

# ── Step 2: Create device instance ──
echo "2. Creating device instance (Roche cobas 6000)..."
DEVICE_RESP=$(curl -s -X POST "$API/devices/instances" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADERS[@]}" \
  -d '{
    "adapter_code": "roche_cobas_6000",
    "name": "Test Lab Analyzer",
    "code": "TEST-COBAS-001",
    "hostname": "192.168.1.100",
    "port": 2575
  }')

DEVICE_ID=$(echo "$DEVICE_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)

if [ -z "$DEVICE_ID" ]; then
  echo "   Create failed: $(echo "$DEVICE_RESP" | head -c 200)"
  echo "   Trying to fetch existing..."
  DEVICE_LIST=$(curl -s "$API/devices/instances" "${AUTH_HEADERS[@]}")
  DEVICE_ID=$(echo "$DEVICE_LIST" | python3 -c 'import sys,json; ds=json.load(sys.stdin); print(ds[0]["id"] if ds else "")' 2>/dev/null || true)
fi

echo "   Device ID: ${DEVICE_ID:0:36}"

if [ -z "$DEVICE_ID" ]; then
  echo "   ERROR: No device available. Cannot continue."
  exit 1
fi

# ── Step 3: Send simulated HL7 lab result ──
echo "3. Sending simulated HL7 CBC result..."
INGEST_RESP=$(curl -s -X POST "$API/device-ingest/lab" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADERS[@]}" \
  -d "{
    \"device_instance_id\": \"${DEVICE_ID}\",
    \"protocol\": \"hl7_v2\",
    \"parsed_payload\": {
      \"message_type\": \"ORU^R01\",
      \"message_id\": \"MSG-TEST-$(date +%s)\",
      \"fields\": {
        \"MSH.9\": \"ORU^R01\",
        \"PID.3\": \"UH-2026-00001\",
        \"OBR.3\": \"S-2026-TEST-001\"
      }
    },
    \"mapped_data\": {
      \"identifiers\": {
        \"patient_id\": \"UH-2026-00001\",
        \"sample_barcode\": \"S-2026-TEST-001\"
      },
      \"fields\": {
        \"OBX.3\": \"WBC\",
        \"OBX.5\": \"8.2\",
        \"OBX.6\": \"10^3/uL\",
        \"OBX.7\": \"4.0-11.0\",
        \"OBX.8\": \"N\"
      }
    },
    \"processing_duration_ms\": 12
  }")

echo "   Response: $(echo "$INGEST_RESP" | python3 -c '
import sys, json
d = json.load(sys.stdin)
status = d.get("status", d.get("error", "unknown"))
msg_id = str(d.get("message_id", "?"))[:8]
routed = d.get("routed_entity_id")
print(f"status={status}, msg={msg_id}..., routed={routed}")
' 2>/dev/null || echo "$INGEST_RESP")"

# ── Step 4: Check messages ──
echo "4. Checking device messages..."
MSGS=$(curl -s "$API/devices/instances/$DEVICE_ID/messages" "${AUTH_HEADERS[@]}" 2>/dev/null || echo "[]")
MSG_COUNT=$(echo "$MSGS" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))' 2>/dev/null || echo "?")
echo "   Messages stored: $MSG_COUNT"

if [ "$MSG_COUNT" != "0" ] && [ "$MSG_COUNT" != "?" ]; then
  LAST_STATUS=$(echo "$MSGS" | python3 -c 'import sys,json; ms=json.load(sys.stdin); print(ms[0].get("processing_status","?") if ms else "none")' 2>/dev/null || echo "?")
  echo "   Latest message status: $LAST_STATUS"
fi

echo ""
echo "═══ Test Complete ═══"
echo "Note: Lab result routing requires a matching lab_order with"
echo "sample_barcode='S-2026-TEST-001'. Without it, message is stored"
echo "as 'mapped' for manual review."

rm -f /tmp/mb_cookies.txt /tmp/mb_headers.txt
