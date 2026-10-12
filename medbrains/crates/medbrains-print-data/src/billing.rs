//! Print-data endpoints — billing & financial documents.
//!
//! Each handler assembles the context data that a Handlebars template needs to
//! render a printable document. No HTML is produced here; the frontend template
//! engine does the rendering.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AdvanceReceiptPrintData, BillCategoryTotal, BillLineItem, CashlessClaimPrintData,
    CreditNotePrintData, EstimateItemLine, EstimatePrintData, InsuranceClaimPrintData,
    InsurancePreauthPrintData, IpdFinalBillPrintData, IpdInterimBillPrintData,
    NoDuesCertificatePrintData, OpdBillPrintData, PackageBillPrintData, PackageEstimatePrintData,
    ReceiptPrintData, RefundReceiptPrintData,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── Helper: fetch hospital name from tenants table ───────

pub(crate) async fn hospital_name(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Option<String>, AppError> {
    let name = sqlx::query_scalar::<_, Option<String>>("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .flatten();
    Ok(name)
}

// ── Receipt ──────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ReceiptRow {
    receipt_id: Uuid,
    receipt_number: String,
    invoice_id: Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    reference_number: Option<String>,
    patient_name: String,
    uhid: String,
    invoice_number: String,
    amount: String,
    payment_mode: String,
    received_by: Option<String>,
    paid_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ReceiptPrintQuery {
    pub reprint_reason: Option<String>,
}

pub async fn get_receipt_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(payment_id): Path<Uuid>,
    Query(query): Query<ReceiptPrintQuery>,
) -> Result<Json<ReceiptPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::billing::receipts::PRINT)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::PAYMENT,
        payment_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'billing' \
           AND source_table = 'payments' \
           AND source_id = $2 \
           AND title = 'Billing Receipt' \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(payment_id)
    .fetch_one(&mut *tx)
    .await?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(&claims, permissions::billing::receipts::REPRINT)?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first receipt print".to_owned(),
            ));
        }
    } else if reprint_reason.is_some() {
        return Err(AppError::BadRequest(
            "receipt has not been printed yet".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, ReceiptRow>(
        "SELECT \
           r.id AS receipt_id, \
           r.receipt_number, \
           inv.id AS invoice_id, \
           inv.patient_id, \
           inv.encounter_id, \
           pay.reference_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           inv.invoice_number, \
           pay.amount::text AS amount, \
           pay.mode::text AS payment_mode, \
           u.full_name AS received_by, \
           pay.paid_at \
         FROM payments pay \
         JOIN invoices inv ON inv.id = pay.invoice_id \
                           AND inv.tenant_id = pay.tenant_id \
         JOIN receipts r ON r.payment_id = pay.id \
                        AND r.invoice_id = inv.id \
                        AND r.tenant_id = pay.tenant_id \
         JOIN patients p ON p.id = inv.patient_id \
                         AND p.tenant_id = inv.tenant_id \
         LEFT JOIN users u ON u.id = pay.received_by \
         WHERE pay.id = $1 AND pay.tenant_id = $2 \
         ORDER BY r.created_at DESC \
         LIMIT 1",
    )
    .bind(payment_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("generate a receipt before preparing print data".to_owned())
    })?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    let today = chrono::Utc::now()
        .with_timezone(&tz)
        .format("%Y%m%d")
        .to_string();
    let document_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND document_number LIKE 'BIL-RCPT-' || $2 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;
    let document_number = format!("BIL-RCPT-{today}-{:04}", document_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": "billing_receipt",
        "action": print_action,
        "payment_id": payment_id,
        "receipt_id": row.receipt_id,
        "receipt_number": &row.receipt_number,
        "invoice_id": row.invoice_id,
        "patient_id": row.patient_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'billing', 'payments', $2, $3, $4, NULL, \
          $5, 'Billing Receipt', 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $6::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(payment_id)
    .bind(row.patient_id)
    .bind(row.encounter_id)
    .bind(&document_number)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE receipts \
         SET printed_at = COALESCE(printed_at, now()) \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row.receipt_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": &document_number,
        "document_type": "billing_receipt",
        "action": print_action,
        "receipt_id": row.receipt_id,
        "receipt_number": &row.receipt_number,
        "payment_id": payment_id,
        "invoice_id": row.invoice_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "billing.receipt.reprint"
            } else {
                "billing.receipt.print"
            },
            entity_type: "payment",
            entity_id: Some(payment_id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;

    Ok(Json(ReceiptPrintData {
        document_number,
        is_reprint,
        receipt_number: Some(row.receipt_number),
        patient_name: row.patient_name,
        uhid: row.uhid,
        invoice_number: row.invoice_number,
        amount: row.amount,
        payment_mode: row.payment_mode,
        reference_number: row.reference_number,
        received_by: row.received_by,
        paid_at: row
            .paid_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        hospital_name: h_name,
    }))
}

// ── Estimate / Proforma ──────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct EstimateHeaderRow {
    invoice_number: String,
    patient_name: String,
    uhid: String,
    subtotal: String,
    tax_amount: String,
    discount_amount: String,
    total_amount: String,
    issued_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_estimate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<EstimatePrintData>, AppError> {
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
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let header = sqlx::query_as::<_, EstimateHeaderRow>(
        "SELECT \
           inv.invoice_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           inv.subtotal::text AS subtotal, \
           inv.tax_amount::text AS tax_amount, \
           inv.discount_amount::text AS discount_amount, \
           inv.total_amount::text AS total_amount, \
           inv.issued_at, \
           inv.created_at \
         FROM invoices inv \
         JOIN patients p ON p.id = inv.patient_id \
                         AND p.tenant_id = inv.tenant_id \
         WHERE inv.id = $1 AND inv.tenant_id = $2 AND inv.deleted_at IS NULL",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, EstimateItemLine>(
        "SELECT description, quantity, \
                unit_price::text AS unit_price, \
                total_price::text AS total_price \
         FROM invoice_items \
         WHERE invoice_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let date = header
        .issued_at
        .unwrap_or(header.created_at)
        .with_timezone(&tz)
        .format("%d-%b-%Y")
        .to_string();

    Ok(Json(EstimatePrintData {
        invoice_number: header.invoice_number,
        patient_name: header.patient_name,
        uhid: header.uhid,
        subtotal: header.subtotal,
        tax_amount: header.tax_amount,
        discount_amount: header.discount_amount,
        total_amount: header.total_amount,
        items,
        hospital_name: h_name,
        date,
    }))
}

// ── GST Invoice ──────────────────────────────────────────

// ── OPD Bill ─────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct OpdBillHeaderRow {
    invoice_number: String,
    issued_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    phone: String,
    doctor_name: Option<String>,
    department: Option<String>,
    subtotal: String,
    discount_amount: String,
    tax_amount: String,
    total_amount: String,
    hospital_gstin: Option<String>,
}

pub async fn get_opd_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<OpdBillPrintData>, AppError> {
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
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let header = sqlx::query_as::<_, OpdBillHeaderRow>(
        "SELECT \
           inv.invoice_number, \
           inv.issued_at, \
           inv.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.phone, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           inv.subtotal::text AS subtotal, \
           inv.discount_amount::text AS discount_amount, \
           inv.tax_amount::text AS tax_amount, \
           inv.total_amount::text AS total_amount, \
           (SELECT NULLIF(ts.value #>> '{}', '') FROM tenant_settings ts \
            WHERE ts.tenant_id = inv.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'gst_number' AND ts.deleted_at IS NULL \
            LIMIT 1) AS hospital_gstin \
         FROM invoices inv \
         JOIN patients p ON p.id = inv.patient_id AND p.tenant_id = inv.tenant_id \
         LEFT JOIN users u ON u.id = inv.doctor_id \
         LEFT JOIN departments d ON d.id = inv.department_id AND d.tenant_id = inv.tenant_id \
         WHERE inv.id = $1 AND inv.tenant_id = $2 AND inv.deleted_at IS NULL",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, BillLineItem>(
        "SELECT \
           description, \
           service_code, \
           hsn_sac_code AS hsn_sac, \
           quantity, \
           unit_price::text AS unit_price, \
           discount_amount::text AS discount, \
           COALESCE(tax_percent, 0)::text AS tax_percent, \
           total_price::text AS total \
         FROM invoice_items \
         WHERE invoice_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Paid = the invoice's own running total (payments + advance adjustments);
    // mode = every mode actually used, none when nothing has been paid.
    let payments: (String, String, Option<String>) = sqlx::query_as(
        "SELECT \
           inv.paid_amount::text, \
           (inv.total_amount - inv.paid_amount - inv.written_off_amount)::text, \
           (SELECT string_agg(DISTINCT pay.mode::text, ', ') FROM payments pay \
            WHERE pay.invoice_id = inv.id AND pay.tenant_id = inv.tenant_id \
              AND pay.status = 'completed' AND pay.deleted_at IS NULL) \
         FROM invoices inv \
         WHERE inv.id = $1 AND inv.tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let date = header
        .issued_at
        .unwrap_or(header.created_at)
        .with_timezone(&tz)
        .format("%d-%b-%Y")
        .to_string();

    let age_str = header.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(OpdBillPrintData {
        invoice_number: header.invoice_number,
        invoice_date: date,
        patient_name: header.patient_name,
        uhid: header.uhid,
        age: age_str,
        gender: header.gender,
        phone: header.phone,
        doctor_name: header.doctor_name,
        department: header.department,
        items,
        subtotal: header.subtotal,
        discount_amount: header.discount_amount,
        tax_amount: header.tax_amount,
        total_amount: header.total_amount,
        amount_paid: payments.0,
        balance_due: payments.1,
        payment_mode: payments.2,
        hospital_name: h_name,
        hospital_gstin: header.hospital_gstin,
    }))
}

// ── IPD Interim Bill ────────────────────────────────────

/// Sorts an invoice line into a printed charge head from what the row records:
/// its own `category`, else the charge master's category for its code, else
/// the module that raised it. Expects `it` = `invoice_items`, `hc.category`.
/// Constant, never caller input — safe to interpolate.
const CHARGE_HEAD_SQL: &str = "CASE \
   WHEN it.charge_code = 'ROOM_RENT' OR hc.category = 'Room Charges' THEN 'room' \
   WHEN hc.category = 'Nursing' THEN 'nursing' \
   WHEN it.source IN ('lab'::charge_source, 'radiology'::charge_source) THEN 'investigation' \
   WHEN it.source = 'pharmacy'::charge_source THEN 'medicine' \
   WHEN hc.category = 'Consultation' OR it.source = 'opd'::charge_source THEN 'consultation' \
   WHEN hc.category IN ('Procedures', 'OT Charges') \
     OR it.source IN ('procedure'::charge_source, 'ot'::charge_source) THEN 'procedure' \
   WHEN it.source = 'consumable'::charge_source THEN 'consumable' \
   ELSE 'other' END";

/// Joins `hc.category` for `CHARGE_HEAD_SQL`.
const CHARGE_CATEGORY_JOIN: &str = "LEFT JOIN LATERAL (SELECT COALESCE(it.category, \
     (SELECT cm.category FROM charge_master cm \
      WHERE cm.tenant_id = it.tenant_id AND cm.code = it.charge_code \
        AND cm.deleted_at IS NULL LIMIT 1)) AS category) hc ON true";

#[derive(Debug, sqlx::FromRow)]
struct IpdInterimBillRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: chrono::DateTime<chrono::Utc>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    doctor_name: Option<String>,
    department: Option<String>,
    diagnosis: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct IpdInterimTotalsRow {
    subtotal: String,
    discount: String,
    tax: String,
    total: String,
    advance_paid: String,
    balance_due: String,
}

pub async fn get_ipd_interim_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IpdInterimBillPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_admission_billing_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IpdInterimBillRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           bl.name AS bed_number, \
           w.name AS ward_name, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           COALESCE(adm.primary_diagnosis, adm.provisional_diagnosis) AS diagnosis \
         FROM admissions adm \
         JOIN patients p ON p.id = adm.patient_id AND p.tenant_id = adm.tenant_id \
         LEFT JOIN locations bl ON bl.id = adm.bed_id AND bl.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = adm.ward_id AND w.tenant_id = adm.tenant_id \
         LEFT JOIN users u ON u.id = COALESCE(adm.attending_doctor_id, adm.admitting_doctor) \
         LEFT JOIN departments d ON d.id = adm.department_id AND d.tenant_id = adm.tenant_id \
         WHERE adm.id = $1 AND adm.tenant_id = $2 AND adm.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Charge heads: every live line on every live invoice raised for the stay.
    // This bill has no nursing head, so nursing folds into "other".
    let charges: Vec<(String, String)> = sqlx::query_as(&format!(
        "SELECT CASE WHEN ({CHARGE_HEAD_SQL}) = 'nursing' THEN 'other' \
                ELSE ({CHARGE_HEAD_SQL}) END AS head, \
                SUM(it.total_price)::text AS amount \
         FROM invoice_items it \
         JOIN invoices inv ON inv.id = it.invoice_id AND inv.tenant_id = it.tenant_id \
         {CHARGE_CATEGORY_JOIN} \
         WHERE inv.admission_id = $1 AND inv.tenant_id = $2 \
           AND inv.deleted_at IS NULL AND it.deleted_at IS NULL \
           AND inv.status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status) \
         GROUP BY 1 LIMIT 20"
    ))
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut room_charges = "0.00".to_string();
    let mut investigation_charges = "0.00".to_string();
    let mut procedure_charges = "0.00".to_string();
    let mut pharmacy_charges = "0.00".to_string();
    let mut consumable_charges = "0.00".to_string();
    let mut professional_fees = "0.00".to_string();
    let mut other_charges = "0.00".to_string();

    for (head, amt) in charges {
        match head.as_str() {
            "room" => room_charges = amt,
            "investigation" => investigation_charges = amt,
            "procedure" => procedure_charges = amt,
            "medicine" => pharmacy_charges = amt,
            "consumable" => consumable_charges = amt,
            "consultation" => professional_fees = amt,
            _ => other_charges = amt,
        }
    }

    let items = sqlx::query_as::<_, BillLineItem>(
        "SELECT \
           it.description, \
           it.service_code, \
           it.hsn_sac_code AS hsn_sac, \
           it.quantity, \
           it.unit_price::text AS unit_price, \
           it.discount_amount::text AS discount, \
           it.tax_percent::text AS tax_percent, \
           it.total_price::text AS total \
         FROM invoice_items it \
         JOIN invoices inv ON inv.id = it.invoice_id AND inv.tenant_id = it.tenant_id \
         WHERE inv.admission_id = $1 AND inv.tenant_id = $2 \
           AND inv.deleted_at IS NULL AND it.deleted_at IS NULL \
           AND inv.status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status) \
         ORDER BY it.created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Balance = billed − paid on the invoices (which already includes advances
    // adjusted against them) − written off − advance money not yet adjusted.
    let totals = sqlx::query_as::<_, IpdInterimTotalsRow>(
        "WITH inv AS ( \
           SELECT COALESCE(SUM(subtotal), 0) AS subtotal, \
                  COALESCE(SUM(discount_amount), 0) AS discount, \
                  COALESCE(SUM(tax_amount), 0) AS tax, \
                  COALESCE(SUM(total_amount), 0) AS total, \
                  COALESCE(SUM(paid_amount + written_off_amount), 0) AS settled \
           FROM invoices \
           WHERE admission_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
             AND status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status)), \
         adv AS ( \
           SELECT COALESCE(SUM(pa.amount), 0) AS received, \
                  COALESCE(SUM(pa.balance), 0) AS unadjusted \
           FROM patient_advances pa \
           JOIN admissions a ON a.encounter_id = pa.encounter_id AND a.tenant_id = pa.tenant_id \
           WHERE a.id = $1 AND pa.tenant_id = $2 AND pa.deleted_at IS NULL \
             AND pa.status <> 'refunded'::advance_status) \
         SELECT inv.subtotal::text AS subtotal, inv.discount::text AS discount, \
                inv.tax::text AS tax, inv.total::text AS total, \
                adv.received::text AS advance_paid, \
                (inv.total - inv.settled - adv.unadjusted)::text AS balance_due \
         FROM inv, adv",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let los_days: i32 = sqlx::query_scalar(
        "SELECT GREATEST(1, EXTRACT(DAY FROM (COALESCE(discharged_at, NOW()) - admitted_at)))::int \
         FROM admissions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(IpdInterimBillPrintData {
        bill_number: format!(
            "INT-{}",
            admission_id.to_string().split('-').next().unwrap_or("")
        ),
        bill_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row
            .admission_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        doctor_name: row.doctor_name,
        department: row.department,
        diagnosis: row.diagnosis,
        room_charges,
        investigation_charges,
        procedure_charges,
        pharmacy_charges,
        consumable_charges,
        professional_fees,
        other_charges,
        items,
        subtotal: totals.subtotal,
        discount_amount: totals.discount,
        tax_amount: totals.tax,
        total_amount: totals.total,
        advance_paid: totals.advance_paid,
        balance_due: totals.balance_due,
        los_days,
        hospital_name: h_name,
    }))
}

// ── IPD Final Bill ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct IpdFinalBillRow {
    invoice_number: String,
    issued_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    doctor_name: Option<String>,
    department: Option<String>,
    diagnosis: Option<String>,
    discharge_type: Option<String>,
    subtotal: String,
    discount_amount: String,
    tax_amount: String,
    total_amount: String,
    hospital_gstin: Option<String>,
}

pub async fn get_ipd_final_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<IpdFinalBillPrintData>, AppError> {
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
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IpdFinalBillRow>(
        "SELECT \
           inv.invoice_number, \
           inv.issued_at, \
           inv.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           bl.name AS bed_number, \
           w.name AS ward_name, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           adm.primary_diagnosis AS diagnosis, \
           adm.discharge_type, \
           inv.subtotal::text AS subtotal, \
           inv.discount_amount::text AS discount_amount, \
           inv.tax_amount::text AS tax_amount, \
           inv.total_amount::text AS total_amount, \
           (SELECT NULLIF(ts.value #>> '{}', '') FROM tenant_settings ts \
            WHERE ts.tenant_id = inv.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'gst_number' AND ts.deleted_at IS NULL \
            LIMIT 1) AS hospital_gstin \
         FROM invoices inv \
         JOIN patients p ON p.id = inv.patient_id AND p.tenant_id = inv.tenant_id \
         LEFT JOIN admissions adm ON adm.id = inv.admission_id AND adm.tenant_id = inv.tenant_id \
         LEFT JOIN locations bl ON bl.id = adm.bed_id AND bl.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = adm.ward_id AND w.tenant_id = adm.tenant_id \
         LEFT JOIN users u ON u.id = COALESCE(adm.attending_doctor_id, inv.doctor_id) \
         LEFT JOIN departments d ON d.id = COALESCE(adm.department_id, inv.department_id) \
           AND d.tenant_id = inv.tenant_id \
         WHERE inv.id = $1 AND inv.tenant_id = $2 AND inv.deleted_at IS NULL",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get category breakups
    let category_totals: Vec<BillCategoryTotal> = sqlx::query_as(
        "SELECT \
           COALESCE(category, 'Other') AS category, \
           SUM(total_price)::text AS amount \
         FROM invoice_items \
         WHERE invoice_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         GROUP BY category \
         ORDER BY category LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get line items
    let items = sqlx::query_as::<_, BillLineItem>(
        "SELECT \
           description, \
           service_code, \
           hsn_sac_code AS hsn_sac, \
           quantity, \
           unit_price::text AS unit_price, \
           COALESCE(discount_amount, 0)::text AS discount, \
           COALESCE(tax_percent, 0)::text AS tax_percent, \
           total_price::text AS total \
         FROM invoice_items \
         WHERE invoice_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY category, created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Nothing writes `payments.payment_type` other than 'bill', so advance and
    // insurance come from the rows that record them, and paid from the
    // invoice's own running total (payments + advance adjustments).
    let payments: (String, String, String, String, String) = sqlx::query_as(
        "SELECT adv::text, ins::text, inv.paid_amount::text, \
           (inv.total_amount - ins)::text, \
           (inv.total_amount - inv.paid_amount - inv.written_off_amount)::text \
         FROM invoices inv, \
         LATERAL (SELECT COALESCE(SUM(aa.amount_adjusted), 0) AS adv \
                  FROM advance_adjustments aa \
                  WHERE aa.invoice_id = inv.id AND aa.tenant_id = inv.tenant_id \
                    AND aa.deleted_at IS NULL) a, \
         LATERAL (SELECT COALESCE(SUM(ic.approved_amount), 0) AS ins \
                  FROM insurance_claims ic \
                  WHERE ic.invoice_id = inv.id AND ic.tenant_id = inv.tenant_id \
                    AND ic.deleted_at IS NULL) i \
         WHERE inv.id = $1 AND inv.tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Calculate LOS
    let los_days: i32 = row.admission_date.map_or(1, |adm| {
        let discharge = row.discharge_date.unwrap_or_else(chrono::Utc::now);
        ((discharge - adm).num_days().max(1)) as i32
    });

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let date = row
        .issued_at
        .unwrap_or(row.created_at)
        .with_timezone(&tz)
        .format("%d-%b-%Y")
        .to_string();
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(IpdFinalBillPrintData {
        invoice_number: row.invoice_number,
        invoice_date: date,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row
            .admission_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        discharge_date: row
            .discharge_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        doctor_name: row.doctor_name,
        department: row.department,
        diagnosis: row.diagnosis,
        discharge_type: row.discharge_type,
        category_breakup: category_totals,
        items,
        subtotal: row.subtotal,
        discount_amount: row.discount_amount,
        tax_amount: row.tax_amount,
        total_amount: row.total_amount,
        advance_paid: payments.0,
        insurance_approved: payments.1,
        patient_payable: payments.3,
        amount_paid: payments.2,
        balance_due: payments.4,
        los_days,
        hospital_name: h_name,
        hospital_gstin: row.hospital_gstin,
    }))
}

// ── Consolidated Discharge Bill (all invoices for an admission) ──
//
// The single-invoice final bill above renders ONE invoice. A real
// discharge bill aggregates EVERY non-cancelled invoice raised against
// the admission — consultation, room, nursing, procedures, lab,
// pharmacy and consumables — into one document so the patient settles
// a single total. Reuses IpdFinalBillPrintData; the invoice_number is a
// synthesized admission reference rather than one invoice's number.

#[derive(Debug, sqlx::FromRow)]
struct ConsolidatedBillHeaderRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    doctor_name: Option<String>,
    department: Option<String>,
    diagnosis: Option<String>,
    discharge_type: Option<String>,
    hospital_gstin: Option<String>,
}

pub async fn get_admission_consolidated_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IpdFinalBillPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let header = sqlx::query_as::<_, ConsolidatedBillHeaderRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           bl.name AS bed_number, \
           w.name AS ward_name, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           adm.primary_diagnosis AS diagnosis, \
           adm.discharge_type, \
           (SELECT NULLIF(ts.value #>> '{}', '') FROM tenant_settings ts \
            WHERE ts.tenant_id = adm.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'gst_number' AND ts.deleted_at IS NULL \
            LIMIT 1) AS hospital_gstin \
         FROM admissions adm \
         JOIN patients p ON p.id = adm.patient_id AND p.tenant_id = adm.tenant_id \
         LEFT JOIN locations bl ON bl.id = adm.bed_id AND bl.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = adm.ward_id AND w.tenant_id = adm.tenant_id \
         LEFT JOIN users u ON u.id = COALESCE(adm.attending_doctor_id, adm.admitting_doctor) \
         LEFT JOIN departments d ON d.id = adm.department_id AND d.tenant_id = adm.tenant_id \
         WHERE adm.id = $1 AND adm.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Aggregate invoice totals across every live invoice for the admission.
    let totals: (String, String, String, String) = sqlx::query_as(
        "SELECT \
           COALESCE(SUM(subtotal), 0)::text, \
           COALESCE(SUM(discount_amount), 0)::text, \
           COALESCE(SUM(tax_amount), 0)::text, \
           COALESCE(SUM(total_amount), 0)::text \
         FROM invoices \
         WHERE admission_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
           AND status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status)",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let category_totals: Vec<BillCategoryTotal> = sqlx::query_as(
        "SELECT \
           COALESCE(it.category, 'Other') AS category, \
           SUM(it.total_price)::text AS amount \
         FROM invoice_items it \
         JOIN invoices inv ON inv.id = it.invoice_id \
         WHERE inv.admission_id = $1 AND inv.tenant_id = $2 \
           AND inv.deleted_at IS NULL AND it.deleted_at IS NULL \
           AND inv.status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status) \
         GROUP BY it.category \
         ORDER BY it.category LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, BillLineItem>(
        "SELECT \
           it.description, \
           it.service_code, \
           it.hsn_sac_code AS hsn_sac, \
           it.quantity, \
           it.unit_price::text AS unit_price, \
           COALESCE(it.discount_amount, 0)::text AS discount, \
           COALESCE(it.tax_percent, 0)::text AS tax_percent, \
           it.total_price::text AS total \
         FROM invoice_items it \
         JOIN invoices inv ON inv.id = it.invoice_id \
         WHERE inv.admission_id = $1 AND inv.tenant_id = $2 \
           AND inv.deleted_at IS NULL AND it.deleted_at IS NULL \
           AND inv.status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status) \
         ORDER BY it.category, it.created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Same sources as the single-invoice final bill, summed over the stay.
    let payments: (String, String, String, String, String) = sqlx::query_as(
        "WITH inv AS ( \
           SELECT id, tenant_id, total_amount, paid_amount, written_off_amount FROM invoices \
           WHERE admission_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
             AND status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status)), \
         t AS (SELECT COALESCE(SUM(total_amount), 0) AS total, \
                      COALESCE(SUM(paid_amount), 0) AS paid, \
                      COALESCE(SUM(written_off_amount), 0) AS written_off FROM inv), \
         a AS (SELECT COALESCE(SUM(aa.amount_adjusted), 0) AS adv FROM advance_adjustments aa \
               JOIN inv ON inv.id = aa.invoice_id AND inv.tenant_id = aa.tenant_id \
               WHERE aa.deleted_at IS NULL), \
         i AS (SELECT COALESCE(SUM(ic.approved_amount), 0) AS ins FROM insurance_claims ic \
               JOIN inv ON inv.id = ic.invoice_id AND inv.tenant_id = ic.tenant_id \
               WHERE ic.deleted_at IS NULL) \
         SELECT a.adv::text, i.ins::text, t.paid::text, (t.total - i.ins)::text, \
                (t.total - t.paid - t.written_off)::text \
         FROM t, a, i",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let los_days: i32 = header.admission_date.map_or(1, |adm| {
        let discharge = header.discharge_date.unwrap_or_else(chrono::Utc::now);
        i32::try_from((discharge - adm).num_days().max(1)).unwrap_or(1)
    });

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let date = header
        .discharge_date
        .unwrap_or_else(chrono::Utc::now)
        .with_timezone(&tz)
        .format("%d-%b-%Y")
        .to_string();
    let age_str = header.age.map(|a| format!("{} Y", a as i32));
    let admission_ref = format!("IP/{}", admission_id.to_string()[..8].to_uppercase());

    Ok(Json(IpdFinalBillPrintData {
        invoice_number: admission_ref,
        invoice_date: date,
        patient_name: header.patient_name,
        uhid: header.uhid,
        age: age_str,
        gender: header.gender,
        admission_date: header
            .admission_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        discharge_date: header
            .discharge_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        bed_number: header.bed_number,
        ward_name: header.ward_name,
        doctor_name: header.doctor_name,
        department: header.department,
        diagnosis: header.diagnosis,
        discharge_type: header.discharge_type,
        category_breakup: category_totals,
        items,
        subtotal: totals.0,
        discount_amount: totals.1,
        tax_amount: totals.2,
        total_amount: totals.3,
        advance_paid: payments.0,
        insurance_approved: payments.1,
        patient_payable: payments.3,
        amount_paid: payments.2,
        balance_due: payments.4,
        los_days,
        hospital_name: h_name,
        hospital_gstin: header.hospital_gstin,
    }))
}

// ── No-Dues Certificate ─────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct NoDuesRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    total_billed: String,
    total_paid: String,
    balance: String,
    issued_by: Option<String>,
    issued_at: chrono::DateTime<chrono::Utc>,
    notes: Option<String>,
}

pub async fn get_no_dues_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<NoDuesCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, NoDuesRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           w.name AS ward_name, \
           bl.name AS bed_number, \
           c.total_billed::text AS total_billed, \
           c.total_paid::text AS total_paid, \
           c.balance::text AS balance, \
           u.full_name AS issued_by, \
           c.created_at AS issued_at, \
           c.notes \
         FROM ipd_no_dues_certificates c \
         JOIN admissions adm ON adm.id = c.admission_id AND adm.tenant_id = c.tenant_id \
         JOIN patients p ON p.id = adm.patient_id AND p.tenant_id = adm.tenant_id \
         LEFT JOIN locations bl ON bl.id = adm.bed_id AND bl.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = adm.ward_id AND w.tenant_id = adm.tenant_id \
         LEFT JOIN users u ON u.id = c.issued_by \
         WHERE c.admission_id = $1 AND c.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(NoDuesCertificatePrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} Y", a as i32)),
        gender: row.gender,
        admission_date: row
            .admission_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        discharge_date: row
            .discharge_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        total_billed: row.total_billed,
        total_paid: row.total_paid,
        balance: row.balance,
        issued_by: row.issued_by,
        issued_at: row
            .issued_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        notes: row.notes,
        hospital_name: h_name,
    }))
}

// ── Advance Receipt ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AdvanceReceiptRow {
    advance_number: String,
    patient_name: String,
    uhid: String,
    admission_id: Option<Uuid>,
    amount: String,
    payment_mode: String,
    reference_number: Option<String>,
    purpose: String,
    received_by: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_advance_receipt_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(advance_id): Path<Uuid>,
) -> Result<Json<AdvanceReceiptPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::PATIENT_ADVANCE,
        advance_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdvanceReceiptRow>(
        "SELECT \
           pa.advance_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           (SELECT a.id FROM admissions a \
            WHERE a.encounter_id = pa.encounter_id AND a.tenant_id = pa.tenant_id \
              AND a.deleted_at IS NULL \
            ORDER BY a.admitted_at DESC LIMIT 1) AS admission_id, \
           pa.amount::text AS amount, \
           pa.payment_mode::text AS payment_mode, \
           pa.reference_number, \
           pa.purpose::text AS purpose, \
           u.full_name AS received_by, \
           pa.created_at \
         FROM patient_advances pa \
         JOIN patients p ON p.id = pa.patient_id AND p.tenant_id = pa.tenant_id \
         LEFT JOIN users u ON u.id = pa.received_by \
         WHERE pa.id = $1 AND pa.tenant_id = $2 AND pa.deleted_at IS NULL",
    )
    .bind(advance_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let amount_val: f64 = row.amount.parse().unwrap_or(0.0);
    let amount_in_words = number_to_words(amount_val);

    Ok(Json(AdvanceReceiptPrintData {
        receipt_number: row.advance_number,
        receipt_date: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_id: row.admission_id.map(|id| id.to_string()),
        amount: row.amount,
        amount_in_words,
        payment_mode: row.payment_mode,
        reference_number: row.reference_number,
        purpose: row.purpose,
        received_by: row.received_by,
        hospital_name: h_name,
    }))
}

// ── Refund Receipt ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct RefundReceiptRow {
    refund_number: String,
    patient_name: String,
    uhid: String,
    original_receipt: Option<String>,
    amount: String,
    mode: String,
    reference_number: Option<String>,
    reason: String,
    approved_by: Option<String>,
    processed_by: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_refund_receipt_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(refund_id): Path<Uuid>,
) -> Result<Json<RefundReceiptPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::REFUND,
        refund_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RefundReceiptRow>(
        "SELECT \
           r.refund_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           orig.reference_number AS original_receipt, \
           r.amount::text AS amount, \
           r.mode::text AS mode, \
           r.reference_number, \
           r.reason, \
           approver.full_name AS approved_by, \
           processor.full_name AS processed_by, \
           r.created_at \
         FROM refunds r \
         JOIN patients p ON p.id = r.patient_id AND p.tenant_id = r.tenant_id \
         LEFT JOIN payments orig ON orig.id = r.original_payment_id AND orig.tenant_id = r.tenant_id \
         LEFT JOIN users approver ON approver.id = r.approved_by \
         LEFT JOIN users processor ON processor.id = r.processed_by \
         WHERE r.id = $1 AND r.tenant_id = $2",
    )
    .bind(refund_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let amount_val: f64 = row.amount.parse().unwrap_or(0.0);
    let amount_in_words = number_to_words(amount_val);

    Ok(Json(RefundReceiptPrintData {
        receipt_number: row.refund_number,
        receipt_date: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        original_receipt_number: row.original_receipt,
        refund_amount: row.amount,
        amount_in_words,
        refund_mode: row.mode,
        reference_number: row.reference_number,
        reason: row.reason,
        approved_by: row.approved_by,
        processed_by: row.processed_by,
        hospital_name: h_name,
    }))
}

// ── Insurance Pre-Authorization ─────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PreauthRow {
    pa_number: String,
    created_at: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    policy_number: String,
    insurance_company: String,
    tpa_name: Option<String>,
    requested_start: Option<chrono::NaiveDate>,
    expected_los: Option<i32>,
    diagnosis: Option<String>,
    diagnosis_codes: Option<Vec<String>>,
    planned_procedure: Option<String>,
    estimated_cost: Option<String>,
    treating_doctor: Option<String>,
    contact_number: Option<String>,
}

pub async fn get_insurance_preauth_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<InsurancePreauthPrintData>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    // A pre-auth is a financial record: direct grant on the patient, as for
    // every other link in the billing group.
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM prior_auth_requests \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PreauthRow>(
        "SELECT \
           pa.pa_number, \
           pa.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           ins.policy_number, \
           ins.insurance_provider AS insurance_company, \
           ins.tpa_name, \
           pa.requested_start, \
           adm.estimated_los_days AS expected_los, \
           COALESCE(adm.primary_diagnosis, adm.provisional_diagnosis) AS diagnosis, \
           pa.diagnosis_codes, \
           COALESCE(pa.service_description, pa.service_type) AS planned_procedure, \
           pa.estimated_cost::text AS estimated_cost, \
           u.full_name AS treating_doctor, \
           COALESCE(p.phone, p.emergency_contact_phone) AS contact_number \
         FROM prior_auth_requests pa \
         JOIN patients p ON p.id = pa.patient_id AND p.tenant_id = pa.tenant_id \
         JOIN patient_insurance ins ON ins.id = pa.patient_insurance_id \
           AND ins.tenant_id = pa.tenant_id \
         LEFT JOIN LATERAL ( \
           SELECT a.estimated_los_days, a.primary_diagnosis, a.provisional_diagnosis \
           FROM admissions a \
           WHERE a.encounter_id = pa.encounter_id AND a.tenant_id = pa.tenant_id \
             AND a.deleted_at IS NULL \
           ORDER BY a.admitted_at DESC LIMIT 1) adm ON true \
         LEFT JOIN users u ON u.id = pa.ordering_doctor_id \
         WHERE pa.id = $1 AND pa.tenant_id = $2 AND pa.deleted_at IS NULL",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    let preauth_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        request_id,
    )
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(InsurancePreauthPrintData {
        request_number: row.pa_number,
        request_date: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        policy_number: row.policy_number,
        insurance_company: row.insurance_company,
        tpa_name: row.tpa_name,
        // ponytail: employee_id / corporate_name not recorded anywhere yet
        employee_id: None,
        corporate_name: None,
        admission_date: row
            .requested_start
            .map(|d| d.format("%d-%b-%Y").to_string()),
        expected_los: row.expected_los,
        diagnosis: row.diagnosis,
        icd_codes: row.diagnosis_codes.unwrap_or_default(),
        planned_procedures: row.planned_procedure.into_iter().collect(),
        estimated_cost: row.estimated_cost,
        treating_doctor: row.treating_doctor,
        contact_number: row.contact_number,
        hospital_name: h_name,
        signatures: medbrains_signing::signed_documents::to_print_signatures(preauth_sigs),
    }))
}

// ── Cashless Claim ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CashlessClaimRow {
    claim_number: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    policy_number: Option<String>,
    insurance_company: String,
    tpa_name: Option<String>,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    diagnosis: Option<String>,
    total_bill_amount: String,
    approved_amount: Option<String>,
    deductions: String,
    patient_payable: String,
    status: String,
    treating_doctor: Option<String>,
}

pub async fn get_cashless_claim_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
) -> Result<Json<CashlessClaimPrintData>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INSURANCE_CLAIM,
        claim_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The claim create path writes neither `admission_id` nor `insurance_id`:
    // the stay comes from the claimed invoice, the payer from the claim itself.
    let row = sqlx::query_as::<_, CashlessClaimRow>(
        "SELECT \
           cl.claim_number, \
           cl.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           cl.policy_number, \
           cl.insurance_provider AS insurance_company, \
           cl.tpa_name, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           COALESCE(adm.final_diagnosis, adm.primary_diagnosis, adm.provisional_diagnosis) \
             AS diagnosis, \
           inv.total_amount::text AS total_bill_amount, \
           cl.approved_amount::text AS approved_amount, \
           cl.deductions::text AS deductions, \
           cl.patient_payable::text AS patient_payable, \
           cl.status, \
           u.full_name AS treating_doctor \
         FROM insurance_claims cl \
         JOIN patients p ON p.id = cl.patient_id AND p.tenant_id = cl.tenant_id \
         JOIN invoices inv ON inv.id = cl.invoice_id AND inv.tenant_id = cl.tenant_id \
         LEFT JOIN admissions adm ON adm.id = COALESCE(cl.admission_id, inv.admission_id) \
           AND adm.tenant_id = cl.tenant_id AND adm.deleted_at IS NULL \
         LEFT JOIN users u ON u.id = COALESCE(adm.attending_doctor_id, adm.admitting_doctor) \
         WHERE cl.id = $1 AND cl.tenant_id = $2 AND cl.deleted_at IS NULL",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    let claim_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        claim_id,
    )
    .await?;

    tx.commit().await?;

    // Claim number / policy / approval stay blank until the payer answers.
    // ponytail: procedures performed are not recorded anywhere yet
    Ok(Json(CashlessClaimPrintData {
        claim_number: row.claim_number,
        claim_date: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        policy_number: row.policy_number,
        insurance_company: row.insurance_company,
        tpa_name: row.tpa_name,
        admission_date: row
            .admission_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        discharge_date: row
            .discharge_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        diagnosis: row.diagnosis,
        procedures_performed: Vec::new(),
        total_bill_amount: row.total_bill_amount,
        approved_amount: row.approved_amount,
        deductions: row.deductions,
        patient_payable: row.patient_payable,
        claim_status: row.status,
        treating_doctor: row.treating_doctor,
        hospital_name: h_name,
        signatures: medbrains_signing::signed_documents::to_print_signatures(claim_sigs),
    }))
}

// ── Package Estimate ────────────────────────────────────
//
// Printed from the package master: a quote of what the package costs and
// covers. No per-patient estimate record exists, so the path id is the
// `billing_packages.id` and the document names no patient.

#[derive(Debug, sqlx::FromRow)]
struct PackageEstimateRow {
    valid_to: Option<chrono::DateTime<chrono::Utc>>,
    package_name: String,
    package_code: String,
    package_price: String,
}

pub async fn get_package_estimate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(package_id): Path<Uuid>,
) -> Result<Json<PackageEstimatePrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    // Master data, no patient on it: the permission checks above are the
    // whole of its authorization.

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PackageEstimateRow>(
        "SELECT \
           bp.valid_to, \
           bp.name AS package_name, \
           bp.code AS package_code, \
           bp.total_price::text AS package_price \
         FROM billing_packages bp \
         WHERE bp.id = $1 AND bp.tenant_id = $2 AND bp.deleted_at IS NULL",
    )
    .bind(package_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let inclusions: Vec<String> = sqlx::query_scalar(
        "SELECT CASE WHEN quantity > 1 THEN description || ' × ' || quantity \
                     ELSE description END \
         FROM billing_package_items \
         WHERE package_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(package_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    Ok(Json(PackageEstimatePrintData {
        // ponytail: estimate_number / procedure_name not recorded anywhere yet
        estimate_number: None,
        estimate_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        valid_until: row
            .valid_to
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        patient_name: None,
        package_name: row.package_name,
        package_code: row.package_code,
        procedure_name: None,
        inclusions,
        // ponytail: package exclusions / terms not recorded anywhere yet
        exclusions: Vec::new(),
        package_price: row.package_price,
        additional_charges_note: None,
        terms_conditions: Vec::new(),
        hospital_name: h_name,
    }))
}

// ── Helper: Number to Words ─────────────────────────────

fn number_to_words(amount: f64) -> String {
    let rupees = amount.trunc() as u64;
    let paise = ((amount.fract() * 100.0).round()) as u64;

    let ones = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];
    let tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    fn convert_below_hundred(n: u64, ones: &[&str], tens: &[&str]) -> String {
        if n < 20 {
            ones[n as usize].to_string()
        } else {
            let t = tens[(n / 10) as usize];
            let o = ones[(n % 10) as usize];
            if o.is_empty() {
                t.to_string()
            } else {
                format!("{t} {o}")
            }
        }
    }

    fn convert_indian(n: u64, ones: &[&str], tens: &[&str]) -> String {
        if n == 0 {
            return "Zero".to_string();
        }

        let crore = n / 10_000_000;
        let lakh = (n % 10_000_000) / 100_000;
        let thousand = (n % 100_000) / 1_000;
        let hundred = (n % 1_000) / 100;
        let remainder = n % 100;

        let mut parts = Vec::new();

        if crore > 0 {
            parts.push(format!(
                "{} Crore",
                convert_below_hundred(crore, ones, tens)
            ));
        }
        if lakh > 0 {
            parts.push(format!("{} Lakh", convert_below_hundred(lakh, ones, tens)));
        }
        if thousand > 0 {
            parts.push(format!(
                "{} Thousand",
                convert_below_hundred(thousand, ones, tens)
            ));
        }
        if hundred > 0 {
            parts.push(format!("{} Hundred", ones[hundred as usize]));
        }
        if remainder > 0 {
            parts.push(convert_below_hundred(remainder, ones, tens));
        }

        parts.join(" ")
    }

    let rupee_words = convert_indian(rupees, &ones, &tens);

    if paise > 0 {
        let paise_words = convert_below_hundred(paise, &ones, &tens);
        format!("Rupees {rupee_words} and {paise_words} Paise Only")
    } else {
        format!("Rupees {rupee_words} Only")
    }
}

// ══════════════════════════════════════════════════════════
// Phase 4: Additional Billing Prints
// ══════════════════════════════════════════════════════════

// ── Credit Note ────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CreditNoteRow {
    credit_note_number: String,
    credit_note_date: chrono::DateTime<chrono::Utc>,
    original_invoice_number: String,
    original_invoice_date: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    patient_address: Option<String>,
    reason_for_credit: String,
    total_credit_amount: f64,
    hospital_name: String,
    hospital_address: Option<String>,
    hospital_logo_url: Option<String>,
    hospital_gstin: Option<String>,
}

pub async fn get_credit_note_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(credit_note_id): Path<Uuid>,
) -> Result<Json<CreditNotePrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::CREDIT_NOTE,
        credit_note_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CreditNoteRow>(
        "SELECT \
           cn.credit_note_number, \
           cn.created_at AS credit_note_date, \
           i.invoice_number AS original_invoice_number, \
           COALESCE(i.invoice_date, i.issued_at, i.created_at) AS original_invoice_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           p.address_line1 AS patient_address, \
           cn.reason AS reason_for_credit, \
           cn.amount::float8 AS total_credit_amount, \
           t.name AS hospital_name, \
           t.address_line1 AS hospital_address, \
           t.logo_url AS hospital_logo_url, \
           (SELECT NULLIF(ts.value #>> '{}', '') FROM tenant_settings ts \
            WHERE ts.tenant_id = cn.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'gst_number' AND ts.deleted_at IS NULL \
            LIMIT 1) AS hospital_gstin \
         FROM credit_notes cn \
         JOIN invoices i ON i.id = cn.invoice_id AND i.tenant_id = cn.tenant_id \
         JOIN patients p ON p.id = i.patient_id AND p.tenant_id = cn.tenant_id \
         JOIN tenants t ON t.id = cn.tenant_id \
         WHERE cn.id = $1 AND cn.tenant_id = $2 AND cn.deleted_at IS NULL",
    )
    .bind(credit_note_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // ponytail: a credit note records only its total — no lines, tax split,
    // remarks, approver or patient GSTIN are recorded anywhere yet; the split
    // amounts print blank.
    Ok(Json(CreditNotePrintData {
        credit_note_number: row.credit_note_number,
        credit_note_date: row
            .credit_note_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        original_invoice_number: row.original_invoice_number,
        original_invoice_date: row
            .original_invoice_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        patient_address: row.patient_address,
        patient_gstin: None,
        reason_for_credit: row.reason_for_credit,
        line_items: Vec::new(),
        subtotal: None,
        discount_amount: None,
        tax_amount: None,
        cgst_amount: None,
        sgst_amount: None,
        igst_amount: None,
        total_credit_amount: row.total_credit_amount,
        amount_in_words: amount_to_words(row.total_credit_amount),
        remarks: None,
        approved_by: None,
        approved_at: None,
        hospital_name: row.hospital_name,
        hospital_address: row.hospital_address,
        hospital_gstin: row.hospital_gstin,
        hospital_logo_url: row.hospital_logo_url,
    }))
}

// ── Package Bill ────────────────────────────────────────────
//
// A patient's package purchase: `patient_package_subscriptions` (written by
// medbrains-patient-packages), its `doctor_packages` master, the inclusions
// with what has been consumed, and — when one was raised — the invoice it was
// bought through. Every amount below is that invoice's; with no invoice there
// is no bill amount to print, so they stay blank (`None`).

#[derive(Debug, sqlx::FromRow)]
struct PackageBillRow {
    bill_number: Option<String>,
    bill_date: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    package_name: String,
    package_code: String,
    package_description: Option<String>,
    package_amount: f64,
    gross_amount: Option<f64>,
    discount_amount: Option<f64>,
    tax_amount: Option<f64>,
    net_amount: Option<f64>,
    advance_paid: Option<f64>,
    total_paid: Option<f64>,
    insurance_amount: Option<f64>,
    balance_due: Option<f64>,
    hospital_name: String,
    hospital_address: Option<String>,
    hospital_logo_url: Option<String>,
    hospital_gstin: Option<String>,
}

pub async fn get_package_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(subscription_id): Path<Uuid>,
) -> Result<Json<PackageBillPrintData>, AppError> {
    require_permission(&claims, permissions::patient_packages::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    // A purchase is a financial record: direct grant on the patient.
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM patient_package_subscriptions \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PackageBillRow>(
        "SELECT \
           inv.invoice_number AS bill_number, \
           s.purchased_at AS bill_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           pkg.name AS package_name, \
           pkg.code AS package_code, \
           pkg.description AS package_description, \
           pkg.total_price::float8 AS package_amount, \
           inv.subtotal::float8 AS gross_amount, \
           inv.discount_amount::float8 AS discount_amount, \
           inv.tax_amount::float8 AS tax_amount, \
           inv.total_amount::float8 AS net_amount, \
           CASE WHEN inv.id IS NOT NULL THEN \
             (SELECT COALESCE(SUM(aa.amount_adjusted), 0) FROM advance_adjustments aa \
              WHERE aa.invoice_id = inv.id AND aa.tenant_id = s.tenant_id \
                AND aa.deleted_at IS NULL) END::float8 AS advance_paid, \
           inv.paid_amount::float8 AS total_paid, \
           CASE WHEN inv.id IS NOT NULL THEN \
             (SELECT COALESCE(SUM(ic.approved_amount), 0) FROM insurance_claims ic \
              WHERE ic.invoice_id = inv.id AND ic.tenant_id = s.tenant_id \
                AND ic.deleted_at IS NULL) END::float8 AS insurance_amount, \
           (inv.total_amount - inv.paid_amount - inv.written_off_amount)::float8 \
             AS balance_due, \
           t.name AS hospital_name, \
           t.address_line1 AS hospital_address, \
           t.logo_url AS hospital_logo_url, \
           (SELECT NULLIF(ts.value #>> '{}', '') FROM tenant_settings ts \
            WHERE ts.tenant_id = s.tenant_id AND ts.category = 'billing' \
              AND ts.key = 'gst_number' AND ts.deleted_at IS NULL LIMIT 1) AS hospital_gstin \
         FROM patient_package_subscriptions s \
         JOIN patients p ON p.id = s.patient_id AND p.tenant_id = s.tenant_id \
         JOIN doctor_packages pkg ON pkg.id = s.package_id AND pkg.tenant_id = s.tenant_id \
         JOIN tenants t ON t.id = s.tenant_id \
         LEFT JOIN invoices inv ON inv.id = s.purchased_via_invoice_id \
           AND inv.tenant_id = s.tenant_id AND inv.deleted_at IS NULL \
         WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Each inclusion with what this subscription has used of it.
    let inclusions: Vec<String> = sqlx::query_scalar(
        "SELECT i.inclusion_type || ' × ' || i.included_quantity \
                || COALESCE(' — ' || i.notes, '') \
                || ' (used ' || COALESCE(( \
                     SELECT SUM(c.consumed_quantity) FROM patient_package_consumptions c \
                     WHERE c.subscription_id = $1 AND c.tenant_id = i.tenant_id \
                       AND c.inclusion_type = i.inclusion_type \
                       AND c.deleted_at IS NULL), 0) || ')' \
         FROM doctor_package_inclusions i \
         JOIN patient_package_subscriptions s ON s.package_id = i.package_id \
           AND s.tenant_id = i.tenant_id \
         WHERE s.id = $1 AND s.tenant_id = $2 AND i.deleted_at IS NULL \
         ORDER BY i.sort_order, i.id LIMIT 500",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // ponytail: admission, doctor and department are not recorded against a
    // package purchase anywhere yet
    Ok(Json(PackageBillPrintData {
        bill_number: row.bill_number,
        bill_date: row
            .bill_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: None,
        admission_date: None,
        discharge_date: None,
        package_name: row.package_name,
        package_code: Some(row.package_code),
        package_description: row.package_description,
        package_inclusions: inclusions,
        package_amount: row.package_amount,
        gross_amount: row.gross_amount,
        discount_amount: row.discount_amount,
        tax_amount: row.tax_amount,
        net_amount: row.net_amount,
        advance_paid: row.advance_paid,
        total_paid: row.total_paid,
        insurance_amount: row.insurance_amount,
        balance_due: row.balance_due,
        amount_in_words: row.net_amount.map_or_else(String::new, amount_to_words),
        doctor_name: None,
        department: None,
        hospital_name: row.hospital_name,
        hospital_address: row.hospital_address,
        hospital_gstin: row.hospital_gstin,
        hospital_logo_url: row.hospital_logo_url,
    }))
}

// ── Insurance Claim Form ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct InsuranceClaimRow {
    claim_number: Option<String>,
    claim_date: chrono::DateTime<chrono::Utc>,
    claim_type: String,
    tpa_name: Option<String>,
    insurance_company: String,
    policy_number: Option<String>,
    member_id: Option<String>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    relation_to_primary: Option<String>,
    primary_holder_name: Option<String>,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    length_of_stay: Option<i32>,
    diagnosis: Option<String>,
    treating_doctor: Option<String>,
    department_name: Option<String>,
    total_bill_amount: f64,
    pre_auth_amount: Option<f64>,
    claim_amount: Option<f64>,
    patient_payable: Option<f64>,
    pre_auth_number: Option<String>,
    pre_auth_date: Option<chrono::DateTime<chrono::Utc>>,
    submitted_at: Option<chrono::DateTime<chrono::Utc>>,
    hospital_name: String,
    hospital_address: Option<String>,
    hospital_logo_url: Option<String>,
}

pub async fn get_insurance_claim_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
) -> Result<Json<InsuranceClaimPrintData>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INSURANCE_CLAIM,
        claim_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The claim create path writes neither `admission_id` nor `insurance_id`,
    // so the stay comes from the claimed invoice and the policy holder from the
    // patient's policy row with the claimed policy number.
    let row = sqlx::query_as::<_, InsuranceClaimRow>(
        "SELECT \
           ic.claim_number, \
           ic.created_at AS claim_date, \
           ic.claim_type, \
           ic.tpa_name, \
           ic.insurance_provider AS insurance_company, \
           ic.policy_number, \
           ic.member_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           pol.policy_holder_relation AS relation_to_primary, \
           pol.policy_holder_name AS primary_holder_name, \
           a.admitted_at AS admission_date, \
           a.discharged_at AS discharge_date, \
           EXTRACT(DAY FROM (a.discharged_at - a.admitted_at))::int AS length_of_stay, \
           COALESCE(a.final_diagnosis, a.primary_diagnosis, a.provisional_diagnosis) AS diagnosis, \
           doc.full_name AS treating_doctor, \
           d.name AS department_name, \
           inv.total_amount::float8 AS total_bill_amount, \
           ic.pre_auth_amount::float8 AS pre_auth_amount, \
           ic.claim_amount::float8 AS claim_amount, \
           ic.patient_payable::float8 AS patient_payable, \
           pa.auth_number AS pre_auth_number, \
           pa.responded_at AS pre_auth_date, \
           ic.submitted_at, \
           t.name AS hospital_name, \
           t.address_line1 AS hospital_address, \
           t.logo_url AS hospital_logo_url \
         FROM insurance_claims ic \
         JOIN patients p ON p.id = ic.patient_id AND p.tenant_id = ic.tenant_id \
         JOIN invoices inv ON inv.id = ic.invoice_id AND inv.tenant_id = ic.tenant_id \
         JOIN tenants t ON t.id = ic.tenant_id \
         LEFT JOIN LATERAL ( \
           SELECT pi.policy_holder_relation, pi.policy_holder_name \
           FROM patient_insurance pi \
           WHERE pi.tenant_id = ic.tenant_id AND pi.deleted_at IS NULL \
             AND (pi.id = ic.insurance_id \
                  OR (pi.patient_id = ic.patient_id AND pi.policy_number = ic.policy_number)) \
           ORDER BY (pi.id = ic.insurance_id) DESC NULLS LAST LIMIT 1) pol ON true \
         LEFT JOIN LATERAL ( \
           SELECT r.auth_number, r.responded_at FROM prior_auth_requests r \
           WHERE r.tenant_id = ic.tenant_id AND r.deleted_at IS NULL \
             AND r.auth_number IS NOT NULL \
             AND (r.insurance_claim_id = ic.id OR r.invoice_id = ic.invoice_id) \
           ORDER BY r.responded_at DESC NULLS LAST LIMIT 1) pa ON true \
         LEFT JOIN admissions a ON a.id = COALESCE(ic.admission_id, inv.admission_id) \
           AND a.tenant_id = ic.tenant_id AND a.deleted_at IS NULL \
         LEFT JOIN users doc ON doc.id = COALESCE(a.attending_doctor_id, a.admitting_doctor) \
         LEFT JOIN departments d ON d.id = a.department_id AND d.tenant_id = ic.tenant_id \
         WHERE ic.id = $1 AND ic.tenant_id = $2 AND ic.deleted_at IS NULL",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Charge heads from the claimed invoice's live lines.
    let heads: Vec<(String, f64)> = sqlx::query_as(&format!(
        "SELECT {CHARGE_HEAD_SQL} AS head, SUM(it.total_price)::float8 AS amount \
         FROM invoice_items it \
         JOIN insurance_claims ic ON ic.invoice_id = it.invoice_id AND ic.tenant_id = it.tenant_id \
         {CHARGE_CATEGORY_JOIN} \
         WHERE ic.id = $1 AND ic.tenant_id = $2 AND it.deleted_at IS NULL \
         GROUP BY 1 LIMIT 20"
    ))
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let claim_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        claim_id,
    )
    .await?;

    tx.commit().await?;

    let head = |name: &str| {
        heads
            .iter()
            .find(|(h, _)| h == name)
            .map_or(0.0, |(_, amount)| *amount)
    };
    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));

    Ok(Json(InsuranceClaimPrintData {
        // Blank until the payer assigns one.
        claim_number: row.claim_number,
        claim_date: row
            .claim_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        claim_type: row.claim_type,
        tpa_name: row.tpa_name,
        insurance_company: Some(row.insurance_company),
        policy_number: row.policy_number,
        member_id: row.member_id,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        relation_to_primary: row.relation_to_primary,
        primary_holder_name: row.primary_holder_name,
        // ponytail: primary holder id, claim ICD/procedure codes, attachment and
        // declaration flags, empanelment number not recorded anywhere yet
        primary_holder_id: None,
        admission_date: row
            .admission_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        discharge_date: row
            .discharge_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        length_of_stay: row.length_of_stay,
        diagnosis: row.diagnosis,
        icd_codes: Vec::new(),
        procedure_performed: None,
        procedure_codes: Vec::new(),
        treating_doctor: row.treating_doctor.unwrap_or_default(),
        department: row.department_name,
        room_charges: head("room"),
        nursing_charges: head("nursing"),
        investigation_charges: head("investigation"),
        medicine_charges: head("medicine"),
        consultation_charges: head("consultation"),
        procedure_charges: head("procedure"),
        other_charges: head("other") + head("consumable"),
        total_bill_amount: row.total_bill_amount,
        pre_auth_amount: row.pre_auth_amount,
        claim_amount: row.claim_amount,
        patient_payable: row.patient_payable,
        pre_auth_number: row.pre_auth_number,
        pre_auth_date: row
            .pre_auth_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        discharge_summary_attached: None,
        investigation_reports_attached: None,
        bill_attached: None,
        declaration_date: row
            .submitted_at
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        patient_signature_obtained: None,
        hospital_stamp: None,
        hospital_name: row.hospital_name,
        hospital_address: row.hospital_address,
        hospital_empanelment_number: None,
        hospital_logo_url: row.hospital_logo_url,
        signatures: medbrains_signing::signed_documents::to_print_signatures(claim_sigs),
    }))
}

/// Alias for `number_to_words`
fn amount_to_words(amount: f64) -> String {
    number_to_words(amount)
}

/// Billing print-data (GST invoice, receipt, consolidated bill, no-dues, cashless) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/receipt/{payment_id}",
            get(get_receipt_print_data),
        )
        .route(
            "/api/print-data/estimate/{invoice_id}",
            get(get_estimate_print_data),
        )
        .route(
            "/api/print-data/credit-note/{id}",
            get(get_credit_note_print_data),
        )
        .route(
            "/api/print-data/gst-invoice/{invoice_id}",
            get(crate::gst_invoice::get_gst_invoice_print_data),
        )
        .route(
            "/api/print-data/opd-bill/{invoice_id}",
            get(get_opd_bill_print_data),
        )
        .route(
            "/api/print-data/ipd-interim-bill/{admission_id}",
            get(get_ipd_interim_bill_print_data),
        )
        .route(
            "/api/print-data/ipd-final-bill/{invoice_id}",
            get(get_ipd_final_bill_print_data),
        )
        .route(
            "/api/print-data/admission-consolidated-bill/{admission_id}",
            get(get_admission_consolidated_bill_print_data),
        )
        .route(
            "/api/print-data/advance-receipt/{advance_id}",
            get(get_advance_receipt_print_data),
        )
        .route(
            "/api/print-data/refund-receipt/{refund_id}",
            get(get_refund_receipt_print_data),
        )
        .route(
            "/api/print-data/insurance-preauth/{request_id}",
            get(get_insurance_preauth_print_data),
        )
        .route(
            "/api/print-data/cashless-claim/{claim_id}",
            get(get_cashless_claim_print_data),
        )
        .route(
            "/api/print-data/package-estimate/{package_id}",
            get(get_package_estimate_print_data),
        )
        .route(
            "/api/print-data/package-bill/{subscription_id}",
            get(get_package_bill_print_data),
        )
        .route(
            "/api/print-data/insurance-claim/{claim_id}",
            get(get_insurance_claim_print_data),
        )
}
