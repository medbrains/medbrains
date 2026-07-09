-- Pre-anaesthesia fasting (NPO) safety. Inducing anaesthesia on a non-fasted patient risks pulmonary
-- aspiration of gastric contents (Mendelson's syndrome) — a preventable anaesthetic death. Elective
-- induction should not proceed unless pre-operative fasting is confirmed on the pre-op assessment; the
-- only exception is a documented emergency (e.g. rapid-sequence induction on a full-stomach emergency
-- patient with aspiration precautions taken). This column records that override reason for audit, so
-- the gate can be enforced server-side rather than trusting an unchecked flag.

ALTER TABLE ot_anesthesia_records
    ADD COLUMN IF NOT EXISTS fasting_override_reason text;
