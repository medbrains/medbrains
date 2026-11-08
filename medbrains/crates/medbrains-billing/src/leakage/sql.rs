//! The unbilled-orders check's SQL. The same "done" and "already billed"
//! fragments build both the detector's batch and the post-time re-check, so
//! the desk can never post what the detector would not have raised.
//!
//! Every fragment binds the tenant as `$1` and names it on every table.

/// Orders done for a patient, one row each, with the codes and name its
/// service is billed under and its catalogue price (lab, procedure).
macro_rules! done_sql {
    () => {
        "SELECT 'lab'::text AS module, lo.id AS order_id, lo.patient_id, lo.encounter_id, \
                COALESCE(lo.department_id, t.department_id, e.department_id) AS department_id, \
                t.code AS charge_code, ARRAY[t.code] AS codes, t.name AS service_name, \
                t.name AS description, t.price AS catalog_price, \
                COALESCE(lo.verified_at, lo.completed_at, lo.updated_at) AS service_at, \
                lo.test_id, NULL::uuid AS procedure_id, 'lab'::text AS setting, 1 AS quantity \
           FROM lab_orders lo \
           JOIN lab_test_catalog t ON t.id = lo.test_id AND t.tenant_id = lo.tenant_id \
           LEFT JOIN encounters e ON e.id = lo.encounter_id AND e.tenant_id = lo.tenant_id \
          WHERE lo.tenant_id = $1 AND lo.deleted_at IS NULL AND lo.status = 'verified' \
            AND lo.camp_id IS NULL AND NOT COALESCE(e.is_dummy, false) \
         UNION ALL \
         SELECT 'radiology', ro.id, ro.patient_id, ro.encounter_id, e.department_id, \
                COALESCE(re.charge_code, 'RAD-' || rm.code), \
                array_remove(ARRAY[re.charge_code, 'RAD-' || rm.code, re.code], NULL), \
                COALESCE(re.name, rm.name), \
                COALESCE(re.name, rm.name) || COALESCE(' — ' || ro.body_part, ''), NULL::numeric, \
                COALESCE(ro.completed_at, ro.updated_at), NULL::uuid, NULL::uuid, 'radiology', 1 \
           FROM radiology_orders ro \
           JOIN radiology_modalities rm ON rm.id = ro.modality_id AND rm.tenant_id = ro.tenant_id \
           LEFT JOIN radiology_exams re ON re.id = ro.exam_id AND re.tenant_id = ro.tenant_id \
           LEFT JOIN encounters e ON e.id = ro.encounter_id AND e.tenant_id = ro.tenant_id \
          WHERE ro.tenant_id = $1 AND ro.deleted_at IS NULL \
            AND ro.status IN ('reported', 'verified') \
            AND NOT ro.is_dummy AND NOT COALESCE(e.is_dummy, false) \
         UNION ALL \
         SELECT 'procedure', po.id, po.patient_id, po.encounter_id, \
                COALESCE(pc.department_id, e.department_id), pc.code, ARRAY[pc.code], pc.name, \
                pc.name, pc.base_price, COALESCE(po.completed_at, po.updated_at), NULL::uuid, \
                po.procedure_id, 'procedure', 1 \
           FROM procedure_orders po \
           JOIN procedure_catalog pc ON pc.id = po.procedure_id AND pc.tenant_id = po.tenant_id \
           LEFT JOIN encounters e ON e.id = po.encounter_id AND e.tenant_id = po.tenant_id \
          WHERE po.tenant_id = $1 AND po.deleted_at IS NULL AND po.status = 'completed' \
            AND NOT COALESCE(e.is_dummy, false)"
    };
}

/// Stock used on a named patient, in the same shape as [`done_sql`]: store
/// consumables issued as chargeable (less any returned), billable ward stock,
/// consignment stock used, and registry implants not on a consignment batch
/// (those bill through their consignment usage, so are not counted twice).
/// Migration 1421. The catalogue price is the issue's own price, else the
/// item's.
macro_rules! consumed_sql {
    () => {
        "SELECT 'consumable'::text AS module, pci.id AS order_id, pci.patient_id, \
                pci.encounter_id, pci.department_id, sc.code AS charge_code, \
                ARRAY[sc.code] AS codes, sc.name AS service_name, sc.name AS description, \
                COALESCE(NULLIF(pci.unit_price, 0), sc.base_price) AS catalog_price, \
                pci.created_at AS service_at, NULL::uuid AS test_id, NULL::uuid AS procedure_id, \
                'consumable'::text AS setting, pci.quantity - pci.returned_qty AS quantity \
           FROM patient_consumable_issues pci \
           JOIN store_catalog sc ON sc.id = pci.catalog_item_id AND sc.tenant_id = pci.tenant_id \
          WHERE pci.tenant_id = $1 AND pci.deleted_at IS NULL AND pci.is_chargeable \
            AND pci.quantity > pci.returned_qty \
         UNION ALL \
         SELECT 'consumable', w.id, w.patient_id, w.encounter_id, w.department_id, c.code, \
                ARRAY[c.code], c.name, c.name, c.base_price, w.created_at, NULL::uuid, \
                NULL::uuid, 'ward_stock', w.quantity \
           FROM ward_stock_consumptions w \
           JOIN pharmacy_catalog c ON c.id = w.catalog_item_id AND c.tenant_id = w.tenant_id \
          WHERE w.tenant_id = $1 AND w.deleted_at IS NULL AND w.patient_id IS NOT NULL \
            AND w.is_billable \
         UNION ALL \
         SELECT 'consumable', m.id, m.patient_id, NULL::uuid, m.department_id, sc.code, \
                ARRAY[sc.code], sc.name, \
                'Consignment: ' || sc.name || ' · batch ' || b.batch_number, sc.base_price, \
                m.created_at, NULL::uuid, NULL::uuid, 'consignment', -m.quantity \
           FROM store_stock_movements m \
           JOIN batch_stock b ON b.id = m.batch_stock_id AND b.tenant_id = m.tenant_id \
           JOIN store_catalog sc ON sc.id = m.catalog_item_id AND sc.tenant_id = m.tenant_id \
          WHERE m.tenant_id = $1 AND m.deleted_at IS NULL \
            AND m.reference_type = 'consignment_usage' AND m.patient_id IS NOT NULL \
            AND m.quantity < 0 \
         UNION ALL \
         SELECT 'ot', ir.id, ir.patient_id, NULL::uuid, NULL::uuid, sc.code, ARRAY[sc.code], \
                sc.name, 'Implant: ' || sc.name, sc.base_price, ir.created_at, NULL::uuid, \
                NULL::uuid, 'implant', 1 \
           FROM implant_registry ir \
           JOIN store_catalog sc ON sc.id = ir.catalog_item_id AND sc.tenant_id = ir.tenant_id \
           LEFT JOIN batch_stock b ON b.id = ir.batch_stock_id AND b.tenant_id = ir.tenant_id \
          WHERE ir.tenant_id = $1 AND ir.deleted_at IS NULL \
            AND NOT COALESCE(b.is_consignment, false)"
    };
}

/// True when a bill already carries the order `d`: a line naming it, or a
/// hand-entered line on any of the patient's bills raised from a week before
/// the service on, under any code the service is billed by — its catalogue
/// codes, or a charge-master entry of the same name.
macro_rules! billed_sql {
    () => {
        "(EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.tenant_id = $1 \
              AND ii.source = d.module::charge_source AND ii.source_id = d.order_id) \
          OR EXISTS (SELECT 1 FROM invoice_items ii \
              JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
             WHERE ii.tenant_id = $1 AND i.patient_id = d.patient_id AND ii.source_id IS NULL \
               AND ii.deleted_at IS NULL AND i.deleted_at IS NULL AND i.status <> 'cancelled' \
               AND i.created_at >= d.service_at - interval '7 days' \
               AND (ii.charge_code = ANY(d.codes) \
                    OR ii.charge_code IN (SELECT cm.code FROM charge_master cm \
                        WHERE cm.tenant_id = $1 AND cm.deleted_at IS NULL \
                          AND lower(cm.name) = lower(d.service_name)))))"
    };
}

/// One batch: find done, unbilled, uncovered orders and queue them, priced.
/// `$1` tenant, `$2` grace hours, `$3` look-back days, `$4` batch size, `$5`
/// the person running it (NULL for the daily pass).
///
/// Price: the patient's payer rate card, else the catalogue price (lab,
/// procedure), else the rate plan for the patient's category or the default
/// plan, else the charge master — the order the modules' own charge path
/// uses. A catalogue or charge-master ₹0 is "not set", never "free"; only an
/// explicit ₹0 on a rate card or rate plan is an exemption and is skipped.
///
/// `$done` names the macro giving the rows to check, `$reason` the quoted
/// queue reason they are raised under.
macro_rules! queue_batch_sql {
    ($done:ident, $reason:literal) => {
        concat!(
            "WITH done AS (",
            $done!(),
            "), due AS ( \
       SELECT d.*, price.unit_price, price.tax_percent \
         FROM done d \
         LEFT JOIN patients p ON p.id = d.patient_id AND p.tenant_id = $1 \
         LEFT JOIN charge_master cm ON cm.tenant_id = $1 AND cm.code = d.charge_code \
              AND cm.is_active AND cm.deleted_at IS NULL \
         LEFT JOIN LATERAL ( \
           SELECT rpi.override_price AS price, rpi.override_tax_percent AS tax \
             FROM patient_insurance pi \
             JOIN tpa_rate_cards rc ON rc.tenant_id = pi.tenant_id \
                  AND rc.insurance_provider = pi.insurance_provider \
                  AND (NULLIF(btrim(rc.tpa_name), '') IS NULL OR rc.tpa_name = pi.tpa_name) \
                  AND rc.is_active AND rc.deleted_at IS NULL \
                  AND (rc.valid_from IS NULL OR rc.valid_from <= d.service_at::date) \
                  AND (rc.valid_to IS NULL OR rc.valid_to >= d.service_at::date) \
             JOIN rate_plans rp ON rp.id = rc.rate_plan_id AND rp.tenant_id = rc.tenant_id \
                  AND rp.is_active AND rp.deleted_at IS NULL \
             JOIN rate_plan_items rpi ON rpi.rate_plan_id = rp.id \
                  AND rpi.tenant_id = rp.tenant_id AND rpi.charge_code = d.charge_code \
                  AND rpi.deleted_at IS NULL \
            WHERE pi.tenant_id = $1 AND pi.patient_id = d.patient_id AND pi.is_active \
              AND pi.deleted_at IS NULL \
              AND d.service_at::date BETWEEN pi.valid_from AND pi.valid_until \
            ORDER BY pi.priority, (NULLIF(btrim(rc.tpa_name), '') IS NULL), \
                     rc.valid_from DESC NULLS LAST, rc.id, pi.id \
            LIMIT 1) payer ON true \
         LEFT JOIN LATERAL ( \
           SELECT rpi.override_price AS price, rpi.override_tax_percent AS tax \
             FROM rate_plan_items rpi \
             JOIN rate_plans rp ON rp.id = rpi.rate_plan_id AND rp.tenant_id = rpi.tenant_id \
            WHERE rpi.tenant_id = $1 AND rpi.charge_code = d.charge_code \
              AND rpi.deleted_at IS NULL AND rp.is_active AND rp.deleted_at IS NULL \
              AND (rp.patient_category = p.category::text OR rp.is_default) \
            ORDER BY (rp.patient_category IS NOT DISTINCT FROM p.category::text) DESC, rp.id \
            LIMIT 1) plan ON true \
         CROSS JOIN LATERAL ( \
           SELECT COALESCE(payer.price, NULLIF(d.catalog_price, 0), plan.price, \
                           NULLIF(cm.base_price, 0)) AS unit_price, \
                  COALESCE(payer.tax, plan.tax, cm.tax_percent) AS tax_percent) price \
        WHERE d.service_at < now() - make_interval(hours => $2) \
          AND d.service_at >= now() - make_interval(days => $3) \
          AND NOT ",
            billed_sql!(),
            " AND NOT EXISTS (SELECT 1 FROM tenant_settings ts WHERE ts.tenant_id = $1 \
                AND ts.category = 'billing' AND ts.key = 'auto_charge_' || d.setting \
                AND ts.value NOT IN ('true'::jsonb, '\"true\"'::jsonb)) \
          AND NOT EXISTS (SELECT 1 FROM charge_attention_items a WHERE a.tenant_id = $1 \
                AND a.source_module = d.module AND a.source_entity_id = d.order_id \
                AND a.deleted_at IS NULL) \
          AND NOT EXISTS (SELECT 1 FROM patient_package_subscriptions s \
                JOIN doctor_package_inclusions inc ON inc.package_id = s.package_id \
                     AND inc.tenant_id = s.tenant_id AND inc.deleted_at IS NULL \
               WHERE s.tenant_id = $1 AND s.patient_id = d.patient_id AND s.status = 'active' \
                 AND s.deleted_at IS NULL \
                 AND d.service_at BETWEEN s.purchased_at AND s.valid_until \
                 AND (inc.test_id = d.test_id OR inc.procedure_id = d.procedure_id)) \
          AND NOT EXISTS (SELECT 1 FROM invoices i \
                JOIN invoice_items ii ON ii.invoice_id = i.id AND ii.tenant_id = i.tenant_id \
                     AND ii.deleted_at IS NULL \
                JOIN billing_packages bp ON bp.tenant_id = i.tenant_id \
                     AND bp.code = ii.charge_code AND bp.deleted_at IS NULL \
                JOIN billing_package_items bpi ON bpi.package_id = bp.id \
                     AND bpi.tenant_id = bp.tenant_id AND bpi.charge_code = d.charge_code \
                     AND bpi.deleted_at IS NULL \
               WHERE i.tenant_id = $1 AND i.encounter_id = d.encounter_id \
                 AND i.deleted_at IS NULL AND i.status <> 'cancelled') \
     ), picked AS ( \
       SELECT * FROM due WHERE unit_price IS DISTINCT FROM 0 \
        ORDER BY service_at, order_id LIMIT $4 \
     ) \
     INSERT INTO charge_attention_items \
       (tenant_id, source_module, setting_module, source_entity_id, patient_id, encounter_id, \
        department_id, service_at, charge_code, quantity, description_override, \
        unit_price_override, tax_percent_override, apply_concessions, reason, created_by) \
     SELECT $1, module, setting, order_id, patient_id, encounter_id, department_id, \
            service_at, charge_code, quantity, description, unit_price, tax_percent, false, ",
            $reason,
            ", $5 \
       FROM picked \
     ON CONFLICT (tenant_id, source_module, source_entity_id) \
       WHERE status = 'open' AND deleted_at IS NULL DO NOTHING"
        )
    };
}

/// One batch of orders done and never billed, raised as `unbilled_order`.
pub(super) const QUEUE_BATCH: &str = queue_batch_sql!(done_sql, "'unbilled_order'");

/// One batch of stock used on a patient and never billed, raised as
/// `unbilled_consumption` (migration 1421). Same rules, prices and packages.
pub(super) const QUEUE_CONSUMPTION_BATCH: &str =
    queue_batch_sql!(consumed_sql, "'unbilled_consumption'");

/// The record `$2`/`$3` (module, id) of the rows `$done` gives, as it stands
/// now: no row when it is no longer done (cancelled, deleted, un-verified,
/// returned), else whether a bill already carries it. Run in the posting
/// transaction.
macro_rules! recheck_sql {
    ($done:ident) => {
        concat!(
            "WITH done AS (",
            $done!(),
            ") SELECT ",
            billed_sql!(),
            " AS billed, d.quantity FROM done d WHERE d.module = $2 AND d.order_id = $3"
        )
    };
}

/// Re-check of an unbilled order.
pub(super) const RECHECK: &str = recheck_sql!(done_sql);

/// Re-check of unbilled stock use.
pub(super) const RECHECK_CONSUMPTION: &str = recheck_sql!(consumed_sql);
