-- ====================================================================
-- Migration: 1174_order_patient_view_arrow.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A doctor who may view a patient could not open that patient's lab or
-- radiology results when the order was placed at the lab or radiology desk.
-- An order's `view` came only from its orderer, its encounter's department,
-- groups and explicit shares — and a desk walk-in has no doctor's encounter,
-- so the treating doctor got 404 and the screen read "could not be loaded".
--
-- schema.zed now reads `permission view = … + patient->view` on lab_order and
-- radiology_order. The arrow needs its parent pointer, one tuple per order:
--     lab_order:<id>#patient@patient:<patient_id>
-- stored here as subject_type 'tuple_set', subject_id 'patient:<id>' (how the
-- engine serialises an object subject). The Postgres backend joins through it
-- for `view` only; edit, cancel and add_results never traverse it.
--
-- A trigger writes it on every insert, so every creation path is covered —
-- OPD basket, lab and radiology desks, add-ons, order sets, camp, UHI,
-- analyzers, the simulator — and a patient_id correction moves it. Below,
-- once, for every order already on file.

CREATE OR REPLACE FUNCTION trg_order_patient_view_arrow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_type text := TG_ARGV[0];
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id THEN
            RETURN NULL;
        END IF;
        -- The old patient's viewers must not keep reading a moved order.
        UPDATE relation_tuples
           SET status = 'revoked', revoked_at = now(), revoked_by = NEW.ordered_by,
               spicedb_sync_status = 'pending'
         WHERE tenant_id = NEW.tenant_id
           AND object_type = v_type AND object_id = NEW.id
           AND relation = 'patient' AND status = 'active';
    END IF;
    IF NEW.patient_id IS NULL OR EXISTS (
        SELECT 1 FROM relation_tuples
         WHERE tenant_id = NEW.tenant_id
           AND object_type = v_type AND object_id = NEW.id
           AND relation = 'patient' AND status = 'active'
           AND subject_type = 'tuple_set'
           AND subject_id = 'patient:' || NEW.patient_id::text
    ) THEN
        RETURN NULL;
    END IF;
    INSERT INTO relation_tuples
        (tenant_id, object_type, object_id, relation, subject_type, subject_id,
         granted_by, granted_reason, source, derived_from)
    VALUES
        (NEW.tenant_id, v_type, NEW.id, 'patient', 'tuple_set',
         'patient:' || NEW.patient_id::text, NEW.ordered_by,
         'readable by whoever may view the patient', 'derived',
         TG_TABLE_NAME || '.patient_id');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_lab_orders_patient_view_arrow ON lab_orders;
CREATE TRIGGER trg_lab_orders_patient_view_arrow
    AFTER INSERT OR UPDATE OF patient_id ON lab_orders
    FOR EACH ROW EXECUTE FUNCTION trg_order_patient_view_arrow('lab_order');

DROP TRIGGER IF EXISTS trg_radiology_orders_patient_view_arrow ON radiology_orders;
CREATE TRIGGER trg_radiology_orders_patient_view_arrow
    AFTER INSERT OR UPDATE OF patient_id ON radiology_orders
    FOR EACH ROW EXECUTE FUNCTION trg_order_patient_view_arrow('radiology_order');

-- Backfill: one parent pointer per live order that lacks one.
INSERT INTO relation_tuples
    (tenant_id, object_type, object_id, relation, subject_type, subject_id,
     granted_by, granted_reason, source, derived_from)
SELECT o.tenant_id, 'lab_order', o.id, 'patient', 'tuple_set',
       'patient:' || o.patient_id::text, o.ordered_by,
       'readable by whoever may view the patient', 'derived', 'lab_orders.patient_id'
  FROM lab_orders o
 WHERE o.deleted_at IS NULL
   AND NOT EXISTS (
       SELECT 1 FROM relation_tuples t
        WHERE t.tenant_id = o.tenant_id
          AND t.object_type = 'lab_order' AND t.object_id = o.id
          AND t.relation = 'patient' AND t.status = 'active'
   );

INSERT INTO relation_tuples
    (tenant_id, object_type, object_id, relation, subject_type, subject_id,
     granted_by, granted_reason, source, derived_from)
SELECT o.tenant_id, 'radiology_order', o.id, 'patient', 'tuple_set',
       'patient:' || o.patient_id::text, o.ordered_by,
       'readable by whoever may view the patient', 'derived', 'radiology_orders.patient_id'
  FROM radiology_orders o
 WHERE o.deleted_at IS NULL
   AND NOT EXISTS (
       SELECT 1 FROM relation_tuples t
        WHERE t.tenant_id = o.tenant_id
          AND t.object_type = 'radiology_order' AND t.object_id = o.id
          AND t.relation = 'patient' AND t.status = 'active'
   );
