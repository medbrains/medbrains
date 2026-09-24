#!/usr/bin/env bash
# Seed a patient-portal sign-in code for the native journeys.
#
# The server hashes every code (SHA-256) and hands the clear text only to the
# SMS outbox, which no API exposes — so a device test cannot learn it. Before a
# native patient journey runs, this writes one known, unused code for a phone
# on the DEFAULT tenant; the journey's "I already have a code" path enters it
# without asking for a new one (asking would retire this row).
#
#   scripts/seed_portal_otp.sh 9876500777 424242
set -euo pipefail
PHONE="${1:?phone}"; CODE="${2:?six-digit code}"
HASH=$(printf '%s' "$CODE" | shasum -a 256 | cut -d' ' -f1)
docker compose exec -T postgres psql -U medbrains -d medbrains -v ON_ERROR_STOP=1 -At <<SQL
UPDATE patient_portal_otps SET used_at = now()
 WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'DEFAULT') AND phone = '$PHONE' AND used_at IS NULL;
INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at)
 VALUES ((SELECT id FROM tenants WHERE code = 'DEFAULT'), '$PHONE', '$HASH', now() + interval '12 hours');
SELECT 'seeded ' || '$PHONE';
SQL
