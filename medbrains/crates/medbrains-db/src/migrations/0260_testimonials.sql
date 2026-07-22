-- Migration: 0260_testimonials.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Patient testimonials / reviews (ticket #2954): patient-submitted reviews shown on the hospital
-- micro-site, moderated (approved) before being published. Tenant RLS.

CREATE TABLE IF NOT EXISTS testimonials (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_name text NOT NULL,
    rating       integer NOT NULL DEFAULT 5,
    service      text,
    body         text NOT NULL,
    is_approved  boolean NOT NULL DEFAULT false,
    is_published boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT testimonial_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_testimonials_published
    ON testimonials (tenant_id, is_published, created_at DESC);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY testimonials_tenant_isolation ON testimonials
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON testimonials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
