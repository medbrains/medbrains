#!/usr/bin/env bash
# Two ABDM Scan & Share entries in today's queue, for the native staff journeys.
#
# A share arrives only as a gateway-signed callback from ABDM, which no test
# device can forge, so this writes the two rows the callback would have
# written: one whose ABHA already belongs to a patient here (Compare and
# link), one for a person new to the hospital (Register). The matched patient
# is registered through the real API. Prints the run's values:
#
#   eval "$(scripts/seed_scan_share.sh)"
#   TEST_RUNNER_SHARE_MATCHED=$SHARE_MATCHED TEST_RUNNER_SHARE_NEW=$SHARE_NEW \
#   TEST_RUNNER_SHARE_MATCHED_ID=$SHARE_MATCHED_ID TEST_RUNNER_SHARE_NEW_ID=$SHARE_NEW_ID \
#     xcodebuild test -only-testing:MedBrainsStaffUITests/AbdmDeskJourneyTests …
#   ./gradlew :app-staff:connectedDebugAndroidTest \
#     -Pandroid.testInstrumentationRunnerArguments.class=com.medbrains.staff.AbdmDeskJourneyTest \
#     -Pandroid.testInstrumentationRunnerArguments.shareMatched=$SHARE_MATCHED \
#     -Pandroid.testInstrumentationRunnerArguments.shareNew=$SHARE_NEW \
#     -Pandroid.testInstrumentationRunnerArguments.shareMatchedId=$SHARE_MATCHED_ID \
#     -Pandroid.testInstrumentationRunnerArguments.shareNewId=$SHARE_NEW_ID
#
# Needs a server with the Scan & Share routes and a facility in the admin's hospital.
set -euo pipefail
BASE="${MEDBRAINS_BASE_URL:-http://127.0.0.1:3000}"
RUN="$(date +%s | tail -c 7)"
H=(-sf -H 'X-MedBrains-Client: mobile-staff' -H 'content-type: application/json')
TOKEN=$(curl "${H[@]}" -d '{"username":"admin","password":"admin123"}' "$BASE/api/auth/login" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
H+=(-H "authorization: Bearer $TOKEN")
psql_run() { docker compose exec -T postgres psql -U medbrains -d medbrains -At -v ON_ERROR_STOP=1 -c "$1"; }

MATCHED="Sharematch$RUN"
NEW="Sharenew$RUN"
PATIENT=$(curl "${H[@]}" "$BASE/api/patients" -d "{\"first_name\":\"Ravi\",\"last_name\":\"$MATCHED\",\"gender\":\"male\",\"phone\":\"94$(date +%s | tail -c 9)\",\"date_of_birth\":\"1984-02-11\",\"is_dob_estimated\":false,\"registration_type\":\"new\",\"registration_source\":\"walk_in\",\"is_medico_legal\":false,\"is_vip\":false}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

share() { # last name, ABHA number, patient id or NULL, token
  psql_run "INSERT INTO abdm_profile_shares (tenant_id, facility_id, request_id, abha_number, abha_address, profile, patient_id, token_number, expires_at)
    SELECT u.tenant_id, f.id, 'native-e2e-' || gen_random_uuid(), '$2', lower('$1') || '@sbx',
           jsonb_build_object('abha_number', '$2', 'abha_address', lower('$1') || '@sbx', 'first_name', 'Ravi', 'last_name', '$1',
                              'gender', 'male', 'date_of_birth', '1984-02-11', 'mobile', '9000000000'),
           $3, '$4', date_trunc('day', now()) + interval '1 day' - interval '1 second'
      FROM users u JOIN facilities f ON f.tenant_id = u.tenant_id AND f.deleted_at IS NULL
     WHERE u.username = 'admin' LIMIT 1 RETURNING id" | head -1
}
MATCHED_ID=$(share "$MATCHED" "91${RUN}000001" "'$PATIENT'::uuid" "S-${RUN: -3}1")
NEW_ID=$(share "$NEW" "91${RUN}000002" "NULL" "S-${RUN: -3}2")
[ -n "$MATCHED_ID" ] && [ -n "$NEW_ID" ] || { echo "no facility for the admin's hospital: create one first" >&2; exit 1; }
echo "SHARE_MATCHED=$MATCHED"
echo "SHARE_NEW=$NEW"
echo "SHARE_MATCHED_ID=$MATCHED_ID"
echo "SHARE_NEW_ID=$NEW_ID"
