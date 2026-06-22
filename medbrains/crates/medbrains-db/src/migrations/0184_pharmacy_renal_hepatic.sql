-- Renal / hepatic dose-adjustment reference on the pharmacy catalogue.
-- Advisory only (pharmacist-seeded, clinically reviewed). When a patient's
-- latest eGFR is below the threshold, the prescribing safety rail surfaces the
-- adjustment rule; hepatic_caution is a drug-intrinsic note.
ALTER TABLE public.pharmacy_catalog
    ADD COLUMN IF NOT EXISTS renal_adjust_egfr_threshold numeric(6, 2),
    ADD COLUMN IF NOT EXISTS renal_adjust_rule text,
    ADD COLUMN IF NOT EXISTS hepatic_caution text;
