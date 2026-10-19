-- ====================================================================
-- Migration: 1123_nhcx_claim_attachments.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- An NHCX final claim carries its documents as PDFs: the discharge summary,
-- the final itemised bill, the stay's investigation reports and whatever the
-- desk attached. What went with the last message — and what was left out and
-- why (too large, over the payload cap) — is kept on the claim, so the desk
-- can see what the payer was given without reopening the encrypted bundle.
-- Shape: { "attached": [{kind, title, source, id, size_bytes}],
--          "left_out": [{kind, title, reason}] }

ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS nhcx_attachments jsonb;
