-- ============================================================
-- MedBrains schema — payment_terminals.acquiring_bank
-- Indian bank-branded POS (SBI / Canara / Indian Overseas Bank /
-- Tamilnad Mercantile Bank / …) are not direct bank APIs — the device runs
-- on a TSP/acquirer (Pine Labs / Mswipe / Worldline) under the bank's MID.
-- `provider` already records the TSP we integrate; `acquiring_bank` records
-- which bank's MID the terminal sits under, so one TSP adapter serves every
-- bank on that TSP (bank-agnostic). See RFC §7.2.
-- ============================================================

ALTER TABLE public.payment_terminals
    ADD COLUMN IF NOT EXISTS acquiring_bank text;
