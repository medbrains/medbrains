-- ====================================================================
-- Migration: 1107_aadhaar_not_recoverable.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Stop holding Aadhaar numbers in a form that gives them back.
--
-- patient_identifiers.id_number_hash for Aadhaar was SHA-256 of
-- "tenant:aadhaar:digits" — about 10^11 candidates, reversible in minutes.
-- New rows carry a keyed HMAC (key in the secret store). The old values
-- cannot be re-keyed without the number, so they are cleared: those
-- patients simply are not matched by Aadhaar until it is entered again.
--
-- employees.aadhaar_number held the whole number; it is masked to the last
-- four digits, which is all HR needs to recognise the card.

UPDATE public.patient_identifiers
   SET id_number_hash = NULL
 WHERE id_type = 'aadhaar' AND id_number_hash IS NOT NULL;

UPDATE public.employees
   SET aadhaar_number = 'XXXX-XXXX-' || right(regexp_replace(aadhaar_number, '\D', '', 'g'), 4)
 WHERE aadhaar_number IS NOT NULL
   AND length(regexp_replace(aadhaar_number, '\D', '', 'g')) = 12;
