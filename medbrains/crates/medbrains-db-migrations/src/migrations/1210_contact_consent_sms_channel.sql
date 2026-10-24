-- ====================================================================
-- Migration: 1210_contact_consent_sms_channel.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A patient may say "don't text me".
--
-- 1019 left SMS out because a service message needs no opt-in. It still
-- needs a way out: the token-call text is a convenience, not the record of
-- the visit, and under the DPDP Act 2023 withdrawing has to be as easy as it
-- was to give. So `sms` is a channel too, with the opposite default: no row
-- means allowed, the newest row with granted = false means withdrawn.

ALTER TABLE patient_contact_consents
    DROP CONSTRAINT IF EXISTS patient_contact_consents_channel_check;
ALTER TABLE patient_contact_consents
    ADD CONSTRAINT patient_contact_consents_channel_check
    CHECK (channel IN ('whatsapp', 'email', 'sms'));
