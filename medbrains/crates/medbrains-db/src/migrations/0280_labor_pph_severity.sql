-- Postpartum haemorrhage (PPH) classification — the leading cause of maternal death. Primary PPH is
-- blood loss >= 500 mL after a vaginal birth or >= 1000 mL after caesarean; "severe" PPH is >= 1000 mL
-- (vaginal) / >= 1500 mL (caesarean) and mandates activation of the massive-haemorrhage protocol.
-- The labor record captures blood_loss_ml and delivery_type but never classified them, so the PPH
-- threshold was invisible. A generated column derives the severity server-side (single source of truth)
-- so it can't drift from the recorded loss.

ALTER TABLE labor_records
    ADD COLUMN IF NOT EXISTS pph_severity text GENERATED ALWAYS AS (
        CASE
            WHEN blood_loss_ml IS NULL THEN NULL
            WHEN blood_loss_ml >= (CASE
                    WHEN delivery_type IN ('lscs_elective', 'lscs_emergency') THEN 1500 ELSE 1000
                END) THEN 'severe'
            WHEN blood_loss_ml >= (CASE
                    WHEN delivery_type IN ('lscs_elective', 'lscs_emergency') THEN 1000 ELSE 500
                END) THEN 'pph'
            ELSE 'none'
        END
    ) STORED;
