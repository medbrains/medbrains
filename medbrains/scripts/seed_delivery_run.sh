#!/usr/bin/env bash
# A delivery out with a fresh runner, for the native staff journeys.
#
# The patient's delivery code goes only to their phone (the SMS outbox), which
# no API exposes, so a device test cannot learn it. This does what the
# pharmacy does — a patient, a dispensed order, a runner, a paid bill, a
# dispatched delivery — through the real API, reads the code from the outbox
# as the patient's phone would, and prints the run's values:
#
#   eval "$(scripts/seed_delivery_run.sh)"
#   TEST_RUNNER_RUNNER_USER=$RUNNER_USER TEST_RUNNER_RUNNER_PASS=$RUNNER_PASS \
#   TEST_RUNNER_DELIVERY_ID=$DELIVERY_ID TEST_RUNNER_DELIVERY_CODE=$DELIVERY_CODE xcodebuild test …
set -euo pipefail
BASE="${MEDBRAINS_BASE_URL:-http://127.0.0.1:3000}"
RUN="$(date +%s | tail -c 7)"
H=(-sf -H 'X-MedBrains-Client: mobile-staff' -H 'content-type: application/json')
TOKEN=$(curl "${H[@]}" -d '{"username":"admin","password":"admin123"}' "$BASE/api/auth/login" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
H+=(-H "authorization: Bearer $TOKEN")
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

PATIENT=$(curl "${H[@]}" "$BASE/api/patients" -d "{\"first_name\":\"Delivery\",\"last_name\":\"Run$RUN\",\"gender\":\"female\",\"phone\":\"95$(date +%s | tail -c 9)\",\"date_of_birth\":\"1980-03-03\",\"is_dob_estimated\":false,\"registration_type\":\"new\",\"registration_source\":\"walk_in\",\"is_medico_legal\":false,\"is_vip\":false}" | json "d['id']")
DRUG=$(curl "${H[@]}" "$BASE/api/pharmacy/catalog" | json "next(c['id']+'|'+c['name'] for c in d if c['is_active'] and not c['is_controlled'] and not c.get('needs_cold_chain') and (c.get('drug_schedule') or '') not in ('X','H1','NDPS') and float(c['current_stock'])>=10)")
ORDER=$(curl "${H[@]}" "$BASE/api/pharmacy/orders" -d "{\"patient_id\":\"$PATIENT\",\"dispensing_type\":\"prescription\",\"safety_override_reason\":\"native delivery run\",\"items\":[{\"catalog_item_id\":\"${DRUG%%|*}\",\"drug_name\":\"${DRUG#*|}\",\"quantity\":2,\"unit_price\":10}]}" | json "d['order']['id']")
curl "${H[@]}" -o /dev/null -X PUT "$BASE/api/pharmacy/orders/$ORDER/dispense" -d '{"unpaid_override_reason":"native delivery run"}'

RUNNER_USER="runner_$RUN"; RUNNER_PASS="Runner#${RUN}Aa9"
curl "${H[@]}" -o /dev/null "$BASE/api/setup/users" -d "{\"username\":\"$RUNNER_USER\",\"email\":\"$RUNNER_USER@example.test\",\"password\":\"$RUNNER_PASS\",\"full_name\":\"Runner $RUN\",\"role\":\"delivery_runner\"}"
RUNNER_ID=$(curl "${H[@]}" "$BASE/api/pharmacy/delivery-runners" | json "next(r['id'] for r in d if r['full_name']=='Runner $RUN')")
DELIVERY=$(curl "${H[@]}" "$BASE/api/pharmacy/deliveries" -d "{\"order_id\":\"$ORDER\",\"mode\":\"runner\",\"payment\":\"prepaid\",\"address\":\"12 Lake Road, Karaikudi\",\"pincode\":\"630001\",\"contact_phone\":\"9000000$RUN\",\"runner_id\":\"$RUNNER_ID\"}" | json "d['id']")

# Prepaid: the counter takes payment before it leaves.
INVOICE=$(curl "${H[@]}" "$BASE/api/pharmacy/orders/$ORDER" | json "d.get('billing_invoice_id') or ''")
if [ -n "$INVOICE" ]; then
  curl "${H[@]}" -o /dev/null -X POST "$BASE/api/billing/invoices/$INVOICE/issue" -d '{}'
  OWED=$(curl "${H[@]}" "$BASE/api/billing/invoices/$INVOICE" | json "float(d['invoice']['total_amount'])-float(d['invoice']['paid_amount'])")
  curl "${H[@]}" -o /dev/null "$BASE/api/billing/invoices/$INVOICE/payments" -d "{\"amount\":$OWED,\"mode\":\"cash\",\"notes\":\"native delivery run\"}"
fi
curl "${H[@]}" -o /dev/null -X POST "$BASE/api/pharmacy/deliveries/$DELIVERY/dispatch" -d '{}'

CODE=$(docker compose exec -T postgres psql -U medbrains -d medbrains -At -c \
  "SELECT substring(payload->>'body' from '[0-9]{6}') FROM outbox_events WHERE event_type = 'sms.pharmacy_delivery_code' AND aggregate_id = '$DELIVERY' ORDER BY created_at DESC LIMIT 1")
echo "RUNNER_USER=$RUNNER_USER"
echo "RUNNER_PASS='$RUNNER_PASS'"
echo "DELIVERY_ID=$DELIVERY"
echo "DELIVERY_CODE=$CODE"
