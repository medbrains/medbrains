#!/usr/bin/env bash
# End-to-end proof that an API key works, and — more importantly — that it
# cannot do the things it must not.
#
#   scripts/verify_api_key_e2e.sh            # against a running dev server
#   BASE=http://127.0.0.1:3000 scripts/verify_api_key_e2e.sh
#
# Every other layer of this feature is tested in isolation: the SQL is checked
# against the live schema, the mint rules have unit tests, the middleware has
# its own. None of that proves the pieces are wired to each other, which is the
# only thing that matters to somebody holding a key.
#
# The negative cases are the point. A key that works is easy; a key that
# correctly refuses the session surface, refuses a permission it was not
# granted, and stops the instant it is revoked is the actual feature.

set -uo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
ADMIN_USER="${E2E_BOOTSTRAP_ADMIN_USER:-admin}"
ADMIN_PASS="${E2E_BOOTSTRAP_ADMIN_PASS:-admin123}"
PSQL=(docker compose exec -T postgres psql -U medbrains -d medbrains -At)

pass=0
fail=0

check() { # check <description> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    printf '  ok    %-58s %s\n' "$1" "$3"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-58s expected %s, got %s\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

status_with_key() { # status_with_key <method> <path>
  curl -s -o /dev/null -w '%{http_code}' -X "$1" \
    -H "Authorization: Bearer ${SECRET}" "${BASE}$2"
}

echo "== server"
health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${BASE}/api/health" || echo 000)
if [[ "$health" != "200" ]]; then
  echo "  no server at ${BASE} (health returned ${health}) — start it first"
  exit 1
fi
echo "  up at ${BASE}"

echo "== sign in as the bootstrap admin"
login=$(curl -s -X POST "${BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Medbrains-Client: mobile' \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}")
TOKEN=$(printf '%s' "$login" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token") or "")' 2>/dev/null)
if [[ -z "$TOKEN" ]]; then
  echo "  could not sign in: $(printf '%s' "$login" | head -c 200)"
  exit 1
fi
echo "  signed in"

echo "== issue a key granting exactly one permission"
created=$(curl -s -X POST "${BASE}/api/admin/api-keys" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"E2E verification","permissions":["patients.list"],"expires_in_days":1}')
SECRET=$(printf '%s' "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("secret") or "")' 2>/dev/null)
KEY_ID=$(printf '%s' "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id") or "")' 2>/dev/null)
ACTS_AS=$(printf '%s' "$created" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("acts_as") or "")' 2>/dev/null)
if [[ -z "$SECRET" ]]; then
  echo "  key was not issued: $(printf '%s' "$created" | head -c 300)"
  exit 1
fi
echo "  issued ${KEY_ID}, acting as ${ACTS_AS}"

echo "== the key does what it was granted"
check "granted permission is allowed" 200 "$(status_with_key GET /api/patients)"

echo "== the key cannot do what it was not granted"
# `admin.users.list` was never on this key. The shadow user's role must not
# supply it either — that is the whole reason a key carries an explicit list.
check "ungranted permission is refused" 403 "$(status_with_key GET /api/setup/users)"

echo "== the key cannot reach the human session surface"
check "/api/auth/me is closed to keys" 403 "$(status_with_key GET /api/auth/me)"
reason=$(curl -s -H "Authorization: Bearer ${SECRET}" "${BASE}/api/auth/me" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("detail") or d.get("error") or "")' 2>/dev/null)
case "$reason" in
  *"API key"*) printf '  ok    %-58s %s\n' "refusal explains why" "\"${reason:0:44}...\""; pass=$((pass + 1)) ;;
  *) printf '  FAIL  %-58s got %q\n' "refusal explains why" "$reason"; fail=$((fail + 1)) ;;
esac

echo "== the identity is a service account, and cannot sign in"
role=$("${PSQL[@]}" -c "SELECT role::text FROM users WHERE username = '${ACTS_AS}'" 2>/dev/null | tr -d '[:space:]')
check "shadow user holds the service role" "service_account" "$role"
hash_null=$("${PSQL[@]}" -c "SELECT password_hash IS NULL FROM users WHERE username = '${ACTS_AS}'" 2>/dev/null | tr -d '[:space:]')
check "shadow user has no password" "t" "$hash_null"
login_status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${ACTS_AS}\",\"password\":\"admin123\"}")
check "shadow user cannot sign in" 401 "$login_status"

echo "== usage was recorded"
usage=$("${PSQL[@]}" -c "SELECT count(*) FROM api_key_usage WHERE api_key_id = '${KEY_ID}'" 2>/dev/null | tr -d '[:space:]')
if [[ "${usage:-0}" -ge 3 ]]; then
  printf '  ok    %-58s %s rows\n' "requests are logged for forensics" "$usage"
  pass=$((pass + 1))
else
  printf '  FAIL  %-58s expected >=3 rows, got %s\n' "requests are logged for forensics" "${usage:-0}"
  fail=$((fail + 1))
fi

echo "== revocation stops it immediately"
curl -s -o /dev/null -X POST "${BASE}/api/admin/api-keys/${KEY_ID}/revoke" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"end of verification"}'
check "revoked key is refused" 401 "$(status_with_key GET /api/patients)"
inactive=$("${PSQL[@]}" -c "SELECT NOT is_active FROM users WHERE username = '${ACTS_AS}'" 2>/dev/null | tr -d '[:space:]')
check "its identity was deactivated too" "t" "$inactive"

echo
echo "${pass} passed, ${fail} failed"
[[ "$fail" -eq 0 ]]
