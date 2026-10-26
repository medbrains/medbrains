-- ====================================================================
-- Migration: 1226_ot_consent_flag_backfill.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- OT bookings whose consent was linked before linking set the flag.
--
-- Linking a signed consent to a booking never set ot_bookings.consent_obtained
-- (only unlinking touched it), so bookings consented through the Consent panel
-- still show "consent pending". The handler now sets it when the link closes
-- the gap; this marks the bookings already in that state, by the same rule
-- (medbrains-ot consent.rs): a valid signed surgical or procedure consent of
-- this patient, plus an anaesthesia consent when an anaesthetist is booked.
-- It only ever sets the flag, never clears one somebody set.

UPDATE ot_bookings b
   SET consent_obtained = true
 WHERE b.deleted_at IS NULL
   AND NOT b.consent_obtained
   AND EXISTS (
       SELECT 1 FROM procedure_consents pc
        WHERE pc.ot_booking_id = b.id AND pc.tenant_id = b.tenant_id
          AND pc.patient_id = b.patient_id
          AND pc.consent_type IN ('surgery', 'procedure')
          AND pc.status = 'signed' AND pc.withdrawn_at IS NULL AND pc.deleted_at IS NULL
          AND (pc.expires_at IS NULL OR pc.expires_at > now()))
   AND (
       (b.anesthetist_id IS NULL AND b.anesthesiologist_id IS NULL)
       OR EXISTS (
           SELECT 1 FROM procedure_consents pc
            WHERE pc.ot_booking_id = b.id AND pc.tenant_id = b.tenant_id
              AND pc.patient_id = b.patient_id
              AND pc.consent_type = 'anesthesia'
              AND pc.status = 'signed' AND pc.withdrawn_at IS NULL AND pc.deleted_at IS NULL
              AND (pc.expires_at IS NULL OR pc.expires_at > now())));
