-- ====================================================================
-- Migration: 1222_ai_query_icd11_restricted.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Restricted diagnoses coded in ICD-11 stayed in the assistant's query views.
--
-- `ai_query_private.restricted_icd` (1220) knew only ICD-10 codes, but this
-- hospital codes in ICD-11: schizophrenia is 6A20, not F20, and HIV disease
-- is 1C62, not B20. Its bare `F` also matched ICD-11 codes outside mental
-- health (FA01 is osteoarthritis of the hip). It now mirrors the rule in
-- medbrains-core ai_redact/sensitive.rs for both editions:
--   ICD-10  F00-F99, B20-B24, A50-A64, Z21, Z31, O04, X60-X99, Y00-Y09
--   ICD-11  6A-6E (mental, behavioural, substance use), 1C60-1C62 and
--           1A60-1A9Z (HIV, sexually transmitted infections), JA00
--           (abortion), PB80-PD3Z (self-harm), PD50-PF2Z (assault)

CREATE OR REPLACE FUNCTION ai_query_private.restricted_icd(code text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COALESCE(upper(btrim(code)) ~ (
        '^(F[0-9]|B2[0-4]|A5[0-9]|A6[0-4]|Z21|Z31|O04|X[6-9][0-9]|Y0[0-9]'
        || '|6[A-E]|1C6[0-2]|1A[6-9]|JA00|PB[89]|PC|PD[0-3]|PD[5-9]|PE|PF[0-2])'
    ), false)
$$;
