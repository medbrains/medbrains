-- Access groups can now carry global permission grants in addition to
-- SpiceDB/ReBAC resource-scope membership.

ALTER TABLE public.access_groups
    ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE public.access_groups
SET permissions = '[]'::jsonb
WHERE permissions IS NULL;
