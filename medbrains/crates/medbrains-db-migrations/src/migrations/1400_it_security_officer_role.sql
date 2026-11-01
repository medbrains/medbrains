-- ====================================================================
-- Migration: 1400_it_security_officer_role.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The IT security officer: watches Security → Intelligence, assigns and
-- closes findings and opens incidents from them (RFC-OSINT §6). Alone in
-- this file: a new enum value can't be used in the transaction that adds
-- it (see 0972).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'it_security_officer';
