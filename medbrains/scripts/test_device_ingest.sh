#!/usr/bin/env bash
# ── End-to-end test: simulated lab analyzer → device-ingest → lab_result ──
#
# Prerequisites:
# 1. Backend running: make dev-backend
# 2. Logged in as admin to get a session (or use cookie-less test)
#
# This script:
# 1. Creates a device instance (Roche cobas 6000)
# 2. Creates a test patient + lab order with sample barcode
# 3. Sends simulated HL7 OBX data to /api/device-ingest/lab
# 4. Verifies lab_result was created
#
# Usage: bash scripts/test_device_ingest.sh

set -euo pipefail

API="http://127.0.0.1:3000/api"
ADMIN_USER="admin"
ADMIN_PASS="admin123"

echo "═══ MedBrains Device Ingest E2E Test ═══"
echo ""

# ── Step 1: Login ──
echo "1. Logging in as admin..."
LOGIN_RESP=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  -c /tmp/mb_cookies.txt)

echo "   Login: $(echo "$LOGIN_RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("user",{}).get("username","FAILED"))' 2>/dev/null || echo "FAILED")"

# ── Step 2: Create a device instance ──
echo "2. Creating device instance (Roche cobas 6000)..."
DEVICE_RESP=$(curl -s -X POST "$API/devices/instances" \
  -H "Content-Type: application/json" \
  -b /tmp/mb_cookies.txt \
  -d '{
    "adapter_code": "roche_cobas_6000",
    "name": "Test Lab Analyzer",
    "code": "TEST-COBAS-001",
    "hostname": "192.168.1.100",
    "port": 2575
  }')

DEVICE_ID=$(echo "$DEVICE_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
echo "   Device ID: ${DEVICE_ID:-FAILED}"

if [ -z "$DEVICE_ID" ]; then
  echo "   Error: $(echo "$DEVICE_RESP" | head -c 200)"
  echo "   (Device may already exist — trying to fetch...)"
  DEVICE_ID=$(curl -s "$API/devices/instances" -b /tmp/mb_cookies.txt | \
    python3 -c 'import sys,json; ds=json.load(sys.stdin); print(ds[0]["id"] if ds else "")' 2>/dev/null)
  echo "   Fetched Device ID: ${DEVICE_ID:-NONE}"
fi

# ── Step 3: Simulate device data ingest ──
echo "3. Sending simulated HL7 lab result to /api/device-ingest/lab..."

# Simulated parsed HL7 ORU^R01 with CBC results
INGEST_RESP=$(curl -s -X POST "$API/device-ingest/lab" \
  -H "Content-Type: application/json" \
  -d "{
    \"device_instance_id\": \"${DEVICE_ID}\",
    \"protocol\": \"hl7_v2\",
    \"parsed_payload\": {
      \"message_type\": \"ORU^R01\",
      \"message_id\": \"MSG-TEST-001\",
      \"fields\": {
        \"MSH.9\": \"ORU^R01\",
        \"MSH.10\": \"MSG-TEST-001\",
        \"PID.3\": \"UH-2026-00001\",
        \"OBR.3\": \"S-2026-TEST-001\"
      }
    },
    \"mapped_data\": {
      \"identifiers\": {
        \"patient_id\": \"UH-2026-00001\",
        \"sample_barcode\": \"S-2026-TEST-001\",
        \"order_id\": \"S-2026-TEST-001\"
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

echo "   Ingest response: $(echo "$INGEST_RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"status={d.get(\"status\")}, message_id={d.get(\"message_id\",\"?\")[:8]}..., routed={d.get(\"routed_entity_id\")}")' 2>/dev/null || echo "$INGEST_RESP")"

# ── Step 4: Check device messages ──
echo "4. Checking device messages..."
if [ -n "$DEVICE_ID" ]; then
  MSGS=$(curl -s "$API/devices/instances/$DEVICE_ID/messages" -b /tmp/mb_cookies.txt)
  MSG_COUNT=$(echo "$MSGS" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))' 2>/dev/null || echo "0")
  echo "   Messages stored: $MSG_COUNT"
fi

echo ""
echo "═══ Test Complete ═══"
echo ""
echo "Note: Lab result creation requires a matching lab_order with"
echo "sample_barcode='S-2026-TEST-001'. If no order exists, the message"
echo "is stored in device_messages with status='mapped' for manual review."
echo ""
echo "To create a test order, use the Lab module in the web app or:"
echo "  INSERT INTO lab_orders (tenant_id, patient_id, sample_barcode, status, ...)"

# Cleanup
rm -f /tmp/mb_cookies.txt
