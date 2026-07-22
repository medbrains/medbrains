-- Migration: 0267_stations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Stations master: a first-class place a device/app instance sits — a nurse station, an OPD
-- counter, a ward console, a kiosk point, a reception desk. Department-scoped. Devices bind to a
-- station (paired_devices.station_id) so the boot manifest resolves the concrete station, not just
-- a free-text label. Complements the location axis added in 0266 (a station carries its department).

CREATE TABLE IF NOT EXISTS stations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id  uuid REFERENCES departments(id),
    code           text NOT NULL,
    name           text NOT NULL,
    station_type   text NOT NULL DEFAULT 'other',
    location_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active      boolean NOT NULL DEFAULT true,
    created_by     uuid,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz,
    deleted_by     uuid,
    delete_reason  text,
    CONSTRAINT stations_code_unique UNIQUE (tenant_id, code),
    CONSTRAINT stations_type_check CHECK (station_type = ANY (ARRAY[
        'nurse_station'::text, 'opd_counter'::text, 'ward_console'::text, 'kiosk_point'::text,
        'billing_counter'::text, 'pharmacy_counter'::text, 'lab_counter'::text,
        'reception'::text, 'display'::text, 'other'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_stations_department
    ON stations (tenant_id, department_id) WHERE deleted_at IS NULL;

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY stations_tenant_isolation ON stations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Bind a device / pairing token to a station.
ALTER TABLE device_pairing_tokens ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id);
ALTER TABLE paired_devices        ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id);
