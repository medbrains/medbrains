-- NHCX correlation tracking on claims + preauths.
--
-- When we submit a preauth/claim to NHCX we get back a `correlation_id`
-- (UUIDv4) that the gateway uses to route the eventual async response
-- back to us. We persist it on the local row so the webhook receiver
-- can find the right claim to update.

ALTER TABLE insurance_claims
    ADD COLUMN IF NOT EXISTS nhcx_correlation_id UUID,
    ADD COLUMN IF NOT EXISTS nhcx_api_call_id   UUID,
    ADD COLUMN IF NOT EXISTS nhcx_recipient_code TEXT,
    ADD COLUMN IF NOT EXISTS nhcx_response_payload JSONB,
    ADD COLUMN IF NOT EXISTS nhcx_response_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_insurance_claims_nhcx_correlation
    ON insurance_claims (nhcx_correlation_id)
    WHERE nhcx_correlation_id IS NOT NULL;

-- Same fields on prior_auth_requests (different table, same flow).
ALTER TABLE prior_auth_requests
    ADD COLUMN IF NOT EXISTS nhcx_correlation_id UUID,
    ADD COLUMN IF NOT EXISTS nhcx_api_call_id   UUID,
    ADD COLUMN IF NOT EXISTS nhcx_recipient_code TEXT,
    ADD COLUMN IF NOT EXISTS nhcx_response_payload JSONB,
    ADD COLUMN IF NOT EXISTS nhcx_response_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_prior_auth_nhcx_correlation
    ON prior_auth_requests (nhcx_correlation_id)
    WHERE nhcx_correlation_id IS NOT NULL;
