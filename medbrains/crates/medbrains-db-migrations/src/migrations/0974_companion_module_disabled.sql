-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- The patient companion ships hidden, which needs a row rather than silence.
--
-- ## Why a backfill and not just a seed entry
--
-- `require_module_enabled` blocks on an explicit `disabled` status and nothing
-- else. An absent `module_config` row means ENABLED — deliberately, so that a
-- transient database fault can never take a live clinical module offline. That
-- is the right default for a module a hospital already runs, and exactly the
-- wrong one for a module it has not bought.
--
-- So adding `companion` to the seed alone would leave every tenant that already
-- exists with no row, therefore enabled, therefore showing a Health tab nobody
-- licensed. The seed covers tenants created from now on; this covers the rest.
--
-- ## Why `disabled` and not `coming_soon`
--
-- `module_status` also has `coming_soon`, which reads like the honest label for
-- a feature that is not out yet. It does not enforce: `module_is_disabled`
-- matches only `'disabled'`, so a `coming_soon` companion would be reachable by
-- every patient of every tenant. The status that describes it and the status
-- that gates it are not the same value, and the gate wins.
--
-- Idempotent: a tenant that somehow already has the row keeps whatever an
-- operator set, because flipping a deliberate `enabled` back to `disabled` on
-- every deploy would take the feature away from a hospital that bought it.

INSERT INTO module_config (tenant_id, code, name, description, status, depends_on)
SELECT
    t.id,
    'companion',
    'Patient Companion',
    'Daily health companion in the patient app — medication adherence, observations and connected bands',
    'disabled'::module_status,
    ARRAY['registration']
FROM tenants t
ON CONFLICT (tenant_id, code) DO NOTHING;
