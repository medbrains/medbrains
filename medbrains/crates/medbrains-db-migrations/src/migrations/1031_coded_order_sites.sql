-- ====================================================================
-- Migration: 1031_coded_order_sites.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The body part an image is ordered for, and the site an operation is
-- booked on, as a code and a side as well as words. Wrong-side imaging and
-- wrong-site surgery start as an ambiguous free-text field; the body-site
-- picker (FMA concept + side) closes that gap. Text columns stay the printed
-- words and the only value when a site is typed.
ALTER TABLE radiology_orders
    ADD COLUMN body_part_code text,
    ADD COLUMN body_part_laterality text
        CHECK (body_part_laterality IN ('left', 'right', 'bilateral', 'midline'));

ALTER TABLE ot_bookings
    ADD COLUMN surgical_site text,
    ADD COLUMN surgical_site_code text;
