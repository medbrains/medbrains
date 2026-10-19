//! The GST invoice as printed — and, when its lines are medicines, the
//! pharmacy bill: batch, expiry, MRP and schedule per line, the prescriber
//! and the pharmacist with their registrations, the drug licence, the
//! patient's address for Schedule H1/X, what the patient saved, the tax
//! split, a UPI link for the balance and a link that proves the bill genuine.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::{
    permissions,
    print_data::{GstInvoiceItemLine, GstInvoicePrintData},
};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
struct Header {
    invoice_number: String,
    patient_name: String,
    uhid: String,
    patient_phone: Option<String>,
    patient_address: Option<String>,
    subtotal: String,
    tax_amount: String,
    total_amount: String,
    cgst_total: String,
    sgst_total: String,
    paid_amount: String,
    balance_due: String,
    balance_positive: bool,
    verify_code: String,
    hospital_gstin: Option<String>,
    hospital_address: Option<String>,
    issued_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
}

/// What the medicine lines add: the people, the prescription, the totals.
#[derive(Debug, Default, sqlx::FromRow)]
struct Pharmacy {
    prescriber_name: Option<String>,
    prescriber_registration: Option<String>,
    pharmacist_name: Option<String>,
    pharmacist_registration: Option<String>,
    rx_valid_until: Option<chrono::NaiveDate>,
    refills_left: Option<i32>,
    mrp_total: Option<String>,
    savings: Option<String>,
}

const HEADER_SQL: &str = "SELECT inv.invoice_number, \
       (p.first_name || ' ' || p.last_name) AS patient_name, p.uhid, \
       NULLIF(p.phone, '') AS patient_phone, \
       NULLIF(concat_ws(', ', NULLIF(p.address->>'line1', ''), NULLIF(p.address->>'city', ''), \
                        NULLIF(p.address->>'postal_code', '')), '') AS patient_address, \
       inv.subtotal::text AS subtotal, inv.tax_amount::text AS tax_amount, \
       inv.total_amount::text AS total_amount, \
       COALESCE(inv.cgst_amount, 0)::text AS cgst_total, \
       COALESCE(inv.sgst_amount, 0)::text AS sgst_total, \
       COALESCE(inv.paid_amount, 0)::text AS paid_amount, \
       GREATEST(inv.total_amount - COALESCE(inv.paid_amount, 0), 0)::text AS balance_due, \
       inv.total_amount > COALESCE(inv.paid_amount, 0) AS balance_positive, \
       inv.verify_code, \
       NULLIF(gst.value #>> '{}', '') AS hospital_gstin, NULLIF(addr.value #>> '{}', '') AS hospital_address, \
       inv.issued_at, inv.created_at \
     FROM invoices inv \
     JOIN patients p ON p.id = inv.patient_id AND p.tenant_id = inv.tenant_id \
     LEFT JOIN tenant_settings gst ON gst.tenant_id = inv.tenant_id AND gst.category = 'billing' \
          AND gst.key = 'gst_number' AND gst.deleted_at IS NULL \
     LEFT JOIN tenant_settings addr ON addr.tenant_id = inv.tenant_id AND addr.category = 'billing' \
          AND addr.key = 'bill_address' AND addr.deleted_at IS NULL \
     WHERE inv.id = $1 AND inv.tenant_id = $2 AND inv.deleted_at IS NULL";

const ITEMS_SQL: &str = "SELECT ii.description, COALESCE(ii.hsn_sac_code, pc.hsn_code) AS hsn_code, \
       ii.quantity, ii.unit_price::text AS unit_price, ii.tax_percent::text AS tax_percent, \
       ii.total_price::text AS total_price, \
       COALESCE(pc.inn_name, pc.generic_name) AS generic_name, pc.drug_schedule AS schedule, \
       pc.manufacturer, COALESCE(ii.batch_number, pb.batch_number) AS batch_number, \
       to_char(COALESCE(ii.expiry_date, pb.expiry_date), 'MM/YY') AS expiry, \
       COALESCE(psi.mrp, pc.mrp)::text AS mrp, \
       COALESCE(ii.discount_amount, 0)::text AS discount_amount, \
       COALESCE(ii.cgst_amount, 0)::text AS cgst_amount, COALESCE(ii.sgst_amount, 0)::text AS sgst_amount \
     FROM invoice_items ii \
     LEFT JOIN pharmacy_batches pb ON pb.id = ii.pharmacy_batch_id \
     LEFT JOIN pharmacy_pos_sale_items psi ON psi.id = ii.source_id \
          AND ii.source_module = 'pharmacy_pos' AND psi.tenant_id = ii.tenant_id \
     LEFT JOIN pharmacy_catalog pc ON pc.id = COALESCE(pb.catalog_item_id, psi.catalog_item_id) \
     WHERE ii.invoice_id = $1 AND ii.tenant_id = $2 AND ii.deleted_at IS NULL \
     ORDER BY ii.created_at LIMIT 5000";

/// From the medicine lines: who prescribed and dispensed, the prescription's
/// validity and refills, and MRP against what was billed.
const PHARMACY_SQL: &str = "WITH lines AS ( \
       SELECT ii.ordering_doctor_id, ii.pharmacy_order_id, ii.quantity, ii.total_price, \
              COALESCE(psi.mrp, pc.mrp) AS mrp \
         FROM invoice_items ii \
         LEFT JOIN pharmacy_batches pb ON pb.id = ii.pharmacy_batch_id \
         LEFT JOIN pharmacy_pos_sale_items psi ON psi.id = ii.source_id \
              AND ii.source_module = 'pharmacy_pos' AND psi.tenant_id = ii.tenant_id \
         LEFT JOIN pharmacy_catalog pc ON pc.id = COALESCE(pb.catalog_item_id, psi.catalog_item_id) \
        WHERE ii.invoice_id = $1 AND ii.tenant_id = $2 AND ii.deleted_at IS NULL \
          AND (pb.id IS NOT NULL OR psi.id IS NOT NULL)), \
     ord AS (SELECT po.* FROM pharmacy_orders po \
              WHERE po.id = (SELECT pharmacy_order_id FROM lines WHERE pharmacy_order_id IS NOT NULL LIMIT 1)) \
     SELECT doc.full_name AS prescriber_name, \
            COALESCE(doc.medical_registration_number, doc.registration_number) AS prescriber_registration, \
            ph.full_name AS pharmacist_name, ph.registration_number AS pharmacist_registration, \
            rx.valid_until AS rx_valid_until, \
            GREATEST(rx.repeats_allowed - rx.repeats_used, 0) AS refills_left, \
            (SELECT SUM(mrp * quantity)::text FROM lines WHERE mrp IS NOT NULL) AS mrp_total, \
            (SELECT NULLIF(GREATEST(SUM(mrp * quantity) - SUM(total_price), 0), 0)::text \
               FROM lines WHERE mrp IS NOT NULL) AS savings \
       FROM (SELECT 1) one \
       LEFT JOIN ord ON true \
       LEFT JOIN users doc ON doc.id = COALESCE( \
            (SELECT ordering_doctor_id FROM lines WHERE ordering_doctor_id IS NOT NULL LIMIT 1), \
            (SELECT doctor_id FROM prescriptions WHERE id = ord.prescription_id)) \
       LEFT JOIN users ph ON ph.id = COALESCE(ord.dispensed_by, ord.pharmacist_reviewed_by) \
       LEFT JOIN prescriptions rx ON rx.id = ord.prescription_id";

async fn setting(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    category: &str,
    key: &str,
) -> Result<Option<String>, AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(category)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value.and_then(|v| {
        v.as_str()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
    }))
}

/// Percent-encodes a query value (RFC 3986 unreserved characters pass).
fn enc(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// `upi://pay` for the balance, readable by any UPI app.
fn upi_link(vpa: &str, payee: &str, amount: &str, invoice: &str) -> String {
    format!(
        "upi://pay?pa={}&pn={}&am={amount}&cu=INR&tn={}",
        enc(vpa),
        enc(payee),
        enc(&format!("Bill {invoice}"))
    )
}

pub async fn get_gst_invoice_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<GstInvoicePrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    gst_invoice_print_data_in_tx(tx, &claims, invoice_id).await
}

/// `GET /api/print-data/pharmacy-bill/{invoice_id}` — the same tax invoice for
/// a counter sale, printed by the pharmacy without billing's invoice access.
/// Only an invoice the counter posted: anything else is not found.
pub async fn get_pharmacy_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<GstInvoicePrintData>, AppError> {
    require_permission(&claims, permissions::pharmacy::bills::PRINT)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let is_counter_bill: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM invoice_items ii \
                         WHERE ii.tenant_id = $1 AND ii.invoice_id = $2 \
                           AND ii.source_module = 'pharmacy_pos' AND ii.deleted_at IS NULL)",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .fetch_one(&mut *tx)
    .await?;
    if !is_counter_bill {
        return Err(AppError::NotFound);
    }
    gst_invoice_print_data_in_tx(tx, &claims, invoice_id).await
}

async fn gst_invoice_print_data_in_tx(
    mut tx: Transaction<'static, Postgres>,
    claims: &Claims,
    invoice_id: Uuid,
) -> Result<Json<GstInvoicePrintData>, AppError> {
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;
    let h = sqlx::query_as::<_, Header>(HEADER_SQL)
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let items = sqlx::query_as::<_, GstInvoiceItemLine>(ITEMS_SQL)
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;
    let is_pharmacy = items
        .iter()
        .any(|i| i.batch_number.is_some() || i.schedule.is_some());
    let pharmacy = if is_pharmacy {
        sqlx::query_as::<_, Pharmacy>(PHARMACY_SQL)
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?
    } else {
        Pharmacy::default()
    };
    let hospital_name = crate::billing::hospital_name(&mut tx, claims.tenant_id).await?;
    let drug_licence = if is_pharmacy {
        setting(&mut tx, claims.tenant_id, "billing", "drug_licence").await?
    } else {
        None
    };
    let vpa = setting(&mut tx, claims.tenant_id, "payments", "upi_vpa").await?;
    tx.commit().await?;

    let mut schedules: Vec<String> = items.iter().filter_map(|i| i.schedule.clone()).collect();
    schedules.sort();
    schedules.dedup();
    let restricted = schedules.iter().any(|s| matches!(s.as_str(), "H1" | "X"));
    let payee = hospital_name
        .clone()
        .unwrap_or_else(|| "Hospital".to_owned());
    let upi = vpa
        .filter(|_| h.balance_positive)
        .map(|v| upi_link(&v, &payee, &h.balance_due, &h.invoice_number));
    let verify_url = std::env::var("MEDBRAINS_PUBLIC_BASE_URL").ok().map(|base| {
        format!(
            "{}/verify/bill?n={}&c={}",
            base.trim_end_matches('/'),
            enc(&h.invoice_number),
            h.verify_code
        )
    });
    Ok(Json(GstInvoicePrintData {
        date: h
            .issued_at
            .unwrap_or(h.created_at)
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        invoice_number: h.invoice_number,
        patient_name: h.patient_name,
        uhid: h.uhid,
        patient_phone: h.patient_phone,
        patient_address: h.patient_address.filter(|_| restricted),
        subtotal: h.subtotal,
        tax_amount: h.tax_amount,
        total_amount: h.total_amount,
        cgst_total: h.cgst_total,
        sgst_total: h.sgst_total,
        paid_amount: h.paid_amount,
        balance_due: h.balance_due,
        hospital_gstin: h.hospital_gstin,
        hospital_name,
        hospital_address: h.hospital_address,
        items,
        is_pharmacy,
        prescriber_name: pharmacy.prescriber_name,
        prescriber_registration: pharmacy.prescriber_registration,
        pharmacist_name: pharmacy.pharmacist_name,
        pharmacist_registration: pharmacy.pharmacist_registration,
        drug_licence,
        mrp_total: pharmacy.mrp_total,
        savings: pharmacy.savings,
        rx_valid_until: pharmacy
            .rx_valid_until
            .map(|d| d.format("%d-%b-%Y").to_string()),
        refills_left: pharmacy.refills_left,
        schedules,
        upi_link: upi,
        verify_url,
    }))
}

#[cfg(test)]
mod tests {
    use super::{enc, upi_link};

    #[test]
    fn upi_link_encodes_names_and_carries_the_amount() {
        let link = upi_link("amh@okaxis", "Alagappa Hospital", "412.50", "INV-26/104");
        assert_eq!(
            link,
            "upi://pay?pa=amh%40okaxis&pn=Alagappa%20Hospital&am=412.50&cu=INR&tn=Bill%20INV-26%2F104"
        );
        assert_eq!(enc("a-b_c.d~e"), "a-b_c.d~e");
    }
}
