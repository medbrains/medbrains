#!/usr/bin/env bash
# A fresh patient for a native patient-app journey, with a sign-in code.
#
# A fixed test phone drifts: a run admits the patient, and every later run
# finds them in hospital, where no OPD visit can be opened. This registers a
# new patient through the real API, seeds their code (seed_portal_otp.sh),
# and prints the phone for the run:
#
#   PHONE=$(scripts/seed_portal_patient.sh 424242)
#   TEST_RUNNER_PORTAL_PHONE=$PHONE xcodebuild test …        # iOS
#   ./gradlew … -Pandroid.testInstrumentationRunnerArguments.portalPhone=$PHONE   # Android
set -euo pipefail
CODE="${1:?six-digit code}"
BASE="${MEDBRAINS_BASE_URL:-http://127.0.0.1:3000}"
PHONE="96$(date +%s | tail -c 9)"
TOKEN=$(curl -sf -H 'X-MedBrains-Client: mobile-staff' -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}' "$BASE/api/auth/login" |
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -sf -o /dev/null -H 'X-MedBrains-Client: mobile-staff' -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' "$BASE/api/patients" -d "{\"first_name\":\"Portal\",\"last_name\":\"Journey${PHONE: -4}\",\"gender\":\"female\",\"phone\":\"$PHONE\",\"date_of_birth\":\"1984-04-04\",\"is_dob_estimated\":false,\"registration_type\":\"new\",\"registration_source\":\"walk_in\",\"is_medico_legal\":false,\"is_vip\":false}"
"$(dirname "$0")/seed_portal_otp.sh" "$PHONE" "$CODE" >/dev/null
echo "$PHONE"
