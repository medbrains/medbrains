-- ====================================================================
-- Migration: 1464_quality_indicator_direction.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: quality_indicators.calculation_query, quality_indicators.auto_calculated
-- ====================================================================
-- Issue #6021.
--
-- calculation_query held query text in a table row. No code ran it, but
-- indicator logic belongs only in compiled, reviewed code, never in data, so
-- the column goes. auto_calculated only showed a button whose handler counted
-- existing value rows and stored that count as the indicator's value; the
-- button and the handler are removed, so the flag goes with them.
--
-- direction says whether a lower or a higher value meets the target. The NABH
-- report used "value >= target" for every indicator, which marks a fall rate
-- above its target as met. Existing rows are classified from their name and
-- sub-category using the NABH definitions; a row that matches neither list
-- stays NULL, and the report prints it as "direction not set" rather than
-- guessing. The Indicators tab lets the quality manager set it.

ALTER TABLE public.quality_indicators
    DROP COLUMN calculation_query,
    DROP COLUMN auto_calculated,
    ADD COLUMN direction text
        CHECK (direction IN ('higher_better', 'lower_better'));

UPDATE public.quality_indicators
SET direction = 'lower_better'
WHERE sub_category IN ('mortality', 'morbidity', 'readmission', 'complication', 'hai',
                       'adverse_event', 'timeliness')
   OR concat_ws(' ', code, name, indicator_name) ~*
      '(fall|infection|cauti|clabsi|\mvap\M|\mssi\M|\mhai\M|ulcer|error|mortality|death|readmi|return|reaction|adverse|sentinel|wait|delay|turnaround|\mtat\M|stock.?out|resched|cancel)';

UPDATE public.quality_indicators
SET direction = 'higher_better'
WHERE direction IS NULL
  AND (sub_category IN ('compliance', 'satisfaction')
       OR concat_ws(' ', code, name, indicator_name) ~*
          '(hygiene|compliance|adherence|satisfaction|survival|completion|uptake)');
