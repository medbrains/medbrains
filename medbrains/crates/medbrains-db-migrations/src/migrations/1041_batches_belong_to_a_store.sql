-- ====================================================================
-- Migration: 1041_batches_belong_to_a_store.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Goods receipt never asked which store received the stock, so every batch a
-- GRN brought into the pharmacy has store_location_id NULL — stock no store
-- owns, which a store cannot issue and a transfer cannot move. The GRN now
-- requires the receiving store wherever the hospital keeps stores.
--
-- Existing store-less batches are given a store only where that is not a
-- guess: a hospital with exactly one active store received everything there.
-- With several stores the batches are left for the store keeper to place.
UPDATE pharmacy_batches b
   SET store_location_id = s.id
  FROM (
      SELECT tenant_id, (array_agg(id))[1] AS id
        FROM store_locations
       WHERE is_active AND deleted_at IS NULL
       GROUP BY tenant_id
      HAVING COUNT(*) = 1
  ) s
 WHERE b.tenant_id = s.tenant_id
   AND b.store_location_id IS NULL
   AND b.deleted_at IS NULL;
