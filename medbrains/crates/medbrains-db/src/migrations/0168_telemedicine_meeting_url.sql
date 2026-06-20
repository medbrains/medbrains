-- ============================================================
-- MedBrains schema — telemedicine multi-provider
-- A consult can run on Jitsi (auto room) OR an externally-created meeting
-- (Google Meet / Zoom / Teams) whose join link is stored here. `provider`
-- names the platform; `meeting_url`, when set, is the authoritative join link
-- (else the join URL is derived from the Jitsi base + room_id).
-- ============================================================

ALTER TABLE public.tele_consultations
    ADD COLUMN IF NOT EXISTS meeting_url text;
