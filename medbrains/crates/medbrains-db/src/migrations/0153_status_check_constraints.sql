-- CHECK constraints on free-text status columns (audit P1 #163) —
-- ONLY where every code write site was exhaustively verified against
-- the TypeScript contract. NOT VALID: existing rows are not scanned
-- (legacy values can't block the migration); all new writes are
-- enforced. The remaining ~69 unconstrained status columns are either
-- clinical free-text (must not be constrained) or need per-module
-- domain review — see issue #163.

ALTER TABLE public.credit_notes
    ADD CONSTRAINT credit_notes_status_check
    CHECK (status IN ('active', 'used', 'cancelled')) NOT VALID;

ALTER TABLE public.stock_transfers
    ADD CONSTRAINT stock_transfers_status_check
    CHECK (status IN ('requested', 'approved', 'dispatched', 'in_transit',
                      'received', 'cancelled')) NOT VALID;

-- 'submitted' is written by the secondary-claim path (billing.rs) and
-- predates the TS contract's 'claim_submitted' — kept until the drift
-- is reconciled (tracked separately).
ALTER TABLE public.insurance_claims
    ADD CONSTRAINT insurance_claims_status_check
    CHECK (status IN ('initiated', 'pre_auth_requested', 'pre_auth_approved',
                      'pre_auth_rejected', 'claim_submitted', 'claim_approved',
                      'claim_rejected', 'settled', 'partially_settled',
                      'submitted')) NOT VALID;
