-- ====================================================================
-- Migration: 1086_custom_domain_ownership.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A hospital may run MedBrains on its own domain. Until now any
-- administrator could name any domain, and sign-in followed it. A domain
-- now takes effect only once the hospital proves it controls it, with a DNS
-- TXT record carrying a token issued here; certificates are issued only for
-- proven domains. Domains already in use were set by the platform's own
-- operators and are carried over as proven.

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS custom_domain_token text,
    ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamptz;

UPDATE public.tenants
   SET custom_domain_token = encode(gen_random_bytes(16), 'hex')
 WHERE custom_domain_token IS NULL;

UPDATE public.tenants
   SET custom_domain_verified_at = now()
 WHERE custom_domain IS NOT NULL AND custom_domain <> '' AND custom_domain_verified_at IS NULL;

-- One hospital per proven domain.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_verified_custom_domain
    ON public.tenants (lower(custom_domain))
    WHERE custom_domain_verified_at IS NOT NULL;
