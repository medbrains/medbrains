-- Anthracycline cumulative-dose safety (chemotherapy). Anthracyclines (doxorubicin, epirubicin,
-- daunorubicin, idarubicin) are dose-limited by cardiotoxicity: exceeding a lifetime cumulative dose
-- (e.g. doxorubicin ~450 mg/m²) sharply raises the risk of irreversible heart failure. Every cycle's
-- anthracycline dose (in mg/m², i.e. already normalised to body surface area) must be recorded so the
-- running lifetime total can be checked before the next cycle. The chemo module tracked cycles but not
-- the per-cycle anthracycline dose.

ALTER TABLE chemo_protocols
    ADD COLUMN IF NOT EXISTS anthracycline_agent       text,
    ADD COLUMN IF NOT EXISTS anthracycline_dose_mg_m2  double precision;
