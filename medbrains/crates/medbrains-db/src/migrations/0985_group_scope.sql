-- What a group shares, named for what management is actually deciding.
--
-- The switch added in 0982 was called `share_across_branches`, which reads as
-- "should these two hospitals share". Nobody creates a group in order to keep
-- two hospitals apart — they would be two customers. A group exists because
-- things are shared, and the only question management genuinely deliberates
-- over is whether a doctor at one location may open a chart written at the
-- other.
--
-- So there are two tiers, not one switch.
--
-- **Administrative data is group-wide because that is what a group is.** One
-- consultant working Monday at the main hospital and Tuesday at the satellite
-- is one staff record. The drug formulary, the tariff master and the
-- consolidated figures are usually the reason a group bought a group product.
-- Asking "should your HR administrator see staff at both your hospitals" is
-- not a question anybody wants to be asked.
--
-- **Clinical records are the deliberate decision**, and default to the
-- hospital that wrote them. In India each location is generally registered
-- separately under the Clinical Establishments Act, NABH accreditation is per
-- facility, and medical records retention is a per-facility obligation. A main
-- campus and its own satellite is usually one entity and should share — not
-- sharing there is a patient safety problem. Two hospitals in different cities
-- under a holding company usually should not.
--
-- The mechanism is a scope the session declares. An administrative handler
-- says `app.scope = 'group'` as a matter of course; a clinical one does not,
-- and gets the narrow answer unless management has said otherwise.
--
-- Bounded by the database: a hospital group has its own, so the widest this
-- reaches is the group already sharing one. Never another customer.
--
-- Not a security boundary on its own. The control is the permission check in
-- front of the handler. This only stops row level security contradicting a
-- query that was already allowed to be group-wide.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'hospital_groups'
           AND column_name = 'share_across_branches'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'hospital_groups'
           AND column_name = 'share_clinical_records'
    ) THEN
        ALTER TABLE public.hospital_groups
            RENAME COLUMN share_across_branches TO share_clinical_records;
    END IF;
END $$;

ALTER TABLE public.hospital_groups
    ADD COLUMN IF NOT EXISTS share_clinical_records BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hospital_groups.share_clinical_records IS
    'Whether a clinician at one location in this group may read records '
    'written at another. Off by default. Administrative data — staff, '
    'masters, tariffs, consolidated figures — is group-wide regardless, '
    'because that is what a group is.';

CREATE OR REPLACE FUNCTION public.app_visible_tenants()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        -- An administrative screen, which asked for group scope. Every active
        -- hospital in the group, whatever the clinical setting says: who works
        -- where is not a patient record.
        WHEN current_setting('app.scope', true) = 'group' AND g.id IS NOT NULL
            THEN ARRAY(
                SELECT t.id FROM public.tenants t
                 WHERE t.group_id = me.group_id AND t.is_active
            )
        -- Clinical work in a group that shares records.
        WHEN g.id IS NOT NULL AND COALESCE(g.share_clinical_records, false)
            THEN ARRAY(
                SELECT t.id FROM public.tenants t
                 WHERE t.group_id = me.group_id AND t.is_active
            )
        -- Everything else: the hospital the session is working at. This is the
        -- answer for every tenant today.
        ELSE ARRAY[me.id]
    END
    FROM public.tenants me
    -- Deleted groups grant nothing. `hospital_groups` is soft-deleted by a
    -- trigger, so a group that has been removed is still a row — and without
    -- this join condition it would carry on sharing records between hospitals
    -- that management had already separated.
    LEFT JOIN public.hospital_groups g
           ON g.id = me.group_id AND g.deleted_at IS NULL
    WHERE me.id = public.app_current_tenant()
$$;

COMMENT ON FUNCTION public.app_visible_tenants() IS
    'Tenants the current session may see. The hospital it is working at; the '
    'whole group when an administrative handler asked for group scope, or '
    'when management shares clinical records. NULL when no tenant is set, '
    'which every policy treats as no rows.';
