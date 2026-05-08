-- ============================================================================
-- 0111_nabh_source_event_links.sql
-- Link NABH evidence rows back to the workflow event that created them.
--
-- These columns make the Phase 2 capture tables automatic evidence sinks instead
-- of parallel manual-entry registers. Source modules can upsert by
-- tenant/source_module/source_record_id and remain idempotent.
-- ============================================================================

ALTER TABLE nabh_falls_register
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_pressure_ulcer_assessments
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_sentinel_event_register
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_blood_transfusion_reactions
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_code_blue_activations
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_equipment_downtime_log
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_fire_safety_drills
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

ALTER TABLE nabh_bmw_disposal_log
    ADD COLUMN IF NOT EXISTS source_module TEXT,
    ADD COLUMN IF NOT EXISTS source_record_id UUID;

-- Code Blue activations are opened before the final clinical outcome is known.
ALTER TABLE nabh_code_blue_activations
    ALTER COLUMN outcome DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_falls_source
    ON nabh_falls_register (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_pu_source
    ON nabh_pressure_ulcer_assessments (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_sentinel_source
    ON nabh_sentinel_event_register (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_btr_source
    ON nabh_blood_transfusion_reactions (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_code_blue_source
    ON nabh_code_blue_activations (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_eq_downtime_source
    ON nabh_equipment_downtime_log (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_fire_drill_source
    ON nabh_fire_safety_drills (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nabh_bmw_source
    ON nabh_bmw_disposal_log (tenant_id, source_module, source_record_id)
    WHERE source_module IS NOT NULL AND source_record_id IS NOT NULL;
