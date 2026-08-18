//! Print-data endpoints — billing & financial documents.
//!
//! Each handler assembles the context data that a Handlebars template needs to
//! render a printable document. No HTML is produced here; the frontend template
//! engine does the rendering.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use axum::routing::get;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AdvanceReceiptPrintData, BillCategoryTotal, BillLineItem, CashlessClaimPrintData,
    CreditNoteItem, CreditNotePrintData, EstimateItemLine, EstimatePrintData, GstInvoiceItemLine,
    GstInvoicePrintData, InsuranceClaimPrintData, InsurancePreauthPrintData, IpdFinalBillPrintData,
    IpdInterimBillPrintData, NoDuesCertificatePrintData, OpdBillPrintData, PackageAdditionalCharge,
    PackageBillPrintData, PackageEstimatePrintData, PackageExclusion, ReceiptPrintData,
    RefundReceiptPrintData,
    TdsCertificatePrintData, TdsEntry,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── Helper: fetch hospital name from tenants table ───────

async fn hospital_name(
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

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
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::PAYMENT,
        payment_id,
    )
    .await?;
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

    let today = chrono::Utc::now().format("%Y%m%d").to_string();
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
        paid_at: row.paid_at.format("%d-%b-%Y %H:%M").to_string(),
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
         WHERE inv.id = $1 AND inv.tenant_id = $2",
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
         WHERE invoice_id = $1 AND tenant_id = $2 \
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

#[derive(Debug, sqlx::FromRow)]
struct GstInvoiceHeaderRow {
    invoice_number: String,
    patient_name: String,
    uhid: String,
    subtotal: String,
    tax_amount: String,
    total_amount: String,
    hospital_gstin: Option<String>,
    hospital_address: Option<String>,
    issued_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
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

    let header = sqlx::query_as::<_, GstInvoiceHeaderRow>(
        "SELECT \
           inv.invoice_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           inv.subtotal::text AS subtotal, \
           inv.tax_amount::text AS tax_amount, \
           inv.total_amount::text AS total_amount, \
           (SELECT ts.value->>'gstin' FROM tenant_settings ts \
            WHERE ts.tenant_id = inv.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'hospital_gst' \
            LIMIT 1) AS hospital_gstin, \
           (SELECT ts.value->>'address' FROM tenant_settings ts \
            WHERE ts.tenant_id = inv.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'hospital_gst' \
            LIMIT 1) AS hospital_address, \
           inv.issued_at, \
           inv.created_at \
         FROM invoices inv \
         JOIN patients p ON p.id = inv.patient_id \
                         AND p.tenant_id = inv.tenant_id \
         WHERE inv.id = $1 AND inv.tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, GstInvoiceItemLine>(
        "SELECT description, \
                hsn_sac_code AS hsn_code, \
                quantity, \
                unit_price::text AS unit_price, \
                tax_percent::text AS tax_percent, \
                total_price::text AS total_price \
         FROM invoice_items \
         WHERE invoice_id = $1 AND tenant_id = $2 \
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
        .format("%d-%b-%Y")
        .to_string();

    Ok(Json(GstInvoicePrintData {
        invoice_number: header.invoice_number,
        patient_name: header.patient_name,
        uhid: header.uhid,
        subtotal: header.subtotal,
        tax_amount: header.tax_amount,
        total_amount: header.total_amount,
        hospital_gstin: header.hospital_gstin,
        hospital_name: h_name,
        hospital_address: header.hospital_address,
        items,
        date,
    }))
}

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
           (SELECT ts.value->>'gstin' FROM tenant_settings ts \
            WHERE ts.tenant_id = inv.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'hospital_gst' \
            LIMIT 1) AS hospital_gstin \
         FROM invoices inv \
         JOIN patients p ON p.id = inv.patient_id AND p.tenant_id = inv.tenant_id \
         LEFT JOIN users u ON u.id = inv.doctor_id \
         LEFT JOIN departments d ON d.id = inv.department_id AND d.tenant_id = inv.tenant_id \
         WHERE inv.id = $1 AND inv.tenant_id = $2",
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
         WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get payments summary
    let payments: (String, String) = sqlx::query_as(
        "SELECT \
           COALESCE(SUM(amount), 0)::text, \
           COALESCE(MAX(mode::text), 'cash') \
         FROM payments \
         WHERE invoice_id = $1 AND tenant_id = $2 AND status = 'completed'",
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
        .format("%d-%b-%Y")
        .to_string();

    let age_str = header.age.map(|a| format!("{} Y", a as i32));

    // Calculate balance
    let total: f64 = header.total_amount.parse().unwrap_or(0.0);
    let paid: f64 = payments.0.parse().unwrap_or(0.0);
    let balance = total - paid;

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
        balance_due: format!("{balance:.2}"),
        payment_mode: Some(payments.1),
        hospital_name: h_name,
        hospital_gstin: header.hospital_gstin,
    }))
}

// ── IPD Interim Bill ────────────────────────────────────

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

pub async fn get_ipd_interim_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<IpdInterimBillPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id)
        .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, IpdInterimBillRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           b.bed_number, \
           w.name AS ward_name, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           adm.primary_diagnosis AS diagnosis \
         FROM admissions adm \
         JOIN patients p ON p.id = adm.patient_id AND p.tenant_id = adm.tenant_id \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
         LEFT JOIN users u ON u.id = adm.attending_doctor_id \
         LEFT JOIN departments d ON d.id = adm.department_id AND d.tenant_id = adm.tenant_id \
         WHERE adm.id = $1 AND adm.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get charge breakups by category
    let charges: Vec<(String, String)> = sqlx::query_as(
        "SELECT category, SUM(amount)::text AS amount \
         FROM ipd_charges \
         WHERE admission_id = $1 AND tenant_id = $2 \
         GROUP BY category",
    )
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

    for (cat, amt) in &charges {
        match cat.as_str() {
            "room" | "bed" => room_charges = amt.clone(),
            "investigation" | "lab" | "radiology" => investigation_charges = amt.clone(),
            "procedure" | "surgery" => procedure_charges = amt.clone(),
            "pharmacy" | "medicine" => pharmacy_charges = amt.clone(),
            "consumable" | "supplies" => consumable_charges = amt.clone(),
            "professional" | "doctor_fee" => professional_fees = amt.clone(),
            _ => other_charges = amt.clone(),
        }
    }

    // Get line items
    let items = sqlx::query_as::<_, BillLineItem>(
        "SELECT \
           description, \
           service_code, \
           hsn_sac_code AS hsn_sac, \
           quantity, \
           rate::text AS unit_price, \
           COALESCE(discount, 0)::text AS discount, \
           COALESCE(tax_percent, 0)::text AS tax_percent, \
           amount::text AS total \
         FROM ipd_charges \
         WHERE admission_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Calculate totals
    let totals: (String, String, String, String) = sqlx::query_as(
        "SELECT \
           SUM(amount)::text AS subtotal, \
           COALESCE(SUM(discount), 0)::text AS discount, \
           COALESCE(SUM(tax_amount), 0)::text AS tax, \
           SUM(amount + COALESCE(tax_amount, 0) - COALESCE(discount, 0))::text AS total \
         FROM ipd_charges \
         WHERE admission_id = $1 AND tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get advance payments
    let advance: String = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0)::text \
         FROM payments \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND payment_type = 'advance' AND status = 'completed'",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Calculate LOS
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
    let total: f64 = totals.3.parse().unwrap_or(0.0);
    let adv: f64 = advance.parse().unwrap_or(0.0);
    let balance = total - adv;

    Ok(Json(IpdInterimBillPrintData {
        bill_number: format!(
            "INT-{}",
            admission_id.to_string().split('-').next().unwrap_or("")
        ),
        bill_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
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
        subtotal: totals.0,
        discount_amount: totals.1,
        tax_amount: totals.2,
        total_amount: totals.3,
        advance_paid: advance,
        balance_due: format!("{balance:.2}"),
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
           b.bed_number, \
           w.name AS ward_name, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           adm.primary_diagnosis AS diagnosis, \
           adm.discharge_type, \
           inv.subtotal::text AS subtotal, \
           inv.discount_amount::text AS discount_amount, \
           inv.tax_amount::text AS tax_amount, \
           inv.total_amount::text AS total_amount, \
           (SELECT ts.value->>'gstin' FROM tenant_settings ts \
            WHERE ts.tenant_id = inv.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'hospital_gst' \
            LIMIT 1) AS hospital_gstin \
         FROM invoices inv \
         JOIN patients p ON p.id = inv.patient_id AND p.tenant_id = inv.tenant_id \
         LEFT JOIN admissions adm ON adm.id = inv.admission_id AND adm.tenant_id = inv.tenant_id \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
         LEFT JOIN users u ON u.id = COALESCE(adm.attending_doctor_id, inv.doctor_id) \
         LEFT JOIN departments d ON d.id = COALESCE(adm.department_id, inv.department_id) \
           AND d.tenant_id = inv.tenant_id \
         WHERE inv.id = $1 AND inv.tenant_id = $2",
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
         WHERE invoice_id = $1 AND tenant_id = $2 \
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
         WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY category, created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get payments summary
    let payments: (String, String, String) = sqlx::query_as(
        "SELECT \
           COALESCE(SUM(CASE WHEN payment_type = 'advance' THEN amount ELSE 0 END), 0)::text, \
           COALESCE(SUM(CASE WHEN payment_type = 'insurance' THEN amount ELSE 0 END), 0)::text, \
           COALESCE(SUM(amount), 0)::text \
         FROM payments \
         WHERE invoice_id = $1 AND tenant_id = $2 AND status = 'completed'",
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
        .format("%d-%b-%Y")
        .to_string();
    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    let total: f64 = row.total_amount.parse().unwrap_or(0.0);
    let _advance: f64 = payments.0.parse().unwrap_or(0.0);
    let insurance: f64 = payments.1.parse().unwrap_or(0.0);
    let paid: f64 = payments.2.parse().unwrap_or(0.0);
    let patient_payable = total - insurance;
    let balance = total - paid;

    Ok(Json(IpdFinalBillPrintData {
        invoice_number: row.invoice_number,
        invoice_date: date,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row
            .admission_date
            .map(|d| d.format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
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
        patient_payable: format!("{patient_payable:.2}"),
        amount_paid: payments.2,
        balance_due: format!("{balance:.2}"),
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
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id)
        .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let header = sqlx::query_as::<_, ConsolidatedBillHeaderRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           b.bed_number, \
           w.name AS ward_name, \
           u.full_name AS doctor_name, \
           d.name AS department, \
           adm.primary_diagnosis AS diagnosis, \
           adm.discharge_type, \
           (SELECT ts.value->>'gstin' FROM tenant_settings ts \
            WHERE ts.tenant_id = adm.tenant_id \
              AND ts.category = 'billing' AND ts.key = 'hospital_gst' \
            LIMIT 1) AS hospital_gstin \
         FROM admissions adm \
         JOIN patients p ON p.id = adm.patient_id AND p.tenant_id = adm.tenant_id \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
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
         WHERE admission_id = $1 AND tenant_id = $2 \
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
           AND inv.status NOT IN ('cancelled'::invoice_status, 'refunded'::invoice_status) \
         ORDER BY it.category, it.created_at LIMIT 5000",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let payments: (String, String, String) = sqlx::query_as(
        "SELECT \
           COALESCE(SUM(CASE WHEN pay.payment_type = 'advance' THEN pay.amount ELSE 0 END), 0)::text, \
           COALESCE(SUM(CASE WHEN pay.payment_type = 'insurance' THEN pay.amount ELSE 0 END), 0)::text, \
           COALESCE(SUM(pay.amount), 0)::text \
         FROM payments pay \
         JOIN invoices inv ON inv.id = pay.invoice_id \
         WHERE inv.admission_id = $1 AND inv.tenant_id = $2 AND pay.status = 'completed'",
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
        .format("%d-%b-%Y")
        .to_string();
    let age_str = header.age.map(|a| format!("{} Y", a as i32));
    let admission_ref = format!("IP/{}", &admission_id.to_string()[..8].to_uppercase());

    let total: f64 = totals.3.parse().unwrap_or(0.0);
    let insurance: f64 = payments.1.parse().unwrap_or(0.0);
    let paid: f64 = payments.2.parse().unwrap_or(0.0);
    let patient_payable = total - insurance;
    let balance = total - paid;

    Ok(Json(IpdFinalBillPrintData {
        invoice_number: admission_ref,
        invoice_date: date,
        patient_name: header.patient_name,
        uhid: header.uhid,
        age: age_str,
        gender: header.gender,
        admission_date: header
            .admission_date
            .map(|d| d.format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        discharge_date: header.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
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
        patient_payable: format!("{patient_payable:.2}"),
        amount_paid: payments.2,
        balance_due: format!("{balance:.2}"),
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
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id)
        .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, NoDuesRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           w.name AS ward_name, \
           b.bed_number, \
           c.total_billed::text AS total_billed, \
           c.total_paid::text AS total_paid, \
           c.balance::text AS balance, \
           u.full_name AS issued_by, \
           c.created_at AS issued_at, \
           c.notes \
         FROM ipd_no_dues_certificates c \
         JOIN admissions adm ON adm.id = c.admission_id AND adm.tenant_id = c.tenant_id \
         JOIN patients p ON p.id = adm.patient_id AND p.tenant_id = adm.tenant_id \
         LEFT JOIN beds b ON b.id = adm.bed_id AND b.tenant_id = adm.tenant_id \
         LEFT JOIN wards w ON w.id = b.ward_id AND w.tenant_id = b.tenant_id \
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
            .map(|d| d.format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        total_billed: row.total_billed,
        total_paid: row.total_paid,
        balance: row.balance,
        issued_by: row.issued_by,
        issued_at: row.issued_at.format("%d-%b-%Y %H:%M").to_string(),
        notes: row.notes,
        hospital_name: h_name,
    }))
}

// ── Advance Receipt ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AdvanceReceiptRow {
    reference_number: Option<String>,
    patient_name: String,
    uhid: String,
    admission_id: Option<Uuid>,
    amount: String,
    mode: String,
    notes: Option<String>,
    received_by: Option<String>,
    paid_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_advance_receipt_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(payment_id): Path<Uuid>,
) -> Result<Json<AdvanceReceiptPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
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

    let row = sqlx::query_as::<_, AdvanceReceiptRow>(
        "SELECT \
           pay.reference_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           pay.admission_id, \
           pay.amount::text AS amount, \
           pay.mode::text AS mode, \
           pay.notes, \
           u.full_name AS received_by, \
           pay.paid_at \
         FROM payments pay \
         JOIN patients p ON p.id = pay.patient_id AND p.tenant_id = pay.tenant_id \
         LEFT JOIN users u ON u.id = pay.received_by \
         WHERE pay.id = $1 AND pay.tenant_id = $2 \
           AND pay.payment_type = 'advance'",
    )
    .bind(payment_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    let amount_val: f64 = row.amount.parse().unwrap_or(0.0);
    let amount_in_words = number_to_words(amount_val);

    Ok(Json(AdvanceReceiptPrintData {
        receipt_number: row
            .reference_number
            .clone()
            .unwrap_or_else(|| payment_id.to_string()),
        receipt_date: row.paid_at.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_id: row.admission_id.map(|id| id.to_string()),
        amount: row.amount,
        amount_in_words,
        payment_mode: row.mode,
        reference_number: row.reference_number,
        purpose: row.notes.unwrap_or_else(|| "Advance Deposit".to_string()),
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
        receipt_date: row.created_at.format("%d-%b-%Y").to_string(),
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
    request_number: String,
    created_at: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    policy_number: String,
    insurance_company: String,
    tpa_name: Option<String>,
    employee_id: Option<String>,
    corporate_name: Option<String>,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    expected_los: Option<i32>,
    diagnosis: Option<String>,
    estimated_cost: String,
    treating_doctor: Option<String>,
    contact_number: String,
}

pub async fn get_insurance_preauth_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<InsurancePreauthPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    // Not guarded: `preauth_requests` does not exist in the schema.

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PreauthRow>(
        "SELECT \
           pa.request_number, \
           pa.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           ins.policy_number, \
           ic.name AS insurance_company, \
           tpa.name AS tpa_name, \
           ins.employee_id, \
           ins.corporate_name, \
           pa.admission_date, \
           pa.expected_los, \
           pa.diagnosis, \
           pa.estimated_cost::text AS estimated_cost, \
           u.full_name AS treating_doctor, \
           COALESCE(p.phone, p.emergency_contact_phone) AS contact_number \
         FROM preauth_requests pa \
         JOIN patients p ON p.id = pa.patient_id AND p.tenant_id = pa.tenant_id \
         JOIN patient_insurance ins ON ins.id = pa.insurance_id AND ins.tenant_id = pa.tenant_id \
         JOIN insurance_companies ic ON ic.id = ins.company_id AND ic.tenant_id = ins.tenant_id \
         LEFT JOIN tpa_companies tpa ON tpa.id::text = ins.tpa_id AND tpa.tenant_id = ins.tenant_id \
         LEFT JOIN users u ON u.id = pa.treating_doctor_id \
         WHERE pa.id = $1 AND pa.tenant_id = $2",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get ICD codes
    let icd_codes: Vec<String> = sqlx::query_scalar(
        "SELECT icd_code FROM preauth_diagnoses \
         WHERE preauth_id = $1 AND tenant_id = $2",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get planned procedures
    let procedures: Vec<String> = sqlx::query_scalar(
        "SELECT procedure_name FROM preauth_procedures \
         WHERE preauth_id = $1 AND tenant_id = $2",
    )
    .bind(request_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
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
        request_number: row.request_number,
        request_date: row.created_at.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        policy_number: row.policy_number,
        insurance_company: row.insurance_company,
        tpa_name: row.tpa_name,
        employee_id: row.employee_id,
        corporate_name: row.corporate_name,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        expected_los: row.expected_los,
        diagnosis: row.diagnosis,
        icd_codes,
        planned_procedures: procedures,
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
    claim_number: String,
    created_at: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    policy_number: String,
    insurance_company: String,
    tpa_name: Option<String>,
    admission_date: chrono::DateTime<chrono::Utc>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    diagnosis: Option<String>,
    total_bill_amount: String,
    approved_amount: String,
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
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
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

    let row = sqlx::query_as::<_, CashlessClaimRow>(
        "SELECT \
           cl.claim_number, \
           cl.created_at, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           ins.policy_number, \
           ic.name AS insurance_company, \
           tpa.name AS tpa_name, \
           adm.admitted_at AS admission_date, \
           adm.discharged_at AS discharge_date, \
           adm.primary_diagnosis AS diagnosis, \
           cl.total_bill_amount::text AS total_bill_amount, \
           cl.approved_amount::text AS approved_amount, \
           cl.deductions::text AS deductions, \
           cl.patient_payable::text AS patient_payable, \
           cl.status, \
           u.full_name AS treating_doctor \
         FROM insurance_claims cl \
         JOIN patients p ON p.id = cl.patient_id AND p.tenant_id = cl.tenant_id \
         JOIN admissions adm ON adm.id = cl.admission_id AND adm.tenant_id = cl.tenant_id \
         JOIN patient_insurance ins ON ins.id = cl.insurance_id AND ins.tenant_id = cl.tenant_id \
         JOIN insurance_companies ic ON ic.id = ins.company_id AND ic.tenant_id = ins.tenant_id \
         LEFT JOIN tpa_companies tpa ON tpa.id::text = ins.tpa_id AND tpa.tenant_id = ins.tenant_id \
         LEFT JOIN users u ON u.id = adm.attending_doctor_id \
         WHERE cl.id = $1 AND cl.tenant_id = $2",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get procedures performed
    let procedures: Vec<String> = sqlx::query_scalar(
        "SELECT procedure_name FROM claim_procedures \
         WHERE claim_id = $1 AND tenant_id = $2",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
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

    Ok(Json(CashlessClaimPrintData {
        claim_number: row.claim_number,
        claim_date: row.created_at.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        policy_number: row.policy_number,
        insurance_company: row.insurance_company,
        tpa_name: row.tpa_name,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
        diagnosis: row.diagnosis,
        procedures_performed: procedures,
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

#[derive(Debug, sqlx::FromRow)]
struct PackageEstimateRow {
    estimate_number: String,
    created_at: chrono::DateTime<chrono::Utc>,
    valid_until: chrono::DateTime<chrono::Utc>,
    patient_name: Option<String>,
    package_name: String,
    package_code: String,
    procedure_name: String,
    package_price: String,
    additional_charges_note: Option<String>,
}

pub async fn get_package_estimate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(estimate_id): Path<Uuid>,
) -> Result<Json<PackageEstimatePrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    // Not guarded: `package_estimates` does not exist in the schema.

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PackageEstimateRow>(
        "SELECT \
           pe.estimate_number, \
           pe.created_at, \
           pe.valid_until, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           pkg.name AS package_name, \
           pkg.code AS package_code, \
           pkg.procedure_name, \
           pkg.price::text AS package_price, \
           pkg.additional_charges_note \
         FROM package_estimates pe \
         JOIN packages pkg ON pkg.id = pe.package_id AND pkg.tenant_id = pe.tenant_id \
         LEFT JOIN patients p ON p.id = pe.patient_id AND p.tenant_id = pe.tenant_id \
         WHERE pe.id = $1 AND pe.tenant_id = $2",
    )
    .bind(estimate_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get inclusions
    let inclusions: Vec<String> = sqlx::query_scalar(
        "SELECT item_description FROM package_inclusions \
         WHERE package_id = (SELECT package_id FROM package_estimates WHERE id = $1) \
           AND tenant_id = $2 \
         ORDER BY sort_order LIMIT 5000",
    )
    .bind(estimate_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get exclusions
    let exclusions: Vec<String> = sqlx::query_scalar(
        "SELECT item_description FROM package_exclusions \
         WHERE package_id = (SELECT package_id FROM package_estimates WHERE id = $1) \
           AND tenant_id = $2 \
         ORDER BY sort_order LIMIT 5000",
    )
    .bind(estimate_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get terms and conditions
    let terms: Vec<String> = sqlx::query_scalar(
        "SELECT term_text FROM package_terms \
         WHERE package_id = (SELECT package_id FROM package_estimates WHERE id = $1) \
           AND tenant_id = $2 \
         ORDER BY sort_order LIMIT 5000",
    )
    .bind(estimate_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;

    tx.commit().await?;

    Ok(Json(PackageEstimatePrintData {
        estimate_number: row.estimate_number,
        estimate_date: row.created_at.format("%d-%b-%Y").to_string(),
        valid_until: row.valid_until.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        package_name: row.package_name,
        package_code: row.package_code,
        procedure_name: row.procedure_name,
        inclusions,
        exclusions,
        package_price: row.package_price,
        additional_charges_note: row.additional_charges_note,
        terms_conditions: terms,
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
    patient_gstin: Option<String>,
    reason_for_credit: String,
    subtotal: f64,
    discount_amount: f64,
    tax_amount: f64,
    cgst_amount: f64,
    sgst_amount: f64,
    igst_amount: f64,
    total_credit_amount: f64,
    remarks: Option<String>,
    approved_by: Option<String>,
    approved_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
struct CreditNoteItemRow {
    description: String,
    hsn_code: Option<String>,
    quantity: f64,
    unit_price: f64,
    amount: f64,
    tax_rate: f64,
    tax_amount: f64,
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

    let row = sqlx::query_as::<_, CreditNoteRow>(
        "SELECT \
           cn.credit_note_number, \
           cn.created_at AS credit_note_date, \
           i.invoice_number AS original_invoice_number, \
           i.invoice_date AS original_invoice_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           p.address_line1 AS patient_address, \
           p.gstin AS patient_gstin, \
           cn.reason AS reason_for_credit, \
           cn.subtotal, \
           cn.discount_amount, \
           cn.tax_amount, \
           cn.cgst_amount, \
           cn.sgst_amount, \
           cn.igst_amount, \
           cn.total_amount AS total_credit_amount, \
           cn.remarks, \
           u.full_name AS approved_by, \
           cn.approved_at \
         FROM credit_notes cn \
         JOIN invoices i ON i.id = cn.invoice_id AND i.tenant_id = cn.tenant_id \
         JOIN patients p ON p.id = i.patient_id AND p.tenant_id = cn.tenant_id \
         LEFT JOIN users u ON u.id = cn.approved_by_id \
         WHERE cn.id = $1 AND cn.tenant_id = $2",
    )
    .bind(credit_note_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, CreditNoteItemRow>(
        "SELECT \
           cni.description, \
           cni.hsn_code, \
           cni.quantity, \
           cni.unit_price, \
           cni.amount, \
           cni.tax_rate, \
           cni.tax_amount \
         FROM credit_note_items cni \
         WHERE cni.credit_note_id = $1 AND cni.tenant_id = $2 \
         ORDER BY cni.display_order LIMIT 5000",
    )
    .bind(credit_note_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1, gstin FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CreditNotePrintData {
        credit_note_number: row.credit_note_number,
        credit_note_date: row.credit_note_date.format("%d-%b-%Y").to_string(),
        original_invoice_number: row.original_invoice_number,
        original_invoice_date: row.original_invoice_date.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        patient_address: row.patient_address,
        patient_gstin: row.patient_gstin,
        reason_for_credit: row.reason_for_credit,
        line_items: items
            .into_iter()
            .map(|i| CreditNoteItem {
                description: i.description,
                hsn_code: i.hsn_code,
                quantity: i.quantity,
                unit_price: i.unit_price,
                amount: i.amount,
                tax_rate: i.tax_rate,
                tax_amount: i.tax_amount,
            })
            .collect(),
        subtotal: row.subtotal,
        discount_amount: row.discount_amount,
        tax_amount: row.tax_amount,
        cgst_amount: row.cgst_amount,
        sgst_amount: row.sgst_amount,
        igst_amount: row.igst_amount,
        total_credit_amount: row.total_credit_amount,
        amount_in_words: amount_to_words(row.total_credit_amount),
        remarks: row.remarks,
        approved_by: row.approved_by,
        approved_at: row
            .approved_at
            .map(|d| d.format("%d-%b-%Y %H:%M").to_string()),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_gstin: tenant.3,
        hospital_logo_url: tenant.1,
    }))
}

// ── Package Bill ────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PackageBillRow {
    bill_number: String,
    bill_date: chrono::DateTime<chrono::Utc>,
    patient_name: String,
    uhid: String,
    admission_number: Option<String>,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    package_name: String,
    package_code: Option<String>,
    package_description: Option<String>,
    package_amount: f64,
    additional_total: f64,
    exclusion_total: f64,
    gross_amount: f64,
    discount_amount: f64,
    tax_amount: f64,
    net_amount: f64,
    advance_paid: f64,
    insurance_amount: f64,
    balance_due: f64,
    doctor_name: Option<String>,
    department_name: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct PackageAdditionalRow {
    description: String,
    amount: f64,
    reason: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct PackageExclusionRow {
    description: String,
    amount: f64,
}

pub async fn get_package_bill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(package_id): Path<Uuid>,
) -> Result<Json<PackageBillPrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    // Not guarded: `package_bills.patient_id` and `.admission_id` are both
    // NULLABLE, so neither can be a parent column — a row with a null would
    // authorize as "no such record" rather than being refused on its merits.

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PackageBillRow>(
        "SELECT \
           pb.bill_number, \
           pb.created_at AS bill_date, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.id::text AS admission_number, \
           a.admitted_at AS admission_date, \
           a.discharged_at AS discharge_date, \
           pkg.name AS package_name, \
           pkg.code AS package_code, \
           pkg.description AS package_description, \
           pb.package_amount, \
           pb.additional_total, \
           pb.exclusion_total, \
           pb.gross_amount, \
           pb.discount_amount, \
           pb.tax_amount, \
           pb.net_amount, \
           pb.advance_paid, \
           pb.insurance_amount, \
           pb.balance_due, \
           doc.full_name AS doctor_name, \
           d.name AS department_name \
         FROM package_bills pb \
         JOIN patients p ON p.id = pb.patient_id AND p.tenant_id = pb.tenant_id \
         LEFT JOIN admissions a ON a.id = pb.admission_id AND a.tenant_id = pb.tenant_id \
         JOIN packages pkg ON pkg.id = pb.package_id AND pkg.tenant_id = pb.tenant_id \
         LEFT JOIN users doc ON doc.id = pb.doctor_id \
         LEFT JOIN departments d ON d.id = pkg.department_id AND d.tenant_id = pb.tenant_id \
         WHERE pb.id = $1 AND pb.tenant_id = $2",
    )
    .bind(package_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let inclusions: Vec<String> = sqlx::query_scalar(
        "SELECT description FROM package_inclusions \
         WHERE package_bill_id = $1 AND tenant_id = $2 \
         ORDER BY display_order LIMIT 5000",
    )
    .bind(package_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let additional_charges = sqlx::query_as::<_, PackageAdditionalRow>(
        "SELECT description, amount, reason \
         FROM package_additional_charges \
         WHERE package_bill_id = $1 AND tenant_id = $2 \
         ORDER BY display_order LIMIT 5000",
    )
    .bind(package_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let exclusions_used = sqlx::query_as::<_, PackageExclusionRow>(
        "SELECT description, amount \
         FROM package_exclusions_used \
         WHERE package_bill_id = $1 AND tenant_id = $2 \
         ORDER BY display_order LIMIT 5000",
    )
    .bind(package_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1, gstin FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(PackageBillPrintData {
        bill_number: row.bill_number,
        bill_date: row.bill_date.format("%d-%b-%Y").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
        package_name: row.package_name,
        package_code: row.package_code,
        package_description: row.package_description,
        package_inclusions: inclusions,
        package_amount: row.package_amount,
        additional_charges: additional_charges
            .into_iter()
            .map(|c| PackageAdditionalCharge {
                description: c.description,
                amount: c.amount,
                reason: c.reason,
            })
            .collect(),
        additional_total: row.additional_total,
        exclusions_used: exclusions_used
            .into_iter()
            .map(|e| PackageExclusion {
                description: e.description,
                amount: e.amount,
            })
            .collect(),
        exclusion_total: row.exclusion_total,
        gross_amount: row.gross_amount,
        discount_amount: row.discount_amount,
        tax_amount: row.tax_amount,
        net_amount: row.net_amount,
        advance_paid: row.advance_paid,
        insurance_amount: row.insurance_amount,
        balance_due: row.balance_due,
        amount_in_words: amount_to_words(row.net_amount),
        doctor_name: row.doctor_name,
        department: row.department_name,
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_gstin: tenant.3,
        hospital_logo_url: tenant.1,
    }))
}

// ── Insurance Claim Form ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
#[allow(clippy::struct_excessive_bools)]
struct InsuranceClaimRow {
    claim_number: String,
    claim_date: chrono::DateTime<chrono::Utc>,
    claim_type: String,
    tpa_name: Option<String>,
    insurance_company: Option<String>,
    policy_number: Option<String>,
    member_id: Option<String>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    relation_to_primary: Option<String>,
    primary_holder_name: Option<String>,
    primary_holder_id: Option<String>,
    admission_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_date: Option<chrono::DateTime<chrono::Utc>>,
    length_of_stay: Option<i32>,
    diagnosis: String,
    procedure_performed: Option<String>,
    treating_doctor: Option<String>,
    department_name: Option<String>,
    room_charges: f64,
    nursing_charges: f64,
    investigation_charges: f64,
    medicine_charges: f64,
    consultation_charges: f64,
    procedure_charges: f64,
    other_charges: f64,
    total_bill_amount: f64,
    pre_auth_amount: Option<f64>,
    claim_amount: f64,
    patient_payable: f64,
    pre_auth_number: Option<String>,
    pre_auth_date: Option<chrono::DateTime<chrono::Utc>>,
    discharge_summary_attached: bool,
    investigation_reports_attached: bool,
    bill_attached: bool,
    declaration_date: chrono::NaiveDate,
    patient_signature_obtained: bool,
    hospital_stamp: bool,
}

pub async fn get_insurance_claim_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
) -> Result<Json<InsuranceClaimPrintData>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;
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

    let row = sqlx::query_as::<_, InsuranceClaimRow>(
        "SELECT \
           ic.claim_number, \
           ic.created_at AS claim_date, \
           ic.claim_type, \
           tpa.name AS tpa_name, \
           ins.company_name AS insurance_company, \
           pp.policy_number, \
           pp.member_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           pp.relation_to_primary, \
           pp.primary_holder_name, \
           pp.primary_holder_id, \
           a.admitted_at AS admission_date, \
           a.discharged_at AS discharge_date, \
           EXTRACT(DAY FROM (a.discharged_at - a.admitted_at))::int AS length_of_stay, \
           ic.diagnosis, \
           ic.procedure_performed, \
           doc.full_name AS treating_doctor, \
           d.name AS department_name, \
           ic.room_charges, \
           ic.nursing_charges, \
           ic.investigation_charges, \
           ic.medicine_charges, \
           ic.consultation_charges, \
           ic.procedure_charges, \
           ic.other_charges, \
           ic.total_bill_amount, \
           ic.pre_auth_amount, \
           ic.claim_amount, \
           ic.patient_payable, \
           ic.pre_auth_number, \
           ic.pre_auth_date, \
           ic.discharge_summary_attached, \
           ic.investigation_reports_attached, \
           ic.bill_attached, \
           ic.declaration_date, \
           ic.patient_signature_obtained, \
           ic.hospital_stamp \
         FROM insurance_claims ic \
         JOIN patients p ON p.id = ic.patient_id AND p.tenant_id = ic.tenant_id \
         LEFT JOIN patient_policies pp ON pp.id = ic.policy_id AND pp.tenant_id = ic.tenant_id \
         LEFT JOIN insurance_companies ins ON ins.id = pp.insurance_company_id AND ins.tenant_id = ic.tenant_id \
         LEFT JOIN tpas tpa ON tpa.id = pp.tpa_id AND tpa.tenant_id = ic.tenant_id \
         LEFT JOIN admissions a ON a.id = ic.admission_id AND a.tenant_id = ic.tenant_id \
         LEFT JOIN users doc ON doc.id = ic.treating_doctor_id \
         LEFT JOIN departments d ON d.id = a.department_id AND d.tenant_id = ic.tenant_id \
         WHERE ic.id = $1 AND ic.tenant_id = $2",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let icd_codes: Vec<String> = sqlx::query_scalar(
        "SELECT icd_code FROM insurance_claim_diagnoses \
         WHERE claim_id = $1 AND tenant_id = $2 AND icd_code IS NOT NULL \
         ORDER BY is_primary DESC LIMIT 5000",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let procedure_codes: Vec<String> = sqlx::query_scalar(
        "SELECT procedure_code FROM insurance_claim_procedures \
         WHERE claim_id = $1 AND tenant_id = $2 \
         ORDER BY display_order LIMIT 5000",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1, empanelment_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let claim_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        claim_id,
    )
    .await?;

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));

    Ok(Json(InsuranceClaimPrintData {
        claim_number: row.claim_number,
        claim_date: row.claim_date.format("%d-%b-%Y").to_string(),
        claim_type: row.claim_type,
        tpa_name: row.tpa_name,
        insurance_company: row.insurance_company,
        policy_number: row.policy_number,
        member_id: row.member_id,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        relation_to_primary: row.relation_to_primary,
        primary_holder_name: row.primary_holder_name,
        primary_holder_id: row.primary_holder_id,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
        length_of_stay: row.length_of_stay,
        diagnosis: row.diagnosis,
        icd_codes,
        procedure_performed: row.procedure_performed,
        procedure_codes,
        treating_doctor: row.treating_doctor.unwrap_or_default(),
        department: row.department_name,
        room_charges: row.room_charges,
        nursing_charges: row.nursing_charges,
        investigation_charges: row.investigation_charges,
        medicine_charges: row.medicine_charges,
        consultation_charges: row.consultation_charges,
        procedure_charges: row.procedure_charges,
        other_charges: row.other_charges,
        total_bill_amount: row.total_bill_amount,
        pre_auth_amount: row.pre_auth_amount,
        claim_amount: row.claim_amount,
        patient_payable: row.patient_payable,
        pre_auth_number: row.pre_auth_number,
        pre_auth_date: row.pre_auth_date.map(|d| d.format("%d-%b-%Y").to_string()),
        discharge_summary_attached: row.discharge_summary_attached,
        investigation_reports_attached: row.investigation_reports_attached,
        bill_attached: row.bill_attached,
        declaration_date: row.declaration_date.format("%d-%b-%Y").to_string(),
        patient_signature_obtained: row.patient_signature_obtained,
        hospital_stamp: row.hospital_stamp,
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_empanelment_number: tenant.3,
        hospital_logo_url: tenant.1,
        signatures: medbrains_signing::signed_documents::to_print_signatures(claim_sigs),
    }))
}

// ── TDS Certificate ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TdsCertRow {
    certificate_number: String,
    financial_year: String,
    quarter: String,
    deductor_name: String,
    deductor_tan: String,
    deductor_pan: String,
    deductor_address: Option<String>,
    deductee_name: String,
    deductee_pan: String,
    deductee_address: Option<String>,
    section_code: String,
    nature_of_payment: String,
    total_payment: f64,
    total_tds_deducted: f64,
    total_tds_deposited: f64,
    challan_number: Option<String>,
    challan_date: Option<chrono::NaiveDate>,
    bsr_code: Option<String>,
    verified_by: Option<String>,
    designation: Option<String>,
    verification_date: chrono::NaiveDate,
    place: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct TdsEntryRow {
    invoice_number: String,
    invoice_date: chrono::NaiveDate,
    payment_date: chrono::NaiveDate,
    gross_amount: f64,
    tds_rate: f64,
    tds_amount: f64,
}

pub async fn get_tds_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(tds_id): Path<Uuid>,
) -> Result<Json<TdsCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::billing::tds::LIST)?;
    // A tax-deduction certificate for a deductee, not a patient record;
    // `tds_certificates` has no patient column.

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, TdsCertRow>(
        "SELECT \
           tc.certificate_number, \
           tc.financial_year, \
           tc.quarter, \
           t.name AS deductor_name, \
           t.tan AS deductor_tan, \
           t.pan AS deductor_pan, \
           t.address_line1 AS deductor_address, \
           v.name AS deductee_name, \
           v.pan AS deductee_pan, \
           v.address AS deductee_address, \
           tc.section_code, \
           tc.nature_of_payment, \
           tc.total_payment, \
           tc.total_tds_deducted, \
           tc.total_tds_deposited, \
           tc.challan_number, \
           tc.challan_date, \
           tc.bsr_code, \
           u.full_name AS verified_by, \
           u.designation, \
           tc.verification_date, \
           tc.place \
         FROM tds_certificates tc \
         JOIN tenants t ON t.id = tc.tenant_id \
         JOIN vendors v ON v.id = tc.vendor_id AND v.tenant_id = tc.tenant_id \
         LEFT JOIN users u ON u.id = tc.verified_by_id \
         WHERE tc.id = $1 AND tc.tenant_id = $2",
    )
    .bind(tds_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let entries = sqlx::query_as::<_, TdsEntryRow>(
        "SELECT \
           invoice_number, \
           invoice_date, \
           payment_date, \
           gross_amount, \
           tds_rate, \
           tds_amount \
         FROM tds_entries \
         WHERE tds_certificate_id = $1 AND tenant_id = $2 \
         ORDER BY invoice_date LIMIT 5000",
    )
    .bind(tds_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(TdsCertificatePrintData {
        certificate_number: row.certificate_number,
        financial_year: row.financial_year,
        quarter: row.quarter,
        deductor_name: row.deductor_name,
        deductor_tan: row.deductor_tan,
        deductor_pan: row.deductor_pan,
        deductor_address: row.deductor_address,
        deductee_name: row.deductee_name,
        deductee_pan: row.deductee_pan,
        deductee_address: row.deductee_address,
        section_code: row.section_code,
        nature_of_payment: row.nature_of_payment,
        tds_entries: entries
            .into_iter()
            .map(|e| TdsEntry {
                invoice_number: e.invoice_number,
                invoice_date: e.invoice_date.format("%d-%b-%Y").to_string(),
                payment_date: e.payment_date.format("%d-%b-%Y").to_string(),
                gross_amount: e.gross_amount,
                tds_rate: e.tds_rate,
                tds_amount: e.tds_amount,
            })
            .collect(),
        total_payment: row.total_payment,
        total_tds_deducted: row.total_tds_deducted,
        total_tds_deposited: row.total_tds_deposited,
        challan_number: row.challan_number,
        challan_date: row.challan_date.map(|d| d.format("%d-%b-%Y").to_string()),
        bsr_code: row.bsr_code,
        verified_by: row.verified_by,
        designation: row.designation,
        verification_date: row.verification_date.format("%d-%b-%Y").to_string(),
        place: row.place,
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
            "/api/print-data/tds-certificate/{id}",
            get(get_tds_certificate_print_data),
        )
        .route(
            "/api/print-data/gst-invoice/{invoice_id}",
            get(get_gst_invoice_print_data),
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
            "/api/print-data/advance-receipt/{payment_id}",
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
            "/api/print-data/package-estimate/{estimate_id}",
            get(get_package_estimate_print_data),
        )
        .route(
            "/api/print-data/package-bill/{package_bill_id}",
            get(get_package_bill_print_data),
        )
        .route(
            "/api/print-data/insurance-claim/{claim_id}",
            get(get_insurance_claim_print_data),
        )
}
