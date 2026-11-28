#!/usr/bin/env bash
# shellcheck disable=SC2015 # ok/bad always return 0, so A && ok || bad is if/else
# Runnable check for backup-key.sh: the key install.sh makes is post-quantum,
# private 0600, never replaced; a supplied classic key works but is warned;
# a mixed file is refused. Needs age 1.3+ (age-keygen -pq).
#   bash deploy/standalone/test-backup-key.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./backup-key.sh
. "$HERE/backup-key.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }
age_has_pq || { echo "SKIP: this age has no -pq (needs 1.3+)"; exit 0; }
mode() { stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1"; }

# 1. First install, no key given: a post-quantum pair, private half 0600.
R="$TMP/a/recipients.txt" I="$TMP/a/identity.txt"
mkdir -p "$TMP/a"
out="$(setup_backup_key "$R" "$I" "" 2>&1)"; rc=$?
[[ $rc -eq 0 && "$(head -c 7 "$R")" == age1pq1 ]] && ok "makes a post-quantum public key (age1pq1…)" || bad "pq public key (rc=$rc): $out"
grep -q '^AGE-SECRET-KEY-PQ-1' "$I" && ok "identity is a post-quantum secret key" || bad "pq identity"
[[ "$(mode "$I")" == 600 && "$(mode "$R")" == 644 ]] && ok "identity 0600, recipients 0644" || bad "modes $(mode "$I")/$(mode "$R")"
[[ "$out" != *WARNING* && "$out" == *"shred -u $I"* ]] && ok "says to move the key offline, no classic warning" || bad "first-install output: $out"

# 2. Seal and open round trip, and the header names the hybrid recipient.
echo "invented record 0001" | age -R "$R" > "$TMP/x.age"
[[ "$(sed -n 2p "$TMP/x.age")" == "-> mlkem768x25519 "* ]] && ok "header stanza is mlkem768x25519" || bad "header: $(sed -n 2p "$TMP/x.age")"
[[ "$(age -d -i "$I" "$TMP/x.age")" == "invented record 0001" ]] && ok "the pq identity opens it" || bad "pq round trip"
age-keygen -pq -o "$TMP/wrong.txt" 2>/dev/null
age -d -i "$TMP/wrong.txt" "$TMP/x.age" >/dev/null 2>&1 && bad "wrong key opened it" || ok "the wrong key is refused"

# 3. A re-run keeps the key; a lost public half is re-derived, never replaced.
before="$(cat "$R" "$I")"
setup_backup_key "$R" "$I" "" >/dev/null 2>&1
[[ "$(cat "$R" "$I")" == "$before" ]] && ok "re-run keeps the same key" || bad "re-run changed the key"
rm "$R"
setup_backup_key "$R" "$I" "" >/dev/null 2>&1
[[ "$(cat "$R" "$I")" == "$before" ]] && ok "lost public key re-derived from the identity" || bad "re-derive"

# 4. A supplied classic key still works, with a loud warning.
age-keygen -o "$TMP/classic.txt" 2>/dev/null
out="$(setup_backup_key "$R" "$I" "$(age-keygen -y "$TMP/classic.txt")" 2>&1)"; rc=$?
[[ $rc -eq 0 && "$out" == *"WARNING: backups are sealed to a CLASSIC key"* ]] && ok "classic key accepted, warned" || bad "classic (rc=$rc): $out"
[[ "$(backup_recipients_kind "$R")" == classic ]] && ok "kind: classic" || bad "kind classic"

# 5. A supplied pq key: no warning. Mixed with a classic one: refused.
out="$(setup_backup_key "$R" "$I" "$(age-keygen -y "$TMP/wrong.txt")" 2>&1)"; rc=$?
[[ $rc -eq 0 && "$out" != *WARNING* && "$(backup_recipients_kind "$R")" == pq ]] && ok "supplied pq key, no warning" || bad "pq supplied: $out"
mixed="$(age-keygen -y "$TMP/wrong.txt")"$'\n'"$(age-keygen -y "$TMP/classic.txt")"
out="$(setup_backup_key "$R" "$I" "$mixed" 2>&1)"; rc=$?
[[ $rc -ne 0 && "$out" == *"cannot mix"* ]] && ok "pq + classic in one file: refused" || bad "mixed (rc=$rc): $out"

exit "$fail"
