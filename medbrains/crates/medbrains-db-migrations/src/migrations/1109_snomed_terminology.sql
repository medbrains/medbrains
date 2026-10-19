-- ====================================================================
-- Migration: 1109_snomed_terminology.sql
-- RLS-Posture: catalog
-- Tenant-Column: N/A
-- New-Tables: snomed_release, snomed_concept, snomed_description, snomed_relationship, snomed_refset_member, snomed_transitive_closure
-- Drops: none
-- ====================================================================
-- SNOMED CT as a local store, loaded from licensed RF2 Snapshot packages:
-- the International Edition plus any number of extensions (the NRCeS India
-- packages: AYUSH, drug codes, Hindi/Marathi/Tamil/Urdu patient terms,
-- geographical locations, reference sets). Reference data shared by every
-- tenant of a deployment under its affiliate licence, so no tenant_id and
-- no RLS — like cds_drug_reference. Patient records stay tenant-scoped in
-- their own tables and join to this by concept id.
--
-- No foreign keys between the component tables: an extension references
-- International concepts, and packages may be loaded in any order.

CREATE TABLE public.snomed_release (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    edition text NOT NULL,
    version_date date NOT NULL,
    module_ids text[] NOT NULL DEFAULT '{}',
    source text NOT NULL CHECK (source IN ('upload', 'server_path')),
    file_name text,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'importing', 'closure', 'completed', 'failed')),
    phase text,
    rows_processed bigint NOT NULL DEFAULT 0,
    concept_count bigint NOT NULL DEFAULT 0,
    description_count bigint NOT NULL DEFAULT 0,
    relationship_count bigint NOT NULL DEFAULT 0,
    refset_member_count bigint NOT NULL DEFAULT 0,
    closure_count bigint,
    skipped_files text[] NOT NULL DEFAULT '{}',
    error text,
    imported_by uuid REFERENCES public.users(id),
    imported_by_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    imported_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_snomed_release_edition_version UNIQUE (edition, version_date)
);

-- One import at a time: two would race on the shared closure rebuild.
CREATE UNIQUE INDEX uq_snomed_release_one_active ON public.snomed_release ((true))
    WHERE status IN ('queued', 'importing', 'closure');

CREATE TABLE public.snomed_concept (
    id bigint NOT NULL PRIMARY KEY,
    effective_time date NOT NULL,
    active boolean NOT NULL,
    module_id bigint NOT NULL,
    definition_status_id bigint NOT NULL,
    -- Derived after each import from the descriptions and language refsets,
    -- so search and lists never resolve a term per row.
    fsn text,
    semantic_tag text,
    preferred_term text
);

CREATE INDEX idx_snomed_concept_semantic_tag ON public.snomed_concept (semantic_tag) WHERE active;

CREATE TABLE public.snomed_description (
    id bigint NOT NULL PRIMARY KEY,
    effective_time date NOT NULL,
    active boolean NOT NULL,
    module_id bigint NOT NULL,
    concept_id bigint NOT NULL,
    language_code text NOT NULL,
    type_id bigint NOT NULL,
    term text NOT NULL,
    case_significance_id bigint NOT NULL
);

CREATE INDEX idx_snomed_description_concept ON public.snomed_description (concept_id);
CREATE INDEX idx_snomed_description_term_trgm ON public.snomed_description
    USING gin (term public.gin_trgm_ops);

CREATE TABLE public.snomed_relationship (
    id bigint NOT NULL PRIMARY KEY,
    effective_time date NOT NULL,
    active boolean NOT NULL,
    module_id bigint NOT NULL,
    source_id bigint NOT NULL,
    destination_id bigint NOT NULL,
    relationship_group integer NOT NULL,
    type_id bigint NOT NULL,
    characteristic_type_id bigint NOT NULL,
    modifier_id bigint NOT NULL
);

CREATE INDEX idx_snomed_relationship_source ON public.snomed_relationship (source_id, type_id)
    WHERE active;
CREATE INDEX idx_snomed_relationship_destination ON public.snomed_relationship (destination_id, type_id)
    WHERE active;

-- Simple and language refset members. acceptability_id is set only for
-- language refsets (preferred 900000000000548007, acceptable 900000000000549004).
CREATE TABLE public.snomed_refset_member (
    id uuid NOT NULL PRIMARY KEY,
    effective_time date NOT NULL,
    active boolean NOT NULL,
    module_id bigint NOT NULL,
    refset_id bigint NOT NULL,
    referenced_component_id bigint NOT NULL,
    acceptability_id bigint
);

CREATE INDEX idx_snomed_refset_member_refset ON public.snomed_refset_member (refset_id, referenced_component_id)
    WHERE active;
CREATE INDEX idx_snomed_refset_member_component ON public.snomed_refset_member (referenced_component_id)
    WHERE active;

-- Every (descendant, ancestor) pair over active inferred IS-A relationships,
-- self excluded. Rebuilt set-based after each import; subsumption is then
-- one index probe instead of a recursive walk per query.
CREATE TABLE public.snomed_transitive_closure (
    subtype_id bigint NOT NULL,
    supertype_id bigint NOT NULL,
    PRIMARY KEY (subtype_id, supertype_id)
);

CREATE INDEX idx_snomed_closure_supertype ON public.snomed_transitive_closure (supertype_id, subtype_id);

CREATE TRIGGER set_updated_at_snomed_release BEFORE UPDATE ON public.snomed_release
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
