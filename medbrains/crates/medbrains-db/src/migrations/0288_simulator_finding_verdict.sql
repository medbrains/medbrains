-- RLS-Posture: tenant-scoped
-- Inherits the simulator_run_findings tenant policy.
-- Verifier + logic-finder support for agent findings.
--
-- `verdict` records an adversarial verification pass: objective failures (a
-- 5xx, a permission-denied) are auto-'confirmed'; subjective agent-reported
-- findings ('this screen confused me') are checked by a skeptical LLM verifier
-- and marked 'confirmed' / 'plausible' / 'rejected'. This separates real
-- defects from the agent misunderstanding the UI.
--
-- The `logic` kind is added for business-logic / validation failures (HTTP
-- 422/409 and effect-mismatches) — distinct from transport 'error's.

ALTER TABLE public.simulator_run_findings
    ADD COLUMN IF NOT EXISTS verdict text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.simulator_run_findings
    DROP CONSTRAINT IF EXISTS simulator_run_findings_kind_check;

ALTER TABLE public.simulator_run_findings
    ADD CONSTRAINT simulator_run_findings_kind_check
    CHECK (kind IN ('usability', 'permission', 'locale', 'error', 'workflow', 'discovery', 'logic'));

ALTER TABLE public.simulator_run_findings
    DROP CONSTRAINT IF EXISTS simulator_run_findings_verdict_check;

ALTER TABLE public.simulator_run_findings
    ADD CONSTRAINT simulator_run_findings_verdict_check
    CHECK (verdict IN ('unverified', 'confirmed', 'plausible', 'rejected'));
