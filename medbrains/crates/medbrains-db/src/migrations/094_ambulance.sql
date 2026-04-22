-- 090_ambulance.sql — Ambulance Fleet Management Module
-- Fleet master, booking/dispatch, GPS tracking, driver assignment,
-- pickup/drop tracking, emergency vs scheduled trips, billing, trip logs, maintenance

-- ═══════════════════════════════════════════════════════════
--  ENUMS
-- ═══════════════════════════════════════════════════════════

CREATE TYPE ambulance_type AS ENUM (
    'bls',               -- Basic Life Support
    'als',               -- Advanced Life Support
    'patient_transport', -- Non-emergency patient transport
    'mortuary',          -- Dead body transport
    'neonatal'           -- Neonatal ambulance
);

CREATE TYPE ambulance_status AS ENUM (
    'available', 'on_trip', 'maintenance', 'off_duty', 'decommissioned'
);

CREATE TYPE ambulance_trip_type AS ENUM (
    'emergency', 'scheduled', 'inter_facility', 'discharge'
);

CREATE TYPE ambulance_trip_status AS ENUM (
    'requested', 'dispatched', 'en_route_pickup', 'at_pickup',
    'en_route_drop', 'at_drop', 'completed', 'cancelled'
);

CREATE TYPE ambulance_trip_priority AS ENUM (
    'critical', 'urgent', 'routine'
);

CREATE TYPE ambulance_maintenance_status AS ENUM (
    'scheduled', 'in_progress', 'completed', 'overdue', 'cancelled'
);

-- ═══════════════════════════════════════════════════════════
--  TABLE 1: ambulances (fleet master)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE ambulances (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                     UUID NOT NULL REFERENCES tenants(id),
    vehicle_number                TEXT NOT NULL,
    ambulance_code                TEXT NOT NULL,
    ambulance_type                ambulance_type NOT NULL,
    status                        ambulance_status NOT NULL DEFAULT 'available',
    make                          TEXT,
    model                         TEXT,
    year_of_manufacture           INTEGER,
    chassis_number                TEXT,
    engine_number                 TEXT,
    -- Regulatory documents
    fitness_certificate_expiry    DATE,
    insurance_expiry              DATE,
    pollution_certificate_expiry  DATE,
    permit_expiry                 DATE,
    -- Equipment & capabilities
    equipment_checklist           JSONB,
    has_ventilator                BOOLEAN NOT NULL DEFAULT FALSE,
    has_defibrillator             BOOLEAN NOT NULL DEFAULT FALSE,
    has_oxygen                    BOOLEAN NOT NULL DEFAULT TRUE,
    seating_capacity              INTEGER DEFAULT 1,
    -- GPS
    gps_device_id                 TEXT,
    last_latitude                 DOUBLE PRECISION,
    last_longitude                DOUBLE PRECISION,
    last_location_at              TIMESTAMPTZ,
    -- Assignment
    default_driver_id             UUID REFERENCES employees(id),
    current_driver_id             UUID REFERENCES employees(id),
    -- Operational
    odometer_km                   INTEGER DEFAULT 0,
    fuel_type                     TEXT,
    notes                         TEXT,
    created_by                    UUID REFERENCES users(id),
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, vehicle_number),
    UNIQUE (tenant_id, ambulance_code)
);

ALTER TABLE ambulances ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ambulances
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_ambulances_tenant ON ambulances(tenant_id);
CREATE INDEX idx_ambulances_status ON ambulances(tenant_id, status);
CREATE INDEX idx_ambulances_type   ON ambulances(tenant_id, ambulance_type);
CREATE TRIGGER trg_ambulances_updated_at
    BEFORE UPDATE ON ambulances FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 2: ambulance_drivers
-- ═══════════════════════════════════════════════════════════

CREATE TABLE ambulance_drivers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    employee_id       UUID NOT NULL REFERENCES employees(id),
    license_number    TEXT NOT NULL,
    license_type      TEXT NOT NULL,
    license_expiry    DATE NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    bls_certified     BOOLEAN NOT NULL DEFAULT FALSE,
    bls_expiry        DATE,
    defensive_driving BOOLEAN NOT NULL DEFAULT FALSE,
    shift_pattern     TEXT,
    phone             TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, employee_id)
);

ALTER TABLE ambulance_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ambulance_drivers
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_amb_drivers_tenant ON ambulance_drivers(tenant_id);
CREATE INDEX idx_amb_drivers_active ON ambulance_drivers(tenant_id, is_active);
CREATE TRIGGER trg_amb_drivers_updated_at
    BEFORE UPDATE ON ambulance_drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 3: ambulance_trips
-- ═══════════════════════════════════════════════════════════

CREATE TABLE ambulance_trips (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    trip_code             TEXT NOT NULL,
    ambulance_id          UUID REFERENCES ambulances(id),
    driver_id             UUID REFERENCES employees(id),
    trip_type             ambulance_trip_type NOT NULL,
    status                ambulance_trip_status NOT NULL DEFAULT 'requested',
    priority              ambulance_trip_priority NOT NULL DEFAULT 'routine',
    -- Patient
    patient_id            UUID REFERENCES patients(id),
    patient_name          TEXT,
    patient_phone         TEXT,
    -- Pickup
    pickup_address        TEXT NOT NULL,
    pickup_latitude       DOUBLE PRECISION,
    pickup_longitude      DOUBLE PRECISION,
    pickup_landmark       TEXT,
    -- Drop
    drop_address          TEXT,
    drop_latitude         DOUBLE PRECISION,
    drop_longitude        DOUBLE PRECISION,
    drop_landmark         TEXT,
    -- Timing (response time tracking)
    requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispatched_at         TIMESTAMPTZ,
    pickup_arrived_at     TIMESTAMPTZ,
    patient_loaded_at     TIMESTAMPTZ,
    drop_arrived_at       TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    cancelled_at          TIMESTAMPTZ,
    -- Clinical (NABH transport documentation)
    vitals_at_pickup      JSONB,
    vitals_at_drop        JSONB,
    clinical_notes        TEXT,
    oxygen_administered   BOOLEAN DEFAULT FALSE,
    iv_started            BOOLEAN DEFAULT FALSE,
    -- Operational
    odometer_start        INTEGER,
    odometer_end          INTEGER,
    distance_km           NUMERIC(8,2),
    cancellation_reason   TEXT,
    -- Billing
    is_billable           BOOLEAN NOT NULL DEFAULT TRUE,
    base_charge           NUMERIC(12,2) DEFAULT 0,
    per_km_charge         NUMERIC(8,2) DEFAULT 0,
    total_amount          NUMERIC(12,2) DEFAULT 0,
    billing_invoice_id    UUID,
    -- Cross-module links
    er_visit_id           UUID,
    transport_request_id  UUID,
    -- Audit
    requested_by          UUID REFERENCES users(id),
    dispatched_by         UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, trip_code)
);

ALTER TABLE ambulance_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ambulance_trips
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_amb_trips_tenant    ON ambulance_trips(tenant_id);
CREATE INDEX idx_amb_trips_status    ON ambulance_trips(tenant_id, status);
CREATE INDEX idx_amb_trips_ambulance ON ambulance_trips(tenant_id, ambulance_id);
CREATE INDEX idx_amb_trips_driver    ON ambulance_trips(tenant_id, driver_id);
CREATE INDEX idx_amb_trips_patient   ON ambulance_trips(tenant_id, patient_id);
CREATE INDEX idx_amb_trips_requested ON ambulance_trips(tenant_id, requested_at DESC);
CREATE INDEX idx_amb_trips_type      ON ambulance_trips(tenant_id, trip_type);
CREATE TRIGGER trg_amb_trips_updated_at
    BEFORE UPDATE ON ambulance_trips FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════
--  TABLE 4: ambulance_trip_logs (append-only event log)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE ambulance_trip_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    trip_id       UUID NOT NULL REFERENCES ambulance_trips(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    speed_kmh     NUMERIC(6,1),
    heading       NUMERIC(5,1),
    event_data    JSONB,
    recorded_by   UUID REFERENCES users(id),
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ambulance_trip_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ambulance_trip_logs
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_amb_logs_tenant ON ambulance_trip_logs(tenant_id);
CREATE INDEX idx_amb_logs_trip   ON ambulance_trip_logs(tenant_id, trip_id);
CREATE INDEX idx_amb_logs_time   ON ambulance_trip_logs(tenant_id, recorded_at DESC);

-- ═══════════════════════════════════════════════════════════
--  TABLE 5: ambulance_maintenance
-- ═══════════════════════════════════════════════════════════

CREATE TABLE ambulance_maintenance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    ambulance_id        UUID NOT NULL REFERENCES ambulances(id),
    maintenance_type    TEXT NOT NULL,
    status              ambulance_maintenance_status NOT NULL DEFAULT 'scheduled',
    scheduled_date      DATE NOT NULL,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    description         TEXT,
    vendor_name         TEXT,
    cost                NUMERIC(12,2) DEFAULT 0,
    odometer_at_service INTEGER,
    next_service_km     INTEGER,
    next_service_date   DATE,
    findings            TEXT,
    parts_replaced      JSONB,
    performed_by        TEXT,
    approved_by         UUID REFERENCES users(id),
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ambulance_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ambulance_maintenance
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE INDEX idx_amb_maint_tenant    ON ambulance_maintenance(tenant_id);
CREATE INDEX idx_amb_maint_ambulance ON ambulance_maintenance(tenant_id, ambulance_id);
CREATE INDEX idx_amb_maint_status    ON ambulance_maintenance(tenant_id, status);
CREATE INDEX idx_amb_maint_date      ON ambulance_maintenance(tenant_id, scheduled_date);
CREATE TRIGGER trg_amb_maint_updated_at
    BEFORE UPDATE ON ambulance_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
