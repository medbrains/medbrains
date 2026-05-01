-- NHCX webhook receipt log.
--
-- Every callback the gateway delivers (preauth/on_submit, claim/on_submit,
-- coverageeligibility/on_check) is recorded here verbatim so operators can
-- audit what NHCX sent — independent of whether we successfully matched
-- the correlation_id to a local claim/preauth row.
--
-- Schema: keep the raw envelope, the decrypted payload, and the matched
-- target (if any). Verification result is stored so we can spot tampered
-- callbacks during a post-mortem.

CREATE TABLE IF NOT EXISTS nhcx_callback_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id UUID,
    api_call_id UUID,
    sender_code TEXT,
    recipient_code TEXT,
    callback_type TEXT,                     -- preauth.on_submit, claim.on_submit, etc.
    raw_envelope JSONB,                     -- the JWE/JWS envelope as received
    decrypted_payload JSONB,                -- payload after JWE decrypt + JWS verify
    verification_status TEXT NOT NULL DEFAULT 'unverified',
                                            -- unverified / verified / signature_invalid /
                                            -- decrypt_failed / unknown_correlation
    matched_table TEXT,                     -- 'insurance_claims' or 'prior_auth_requests'
    matched_id UUID,
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nhcx_callback_log_tenant
    ON nhcx_callback_log (tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_nhcx_callback_log_correlation
    ON nhcx_callback_log (correlation_id)
    WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nhcx_callback_log_match
    ON nhcx_callback_log (matched_table, matched_id)
    WHERE matched_id IS NOT NULL;
