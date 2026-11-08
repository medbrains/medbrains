//! The charge attention queue's one row query, shared by the list and by
//! every read of one row.

/// The queue's one query: item, patient and both people joined once.
pub(super) const ITEM_SELECT: &str = "SELECT a.id, a.source_module, a.setting_module, a.source_entity_id, \
        a.patient_id, a.encounter_id, a.charge_code, a.quantity, a.description_override, \
        a.unit_price_override, a.tax_percent_override, a.apply_concessions, a.reason, a.status, \
        a.invoice_id, a.dismiss_reason, ru.full_name AS resolved_by_name, a.resolved_at, \
        cu.full_name AS created_by_name, a.created_at, \
        CASE WHEN p.id IS NOT NULL \
             THEN btrim(concat_ws(' ', p.first_name, p.last_name)) END AS patient_name, p.uhid, \
        a.department_id, d.name AS department_name, a.service_at, \
        (now()::date - COALESCE(a.service_at, a.created_at)::date)::int4 AS age_days, \
        a.unit_price_override * a.quantity AS amount, \
        CASE WHEN a.reason = 'implant_no_patient' THEN \
          (SELECT string_agg(btrim(concat_ws(' ', rp.first_name, rp.last_name)) \
                             || ' (' || rp.uhid || ')', ', ' ORDER BY r.created_at) \
             FROM store_stock_movements um \
             JOIN implant_registry r ON r.tenant_id = um.tenant_id \
                  AND r.batch_stock_id = um.batch_stock_id AND r.deleted_at IS NULL \
                  AND r.implant_date BETWEEN um.created_at::date - 3 \
                                         AND um.created_at::date + 3 \
             JOIN patients rp ON rp.id = r.patient_id AND rp.tenant_id = r.tenant_id \
            WHERE um.id = a.source_entity_id AND um.tenant_id = a.tenant_id) \
        END AS registry_patients \
   FROM charge_attention_items a \
   LEFT JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
   LEFT JOIN departments d ON d.id = a.department_id \
   LEFT JOIN users ru ON ru.id = a.resolved_by \
   LEFT JOIN users cu ON cu.id = a.created_by";
