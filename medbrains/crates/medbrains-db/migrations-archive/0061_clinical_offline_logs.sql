-- Clinical offline logs — REST adapter tables for the four CRDT domain
-- hooks (handoff, triage, notes, nursing-notes) introduced in Phase 6.
--
-- These tables hold the same data the edge node holds in Loro
-- containers — the cloud uses them when a tenant runs in REST mode
-- (offline_mode = false). When offline_mode flips on, writes go
-- through the edge node first; reconciliation pulls them down here
-- via the outbox path established in Sprint A.
--
-- All tables are tenant-scoped via apply_tenant_rls. Patient-scoped
-- and shift-scoped tables also carry department_id for dept-RLS so
-- nurses don't see other wards' shift data without explicit grant.

-- ── Nurse shift handoff entries ─────────────────────────────────────
-- T2 append-only log. One row per handoff note. The "shift" identity
-- is the caller-supplied shift_id string (a per-day key in the dev
-- helper, a real shift roster id once that ships).

CREATE TABLE IF NOT EXISTS nurse_shift_handoff_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    shift_id        TEXT NOT NULL,
    author_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    author_name     TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('alert', 'info', 'task')),
    note            TEXT NOT NULL,
    -- Wall-clock the entry was authored. Set client-side so the edge
    -- and cloud agree on ordering after reconciliation.
    authored_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nurse_handoff_entries_tenant_shift
    ON nurse_shift_handoff_entries (tenant_id, shift_id, authored_at DESC);

SELECT apply_tenant_rls('nurse_shift_handoff_entries');
SELECT apply_department_rls('nurse_shift_handoff_entries', 'department_id');

-- ── ED triage entries ───────────────────────────────────────────────
-- T2 append-only log. Each row is a triage decision (ESI 1..5) on an
-- ER visit. Multiple entries per visit are allowed — later entries
-- supersede earlier ones; the UI surfaces the latest as "current".

CREATE TABLE IF NOT EXISTS ed_triage_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    er_visit_id        UUID NOT NULL REFERENCES er_visits(id) ON DELETE CASCADE,
    author_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    author_name        TEXT NOT NULL,
    esi_level          SMALLINT NOT NULL CHECK (esi_level BETWEEN 1 AND 5),
    chief_complaint    TEXT NOT NULL,
    observation        TEXT NOT NULL DEFAULT '',
    authored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ed_triage_entries_visit
    ON ed_triage_entries (tenant_id, er_visit_id, authored_at DESC);

SELECT apply_tenant_rls('ed_triage_entries');

-- ── Patient clinical notes ──────────────────────────────────────────
-- T3 free-form text. One row per patient — the row holds the latest
-- merged text plus authorship metadata. Concurrent edits in REST
-- mode use last-write-wins on `updated_at`; offline tenants get
-- proper CRDT merge via the edge node and reconcile here on sync.

CREATE TABLE IF NOT EXISTS patient_clinical_notes (
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id         UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    text               TEXT NOT NULL DEFAULT '',
    last_author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    last_author_name   TEXT,
    last_edited_at     TIMESTAMPTZ,
    -- For optimistic concurrency. Bumped on every UPDATE; clients
    -- that lost the race re-fetch and merge.
    version            BIGINT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_notes_updated
    ON patient_clinical_notes (tenant_id, updated_at DESC);

CREATE TRIGGER trg_patient_clinical_notes_touch
    BEFORE UPDATE ON patient_clinical_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT apply_tenant_rls('patient_clinical_notes');

-- ── Nursing shift narrative notes ───────────────────────────────────
-- Same shape as patient_clinical_notes but keyed by shift_id (a
-- caller-supplied string).

CREATE TABLE IF NOT EXISTS nursing_shift_notes (
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shift_id           TEXT NOT NULL,
    department_id      UUID REFERENCES departments(id) ON DELETE SET NULL,
    text               TEXT NOT NULL DEFAULT '',
    last_author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    last_author_name   TEXT,
    last_edited_at     TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_nursing_shift_notes_updated
    ON nursing_shift_notes (tenant_id, updated_at DESC);

CREATE TRIGGER trg_nursing_shift_notes_touch
    BEFORE UPDATE ON nursing_shift_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT apply_tenant_rls('nursing_shift_notes');
SELECT apply_department_rls('nursing_shift_notes', 'department_id');
