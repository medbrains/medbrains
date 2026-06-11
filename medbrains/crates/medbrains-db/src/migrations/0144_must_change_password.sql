-- Force password rotation on seeded/provisioned accounts (audit P0 #2).
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
