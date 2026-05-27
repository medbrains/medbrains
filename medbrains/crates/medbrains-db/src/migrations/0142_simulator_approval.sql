-- Simulator run approval mode.
--
-- Profile gains an approval_mode (auto | manual). When manual, the engine
-- still inserts the synthetic rows (all carry is_dummy = true), but the
-- run is parked as `pending_approval` until a super_admin approves or
-- rejects it. Reject walks simulator_run_steps and deletes the target
-- rows by id, leaving an audit trail of the run + steps + final status.

ALTER TABLE public.simulator_runs
    ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'auto_committed';

ALTER TABLE public.simulator_runs
    DROP CONSTRAINT IF EXISTS simulator_runs_approval_status_check;

ALTER TABLE public.simulator_runs
    ADD CONSTRAINT simulator_runs_approval_status_check
    CHECK (approval_status IN ('auto_committed', 'pending_approval', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_simulator_runs_pending_approval
    ON public.simulator_runs (tenant_id, started_at DESC)
    WHERE approval_status = 'pending_approval';
