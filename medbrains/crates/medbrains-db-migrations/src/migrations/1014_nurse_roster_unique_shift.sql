-- ====================================================================
-- Migration: 1014_nurse_roster_unique_shift.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A nurse could be rostered twice onto the same shift.
--
-- `nurse_shift_assignments` has never had a write path, so nothing has ever
-- tested its shape. It carries no unique index at all: the same nurse on the
-- same ward, date and shift can be inserted any number of times.
--
-- That is not merely untidy. The ward's on-duty list counts the rows, the
-- initial-assessment pipeline picks a nurse by ordering over them, and a
-- duplicate makes one nurse look like two people on a board whose whole job
-- is to say how many hands are on the ward tonight.
--
-- Scoped to live rows, so a nurse taken off a shift can be rostered back on.
-- ward_id is nullable and NULLs compare distinct, so this constrains ward
-- assignments -- which is every row the roster handler writes -- and leaves
-- any future ward-less assignment unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nurse_roster_unique_shift
    ON nurse_shift_assignments (tenant_id, nurse_user_id, ward_id, shift_date, shift_type)
    WHERE deleted_at IS NULL;
