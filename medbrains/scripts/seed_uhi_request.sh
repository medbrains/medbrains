#!/usr/bin/env bash
# A blood request from a patient's app, waiting in the UHI queue, for the
# native staff journeys.
#
# A real request arrives signed by an app the UHI registry knows, which no
# device test can forge. This does the hospital's half through the real API
# (UHI settings saved and a signing key generated, left switched off if they
# were not set up) and writes the app's half — one pending blood request with
# a Beckn context — straight into the local dev database, then prints its id:
#
#   eval "$(scripts/seed_uhi_request.sh)"
#   TEST_RUNNER_UHI_REQUEST_ID=$UHI_REQUEST_ID xcodebuild test …
#   ./gradlew :app-staff:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.uhiRequestId=$UHI_REQUEST_ID
#
# Local and CI databases only: it refuses a base URL that is not loopback.
set -euo pipefail
BASE="${MEDBRAINS_BASE_URL:-http://127.0.0.1:3000}"
case "$BASE" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing non-local $BASE" >&2; exit 2 ;; esac
H=(-sf -H 'X-MedBrains-Client: mobile-staff' -H 'content-type: application/json')
TOKEN=$(curl "${H[@]}" -d '{"username":"admin","password":"admin123"}' "$BASE/api/auth/login" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
H+=(-H "authorization: Bearer $TOKEN")
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

TENANT=$(curl "${H[@]}" "$BASE/api/auth/me" | json "d.get('tenant_id') or d['user']['tenant_id']")
if [ "$(curl "${H[@]}" "$BASE/api/uhi/settings" | json "d['configured']")" != "True" ]; then
  curl "${H[@]}" -o /dev/null -X PUT "$BASE/api/uhi/settings" -d "{\"environment\":\"sandbox\",\"subscriber_id\":\"e2e-${TENANT:0:8}.medbrains\",\"unique_key_id\":\"e2e-key\",\"services\":[\"blood_bank\"],\"facility_id\":null,\"city_code\":null,\"is_active\":false}"
  curl "${H[@]}" -o /dev/null -X POST "$BASE/api/uhi/settings/keys"
fi

TXN=$(python3 -c "import uuid; print(uuid.uuid4())")
ID=$(docker compose exec -T postgres psql -U medbrains -d medbrains -v ON_ERROR_STOP=1 -qAt <<SQL | tail -1
SELECT set_config('app.tenant_id', '$TENANT', false);
INSERT INTO uhi_transactions (tenant_id, service, domain, transaction_id, last_message_id, last_action,
       bap_id, bap_uri, state, customer_name, customer_phone, order_details, payload)
VALUES ('$TENANT', 'blood_bank', 'nic2004:85111', '$TXN', '$TXN', 'confirm',
        'eua.e2e', 'http://127.0.0.1:9/eua', 'pending', 'UHI Patient E2E', '9000000001',
        '{"items":[{"quantity":{"count":2},"descriptor":{"name":"O+ packed red cells"}}]}',
        '{"context":{"domain":"nic2004:85111","action":"confirm","transaction_id":"$TXN","message_id":"$TXN","consumer_id":"eua.e2e","consumer_uri":"http://127.0.0.1:9/eua"}}')
RETURNING id;
SQL
)
echo "UHI_REQUEST_ID=$ID"
