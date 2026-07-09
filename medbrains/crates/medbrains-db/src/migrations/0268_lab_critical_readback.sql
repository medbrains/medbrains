-- NABL closed-loop critical-value reporting: capture the read-back when a clinician acknowledges a
-- critical (panic) lab result. The acknowledger must re-state the value; the server verifies it
-- matches the reported result before the alert is acknowledged, so a mis-heard value is caught.

ALTER TABLE lab_critical_alerts
    ADD COLUMN IF NOT EXISTS readback_value    text,
    ADD COLUMN IF NOT EXISTS readback_verified boolean NOT NULL DEFAULT false;
