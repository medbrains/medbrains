-- TPA bank-statement reconciliation extensions.
--
-- bank_transactions today only matches to patient `payments` rows.
-- TPA settlements arrive as bulk credits naming the payer (TPA name)
-- in the description, often referencing one or more claim_numbers
-- in the narrative. We need to match those credits to one or more
-- insurance_claims, and surface variance when settled < approved.

ALTER TABLE bank_transactions
    ADD COLUMN IF NOT EXISTS matched_claim_id UUID REFERENCES insurance_claims(id),
    ADD COLUMN IF NOT EXISTS variance_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS auto_match_score REAL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_claim
    ON bank_transactions (matched_claim_id)
    WHERE matched_claim_id IS NOT NULL;

-- One bank credit can settle multiple claim_numbers (TPA bulk
-- settlements). Track the breakdown so audit can prove every paisa.
CREATE TABLE IF NOT EXISTS bank_transaction_claim_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    claim_id UUID NOT NULL REFERENCES insurance_claims(id),
    allocated_amount NUMERIC(12,2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bank_transaction_id, claim_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_alloc_tenant
    ON bank_transaction_claim_allocations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_alloc_claim
    ON bank_transaction_claim_allocations (claim_id);

-- Aging materialised on demand via the /aging endpoint; no view needed.
