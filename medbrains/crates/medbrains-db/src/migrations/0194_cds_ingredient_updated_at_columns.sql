-- Fix: migration 0192 attached the update_updated_at() BEFORE UPDATE trigger to
-- cds_drug_ingredient and cds_ingredient_incompatibility, but those tables
-- (created in 0188) have no updated_at column. On re-seed the ON CONFLICT DO
-- UPDATE fires the trigger → "record \"new\" has no field \"updated_at\"" (42703),
-- crashing startup seeding. Add the timestamp columns the trigger expects so the
-- two tables match the other cds_* reference tables.
ALTER TABLE public.cds_drug_ingredient
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE public.cds_ingredient_incompatibility
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
