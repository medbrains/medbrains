-- IRB / Ethics committee submission tracking (ticket #2989): the ethics-committee submissions for a
-- trial (initial, amendment, renewal, SAE report, closure) and their review outcome. Tenant RLS.

CREATE TABLE IF NOT EXISTS trial_irb_submissions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trial_id         uuid NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    submission_type  text NOT NULL DEFAULT 'initial',
    committee_name   text,
    reference_number text,
    submitted_date   date NOT NULL DEFAULT CURRENT_DATE,
    status           text NOT NULL DEFAULT 'submitted',
    decision_date    date,
    notes            text,
    submitted_by     uuid,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trial_irb_type_check CHECK (submission_type = ANY (ARRAY[
        'initial'::text, 'amendment'::text, 'renewal'::text, 'sae_report'::text, 'closure'::text
    ])),
    CONSTRAINT trial_irb_status_check CHECK (status = ANY (ARRAY[
        'submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'deferred'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_trial_irb_trial
    ON trial_irb_submissions (tenant_id, trial_id, submitted_date DESC);

ALTER TABLE trial_irb_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_irb_submissions_tenant_isolation ON trial_irb_submissions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER trial_irb_submissions_updated_at BEFORE UPDATE ON trial_irb_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
