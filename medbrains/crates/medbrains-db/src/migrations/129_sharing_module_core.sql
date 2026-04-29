-- ====================================================================
-- Migration: 129_sharing_module_core.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: relation_tuples, access_groups, access_group_members
-- Drops: none
-- ====================================================================
-- RFC-INFRA-2026-002 Phase 3.1 — unified Zanzibar-style sharing store.
--
-- Single `relation_tuples` table is the source of truth for fine-grained
-- per-record access grants across the ~95 shareable entity types. Sits
-- as Layer 6 below the existing 5-layer stack (JWT → 660 typed perms →
-- roles ∪ access_matrix → resolve formula → 7 helpers + dept scoping).
--
-- Subjects taxonomy:
--   user       — single user_id
--   role       — every user with role_code (e.g. 'nurse')
--   department — every user whose JWT department_ids contains this id
--   group      — explicit access_group membership (multidisciplinary teams)
--   tuple_set  — Zanzibar userset rewrite: subject_id = '<obj>:<id>#<rel>'
--
-- Hash-partitioned 32 ways by tenant_id so query plans stay tight even
-- as tuple count grows. Per-tenant working set ≤ ~50M = sub-millisecond.
-- ====================================================================

-- ── access_groups (multidisciplinary teams, tumor boards, on-call rotations) ──

CREATE TABLE access_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

CREATE INDEX idx_access_groups_tenant ON access_groups(tenant_id) WHERE is_active = true;
SELECT apply_tenant_rls('access_groups');

CREATE TABLE access_group_members (
    group_id        UUID NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    added_by        UUID REFERENCES users(id),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_agm_user ON access_group_members(tenant_id, user_id)
    WHERE expires_at IS NULL OR expires_at > now();
SELECT apply_tenant_rls('access_group_members');

-- ── relation_tuples — the unified sharing store ────────────────────

CREATE TABLE relation_tuples (
    tuple_id        UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    object_type     TEXT NOT NULL,                 -- e.g. 'patient', 'encounter', 'dashboard'
    object_id       UUID NOT NULL,
    relation        TEXT NOT NULL,                 -- 'owner' | 'editor' | 'viewer' | 'consultant' | ...
    subject_type    TEXT NOT NULL CHECK (subject_type IN ('user','role','department','group','tuple_set')),
    subject_id      TEXT NOT NULL,                 -- UUID for user/dept/group, role code for role, '<type>:<id>#<rel>' for tuple_set
    caveat          JSONB,                         -- contextual constraints (closed enum at app layer)
    expires_at      TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','superseded')),
    granted_by      UUID NOT NULL REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_reason  TEXT,
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID REFERENCES users(id),
    source          TEXT NOT NULL DEFAULT 'explicit' CHECK (source IN ('explicit','derived')),
    derived_from    TEXT,                          -- 'encounters.attending_physician_id' for derived rows
    PRIMARY KEY (tenant_id, tuple_id)
) PARTITION BY HASH (tenant_id);

-- Hash-partition fan-out × 32. New partitions can be added later without
-- touching application code (Postgres rebalances via pg_partman or manual).
DO $$
DECLARE i INT;
BEGIN
    FOR i IN 0..31 LOOP
        EXECUTE format(
            'CREATE TABLE relation_tuples_p%s PARTITION OF relation_tuples '
            'FOR VALUES WITH (modulus 32, remainder %s)',
            i, i
        );
    END LOOP;
END $$;

-- Lookup by object — the hot path for `check(subject, relation, object)`
CREATE INDEX rt_lookup_idx ON relation_tuples
    (tenant_id, object_type, object_id, relation)
    WHERE status = 'active';

-- Reverse lookup by subject — "what does this user have access to?"
CREATE INDEX rt_subject_idx ON relation_tuples
    (tenant_id, subject_type, subject_id)
    WHERE status = 'active';

-- Expiry sweep
CREATE INDEX rt_expiry_idx ON relation_tuples
    (expires_at)
    WHERE expires_at IS NOT NULL AND status = 'active';

-- Derived-row diagnostics (which assignment column produced this tuple)
CREATE INDEX rt_derived_idx ON relation_tuples
    (tenant_id, source, derived_from)
    WHERE source = 'derived';

SELECT apply_tenant_rls('relation_tuples');
