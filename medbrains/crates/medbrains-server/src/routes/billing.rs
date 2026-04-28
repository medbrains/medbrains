#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::{
    AdvanceAdjustment, AuditAction, BadDebtWriteOff, BankTransaction, BillingAuditEntry,
    BillingConcession, BillingPackage, BillingPackageItem, ChargeMaster, CorporateClient,
    CorporateEnrollment, CreditNote, CreditPatient, CreditPatientStatus, CurrencyCode, DayEndClose,
    ErpExportLog, ExchangeRate, GlAccount, GstReturnSummary, InsuranceClaim, Invoice,
    InvoiceDiscount, InvoiceItem, JournalEntry, JournalEntryLine, PatientAdvance, Payment,
    RatePlan, RatePlanItem, Receipt, Refund, TdsDeduction, TpaRateCard,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Auto-billing helpers (used by other modules)
// ══════════════════════════════════════════════════════════

pub(crate) struct AutoChargeInput {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub charge_code: String,
    pub source: String,
    pub source_id: Uuid,
    pub quantity: i32,
    pub description_override: Option<String>,
    pub unit_price_override: Option<Decimal>,
    pub tax_percent_override: Option<Decimal>,
}

pub(crate) struct AutoChargeResult {
    pub invoice_id: Uuid,
    #[allow(dead_code)]
    pub item_id: Uuid,
    #[allow(dead_code)]
    pub was_new_invoice: bool,
    pub skipped_duplicate: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct ResolvedPrice {
    description: String,
    unit_price: Decimal,
    tax_percent: Decimal,
}

/// Check if auto-billing is enabled for a specific module.
pub(crate) async fn is_auto_billing_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    module: &str,
) -> Result<bool, AppError> {
    let key = format!("auto_charge_{module}");
    let val = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = $2",
    )
    .bind(tenant_id)
    .bind(&key)
    .fetch_optional(&mut **tx)
    .await?;

    match val {
        Some(v) => Ok(v.as_bool().unwrap_or_else(|| v.as_str() == Some("true"))),
        None => Ok(false),
    }
}

/// Resolve price from `charge_master` + `rate_plan` overrides.
async fn resolve_price(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: &Uuid,
    charge_code: &str,
) -> Result<Option<ResolvedPrice>, AppError> {
    // Get base price from charge_master
    let base = sqlx::query_as::<_, ResolvedPrice>(
        "SELECT name AS description, base_price AS unit_price, tax_percent \
         FROM charge_master \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true",
    )
    .bind(tenant_id)
    .bind(charge_code)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(mut price) = base else {
        return Ok(None);
    };

    // Try rate plan override: patient_category match first, then is_default
    let patient_category = sqlx::query_scalar::<_, Option<String>>(
        "SELECT category FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();

    // Look for category-specific rate plan first
    let rate_override = if let Some(ref cat) = patient_category {
        sqlx::query_as::<_, RatePlanOverride>(
            "SELECT rpi.override_price, rpi.override_tax_percent \
             FROM rate_plan_items rpi \
             JOIN rate_plans rp ON rp.id = rpi.rate_plan_id AND rp.tenant_id = rpi.tenant_id \
             WHERE rp.tenant_id = $1 AND rpi.charge_code = $2 \
               AND rp.is_active = true AND rp.patient_category = $3 \
             LIMIT 1",
        )
        .bind(tenant_id)
        .bind(charge_code)
        .bind(cat)
        .fetch_optional(&mut **tx)
        .await?
    } else {
        None
    };

    // Fall back to default rate plan
    let rate_override = match rate_override {
        Some(r) => Some(r),
        None => {
            sqlx::query_as::<_, RatePlanOverride>(
                "SELECT rpi.override_price, rpi.override_tax_percent \
                 FROM rate_plan_items rpi \
                 JOIN rate_plans rp ON rp.id = rpi.rate_plan_id AND rp.tenant_id = rpi.tenant_id \
                 WHERE rp.tenant_id = $1 AND rpi.charge_code = $2 \
                   AND rp.is_active = true AND rp.is_default = true \
                 LIMIT 1",
            )
            .bind(tenant_id)
            .bind(charge_code)
            .fetch_optional(&mut **tx)
            .await?
        }
    };

    if let Some(ovr) = rate_override {
        price.unit_price = ovr.override_price;
        if let Some(tax) = ovr.override_tax_percent {
            price.tax_percent = tax;
        }
    }

    Ok(Some(price))
}

#[derive(Debug, sqlx::FromRow)]
struct RatePlanOverride {
    override_price: Decimal,
    override_tax_percent: Option<Decimal>,
}

/// Auto-charge: find or create a draft invoice for the encounter, then add item.
/// Fails gracefully (returns Ok) — caller should not let billing errors block module operations.
pub(crate) async fn auto_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    input: AutoChargeInput,
) -> Result<AutoChargeResult, AppError> {
    // 1. Idempotency: check if this source_id is already charged
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoice_items \
         WHERE tenant_id = $1 AND source = $2::charge_source AND source_id = $3 \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(&input.source)
    .bind(input.source_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(item_id) = existing {
        // Already charged — find its invoice
        let inv_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT invoice_id FROM invoice_items WHERE id = $1 AND tenant_id = $2",
        )
        .bind(item_id)
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;

        return Ok(AutoChargeResult {
            invoice_id: inv_id,
            item_id,
            was_new_invoice: false,
            skipped_duplicate: true,
        });
    }

    // 2. Find or create draft invoice for this encounter
    let draft_invoice = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoices \
         WHERE tenant_id = $1 AND encounter_id = $2 AND status = 'draft'::invoice_status \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(input.encounter_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (invoice_id, was_new) = if let Some(id) = draft_invoice {
        (id, false)
    } else {
        let inv_number = generate_invoice_number(tx, tenant_id).await?;
        let id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO invoices \
             (tenant_id, invoice_number, patient_id, encounter_id, status, \
              subtotal, tax_amount, discount_amount, total_amount, paid_amount, notes) \
             VALUES ($1, $2, $3, $4, 'draft'::invoice_status, 0, 0, 0, 0, 0, 'Auto-generated') \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(&inv_number)
        .bind(input.patient_id)
        .bind(input.encounter_id)
        .fetch_one(&mut **tx)
        .await?;
        (id, true)
    };

    // 3. Resolve price
    let (unit_price, tax_pct, description) = if let Some(price) = input.unit_price_override {
        (
            price,
            input.tax_percent_override.unwrap_or(Decimal::ZERO),
            input
                .description_override
                .unwrap_or_else(|| input.charge_code.clone()),
        )
    } else {
        match resolve_price(tx, tenant_id, &input.patient_id, &input.charge_code).await? {
            Some(resolved) => (
                resolved.unit_price,
                resolved.tax_percent,
                input.description_override.unwrap_or(resolved.description),
            ),
            None => {
                // No charge_master entry — use zero price with description
                (
                    Decimal::ZERO,
                    Decimal::ZERO,
                    input
                        .description_override
                        .unwrap_or_else(|| input.charge_code.clone()),
                )
            }
        }
    };

    let total =
        unit_price * Decimal::from(input.quantity) * (Decimal::ONE + tax_pct / Decimal::from(100));

    // 4. Insert item
    let item_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO invoice_items \
         (tenant_id, invoice_id, charge_code, description, source, source_id, \
          quantity, unit_price, tax_percent, total_price) \
         VALUES ($1, $2, $3, $4, $5::charge_source, $6, $7, $8, $9, $10) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(&input.charge_code)
    .bind(&description)
    .bind(&input.source)
    .bind(input.source_id)
    .bind(input.quantity)
    .bind(unit_price)
    .bind(tax_pct)
    .bind(total)
    .fetch_one(&mut **tx)
    .await?;

    // 5. Recalculate invoice totals
    recalculate_invoice_totals(tx, invoice_id, *tenant_id).await?;

    Ok(AutoChargeResult {
        invoice_id,
        item_id,
        was_new_invoice: was_new,
        skipped_duplicate: false,
    })
}

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListInvoicesQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InvoiceListResponse {
    pub invoices: Vec<Invoice>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub notes: Option<String>,
    pub is_er_deferred: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct InvoiceDetailResponse {
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
    pub payments: Vec<Payment>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInvoiceRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddInvoiceItemRequest {
    pub charge_code: String,
    pub description: String,
    pub source: String,
    pub source_id: Option<Uuid>,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub tax_percent: Option<Decimal>,
    pub ordering_doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentRequest {
    pub amount: Decimal,
    pub mode: String,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChargeMasterRequest {
    pub code: String,
    pub name: String,
    pub category: String,
    pub base_price: Decimal,
    pub tax_percent: Option<Decimal>,
    pub hsn_sac_code: Option<String>,
    pub gst_category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChargeMasterRequest {
    pub name: Option<String>,
    pub category: Option<String>,
    pub base_price: Option<Decimal>,
    pub tax_percent: Option<Decimal>,
    pub is_active: Option<bool>,
    pub hsn_sac_code: Option<String>,
    pub gst_category: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Invoice number generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SeqResult {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

async fn generate_invoice_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'INVOICE' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let seq =
        seq.ok_or_else(|| AppError::Internal("INVOICE sequence not configured".to_owned()))?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

// ══════════════════════════════════════════════════════════
//  Recalculate invoice totals
// ══════════════════════════════════════════════════════════

async fn recalculate_invoice_totals(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    invoice_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE invoices SET \
         subtotal = COALESCE((SELECT SUM(unit_price * quantity) FROM invoice_items \
           WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         tax_amount = COALESCE((SELECT SUM(unit_price * quantity * tax_percent / 100) \
           FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         total_amount = COALESCE((SELECT SUM(total_price) FROM invoice_items \
           WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/invoices
// ══════════════════════════════════════════════════════════

pub async fn list_invoices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListInvoicesQuery>,
) -> Result<Json<InvoiceListResponse>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("patient_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(pid),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        conditions.push(format!("invoice_number ILIKE ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(pattern),
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM invoices WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            cq = cq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            cq = cq.bind(s.clone());
        }
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM invoices WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, Invoice>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            dq = dq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            dq = dq.bind(s.clone());
        }
    }
    let invoices = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(InvoiceListResponse {
        invoices,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/invoices
// ══════════════════════════════════════════════════════════

pub async fn create_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInvoiceRequest>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let inv_number = generate_invoice_number(&mut tx, &claims.tenant_id).await?;

    let er_deferred = body.is_er_deferred.unwrap_or(false);

    let invoice = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, notes, \
          is_er_deferred) \
         VALUES ($1, $2, $3, $4, 'draft'::invoice_status, 0, 0, 0, 0, 0, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&inv_number)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(&body.notes)
    .bind(er_deferred)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::InvoiceCreated,
        "invoice",
        invoice.id,
        Some(invoice.id),
        Some(invoice.patient_id),
        Some(invoice.total_amount),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;

    // Enrich payload with patient details for orchestration
    let patient_info = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT first_name || ' ' || last_name, uhid, \
         (SELECT name FROM departments WHERE id = e.department_id) \
         FROM patients p \
         LEFT JOIN encounters e ON e.id = $2 \
         WHERE p.id = $1",
    )
    .bind(invoice.patient_id)
    .bind(invoice.encounter_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let (patient_name, uhid, department_name) = patient_info
        .unwrap_or_else(|| ("Unknown".to_owned(), "N/A".to_owned(), None));

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "billing.invoice.created",
        serde_json::json!({
            "invoice_id": invoice.id,
            "patient_id": invoice.patient_id,
            "invoice_number": invoice.invoice_number,
            "patient_name": patient_name,
            "uhid": uhid,
            "total_amount": invoice.total_amount,
            "net_amount": invoice.total_amount - invoice.discount_amount,
            "department_name": department_name,
            "is_insured": invoice.corporate_id.is_some(),
        }),
    )
    .await;

    Ok(Json(invoice))
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/invoices/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<InvoiceDetailResponse>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY paid_at DESC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(InvoiceDetailResponse {
        invoice,
        items,
        payments,
    }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/invoices/{id}
// ══════════════════════════════════════════════════════════

pub async fn update_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInvoiceRequest>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let inv = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET notes = COALESCE($1, notes), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    inv.map_or_else(|| Err(AppError::NotFound), |i| Ok(Json(i)))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/invoices/{id}/items
// ══════════════════════════════════════════════════════════

pub async fn add_invoice_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<AddInvoiceItemRequest>,
) -> Result<Json<InvoiceItem>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let tax_pct = body.tax_percent.unwrap_or(Decimal::ZERO);
    let total = body.unit_price
        * Decimal::from(body.quantity)
        * (Decimal::ONE + tax_pct / Decimal::from(100));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let item = sqlx::query_as::<_, InvoiceItem>(
        "INSERT INTO invoice_items \
         (tenant_id, invoice_id, charge_code, description, source, source_id, \
          quantity, unit_price, tax_percent, total_price, ordering_doctor_id, department_id) \
         VALUES ($1, $2, $3, $4, $5::charge_source, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(&body.charge_code)
    .bind(&body.description)
    .bind(&body.source)
    .bind(body.source_id)
    .bind(body.quantity)
    .bind(body.unit_price)
    .bind(tax_pct)
    .bind(total)
    .bind(body.ordering_doctor_id)
    .bind(body.department_id)
    .fetch_one(&mut *tx)
    .await?;

    recalculate_invoice_totals(&mut tx, invoice_id, claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(item))
}

// ══════════════════════════════════════════════════════════
//  DELETE /api/billing/invoices/{id}/items/{iid}
// ══════════════════════════════════════════════════════════

pub async fn remove_invoice_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((invoice_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "DELETE FROM invoice_items WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3",
    )
    .bind(item_id)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.commit().await?;
        return Err(AppError::NotFound);
    }

    recalculate_invoice_totals(&mut tx, invoice_id, claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/invoices/{id}/issue
// ══════════════════════════════════════════════════════════

pub async fn issue_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let inv = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET status = 'issued'::invoice_status, \
         issued_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft'::invoice_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    inv.map_or_else(|| Err(AppError::NotFound), |i| Ok(Json(i)))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/invoices/{id}/cancel
// ══════════════════════════════════════════════════════════

pub async fn cancel_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let inv = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET status = 'cancelled'::invoice_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('draft'::invoice_status, 'issued'::invoice_status) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    inv.map_or_else(|| Err(AppError::NotFound), |i| Ok(Json(i)))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/invoices/{id}/payments
// ══════════════════════════════════════════════════════════

pub async fn record_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<RecordPaymentRequest>,
) -> Result<Json<Payment>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let payment = sqlx::query_as::<_, Payment>(
        "INSERT INTO payments \
         (tenant_id, invoice_id, amount, mode, reference_number, received_by, notes, paid_at) \
         VALUES ($1, $2, $3, $4::payment_mode, $5, $6, $7, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(body.amount)
    .bind(&body.mode)
    .bind(&body.reference_number)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Update paid_amount and status
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.amount)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Enrich payload with patient name for orchestration
    let patient_name = sqlx::query_scalar::<_, String>(
        "SELECT p.first_name || ' ' || p.last_name \
         FROM invoices i JOIN patients p ON p.id = i.patient_id \
         WHERE i.id = $1",
    )
    .bind(invoice_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "billing.payment.received",
        serde_json::json!({
            "payment_id": payment.id,
            "invoice_id": invoice_id,
            "patient_name": patient_name,
            "amount": payment.amount,
            "payment_mode": format!("{:?}", payment.mode),
            "receipt_number": payment.reference_number,
        }),
    )
    .await;

    Ok(Json(payment))
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/invoices/{id}/payments
// ══════════════════════════════════════════════════════════

pub async fn list_payments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<Payment>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY paid_at DESC",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(payments))
}

// ══════════════════════════════════════════════════════════
//  Charge Master CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ChargeMaster>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChargeMaster>(
        "SELECT * FROM charge_master WHERE tenant_id = $1 ORDER BY category, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateChargeMasterRequest>,
) -> Result<Json<ChargeMaster>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let tax_pct = body.tax_percent.unwrap_or(Decimal::ZERO);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ChargeMaster>(
        "INSERT INTO charge_master \
         (tenant_id, code, name, category, base_price, tax_percent, hsn_sac_code, gst_category) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.category)
    .bind(body.base_price)
    .bind(tax_pct)
    .bind(&body.hsn_sac_code)
    .bind(&body.gst_category)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChargeMasterRequest>,
) -> Result<Json<ChargeMaster>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ChargeMaster>(
        "UPDATE charge_master SET \
         name = COALESCE($1, name), \
         category = COALESCE($2, category), \
         base_price = COALESCE($3, base_price), \
         tax_percent = COALESCE($4, tax_percent), \
         is_active = COALESCE($5, is_active), \
         hsn_sac_code = COALESCE($6, hsn_sac_code), \
         gst_category = COALESCE($7, gst_category), \
         updated_at = now() \
         WHERE id = $8 AND tenant_id = $9 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.category)
    .bind(body.base_price)
    .bind(body.tax_percent)
    .bind(body.is_active)
    .bind(&body.hsn_sac_code)
    .bind(&body.gst_category)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM charge_master WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Billing Packages
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreatePackageRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub total_price: Decimal,
    pub discount_percent: Option<Decimal>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub items: Vec<CreatePackageItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageItemRequest {
    pub charge_code: String,
    pub description: String,
    pub quantity: i32,
    pub unit_price: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePackageRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub total_price: Option<Decimal>,
    pub discount_percent: Option<Decimal>,
    pub is_active: Option<bool>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PackageDetailResponse {
    pub package: BillingPackage,
    pub items: Vec<BillingPackageItem>,
}

pub async fn list_packages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BillingPackage>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BillingPackage>(
        "SELECT * FROM billing_packages WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PackageDetailResponse>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let package = sqlx::query_as::<_, BillingPackage>(
        "SELECT * FROM billing_packages WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, BillingPackageItem>(
        "SELECT * FROM billing_package_items WHERE package_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PackageDetailResponse { package, items }))
}

pub async fn create_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePackageRequest>,
) -> Result<Json<BillingPackage>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let disc = body.discount_percent.unwrap_or(Decimal::ZERO);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pkg = sqlx::query_as::<_, BillingPackage>(
        "INSERT INTO billing_packages \
         (tenant_id, code, name, description, total_price, discount_percent, \
          valid_from, valid_to) \
         VALUES ($1, $2, $3, $4, $5, $6, \
          $7::timestamptz, $8::timestamptz) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.total_price)
    .bind(disc)
    .bind(&body.valid_from)
    .bind(&body.valid_to)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        sqlx::query(
            "INSERT INTO billing_package_items \
             (tenant_id, package_id, charge_code, description, quantity, unit_price) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(claims.tenant_id)
        .bind(pkg.id)
        .bind(&item.charge_code)
        .bind(&item.description)
        .bind(item.quantity)
        .bind(item.unit_price)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(pkg))
}

pub async fn update_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePackageRequest>,
) -> Result<Json<BillingPackage>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BillingPackage>(
        "UPDATE billing_packages SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         total_price = COALESCE($3, total_price), \
         discount_percent = COALESCE($4, discount_percent), \
         is_active = COALESCE($5, is_active), \
         valid_from = COALESCE($6::timestamptz, valid_from), \
         valid_to = COALESCE($7::timestamptz, valid_to), \
         updated_at = now() \
         WHERE id = $8 AND tenant_id = $9 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.total_price)
    .bind(body.discount_percent)
    .bind(body.is_active)
    .bind(&body.valid_from)
    .bind(&body.valid_to)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM billing_packages WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Rate Plans
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRatePlanRequest {
    pub name: String,
    pub description: Option<String>,
    pub patient_category: Option<String>,
    pub is_default: Option<bool>,
    pub items: Vec<CreateRatePlanItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRatePlanItemRequest {
    pub charge_code: String,
    pub override_price: Decimal,
    pub override_tax_percent: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRatePlanRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub patient_category: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct RatePlanDetailResponse {
    pub plan: RatePlan,
    pub items: Vec<RatePlanItem>,
}

pub async fn list_rate_plans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RatePlan>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RatePlan>(
        "SELECT * FROM rate_plans WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RatePlanDetailResponse>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let plan =
        sqlx::query_as::<_, RatePlan>("SELECT * FROM rate_plans WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let items = sqlx::query_as::<_, RatePlanItem>(
        "SELECT * FROM rate_plan_items WHERE rate_plan_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(RatePlanDetailResponse { plan, items }))
}

pub async fn create_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRatePlanRequest>,
) -> Result<Json<RatePlan>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let plan = sqlx::query_as::<_, RatePlan>(
        "INSERT INTO rate_plans \
         (tenant_id, name, description, patient_category, is_default) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.patient_category)
    .bind(body.is_default.unwrap_or(false))
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        sqlx::query(
            "INSERT INTO rate_plan_items \
             (tenant_id, rate_plan_id, charge_code, override_price, override_tax_percent) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(claims.tenant_id)
        .bind(plan.id)
        .bind(&item.charge_code)
        .bind(item.override_price)
        .bind(item.override_tax_percent)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(plan))
}

pub async fn update_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRatePlanRequest>,
) -> Result<Json<RatePlan>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RatePlan>(
        "UPDATE rate_plans SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         patient_category = COALESCE($3, patient_category), \
         is_default = COALESCE($4, is_default), \
         is_active = COALESCE($5, is_active), \
         updated_at = now() \
         WHERE id = $6 AND tenant_id = $7 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.patient_category)
    .bind(body.is_default)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM rate_plans WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Invoice Discounts
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct AddDiscountRequest {
    pub discount_type: String,
    pub discount_value: Decimal,
    pub reason: Option<String>,
}

pub async fn list_discounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<InvoiceDiscount>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InvoiceDiscount>(
        "SELECT * FROM invoice_discounts \
         WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn add_discount(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<AddDiscountRequest>,
) -> Result<Json<InvoiceDiscount>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let discount = sqlx::query_as::<_, InvoiceDiscount>(
        "INSERT INTO invoice_discounts \
         (tenant_id, invoice_id, discount_type, discount_value, reason, approved_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(&body.discount_type)
    .bind(body.discount_value)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Recalculate discount_amount on the invoice
    sqlx::query(
        "UPDATE invoices SET \
         discount_amount = COALESCE((SELECT SUM(discount_value) \
           FROM invoice_discounts WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(discount))
}

pub async fn remove_discount(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((invoice_id, discount_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "DELETE FROM invoice_discounts \
         WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3",
    )
    .bind(discount_id)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.commit().await?;
        return Err(AppError::NotFound);
    }

    sqlx::query(
        "UPDATE invoices SET \
         discount_amount = COALESCE((SELECT SUM(discount_value) \
           FROM invoice_discounts WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Refunds
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRefundRequest {
    pub invoice_id: Uuid,
    pub payment_id: Option<Uuid>,
    pub amount: Decimal,
    pub reason: String,
    pub mode: String,
    pub reference_number: Option<String>,
}

async fn generate_refund_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'REFUND' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        // Fallback: use count-based number
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM refunds WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(&mut **tx)
                .await?;
        Ok(format!("RFD{:0>6}", count + 1))
    }
}

pub async fn list_refunds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Refund>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Refund>(
        "SELECT * FROM refunds WHERE tenant_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRefundRequest>,
) -> Result<Json<Refund>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let refund_number = generate_refund_number(&mut tx, &claims.tenant_id).await?;

    let refund = sqlx::query_as::<_, Refund>(
        "INSERT INTO refunds \
         (tenant_id, invoice_id, payment_id, refund_number, amount, reason, \
          mode, reference_number, refunded_by, refunded_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::payment_mode, $8, $9, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.payment_id)
    .bind(&refund_number)
    .bind(body.amount)
    .bind(&body.reason)
    .bind(&body.mode)
    .bind(&body.reference_number)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Update invoice paid_amount and status
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount - $1, \
         status = CASE \
           WHEN paid_amount - $1 <= 0 THEN 'refunded'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(refund))
}

// ══════════════════════════════════════════════════════════
//  Credit Notes
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateCreditNoteRequest {
    pub invoice_id: Uuid,
    pub amount: Decimal,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ApplyCreditNoteRequest {
    pub invoice_id: Uuid,
}

async fn generate_credit_note_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'CREDIT_NOTE' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM credit_notes WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(&mut **tx)
                .await?;
        Ok(format!("CN{:0>6}", count + 1))
    }
}

pub async fn list_credit_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CreditNote>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CreditNote>(
        "SELECT * FROM credit_notes WHERE tenant_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditNoteRequest>,
) -> Result<Json<CreditNote>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let cn_number = generate_credit_note_number(&mut tx, &claims.tenant_id).await?;

    let note = sqlx::query_as::<_, CreditNote>(
        "INSERT INTO credit_notes \
         (tenant_id, credit_note_number, invoice_id, amount, reason, status, created_by) \
         VALUES ($1, $2, $3, $4, $5, 'active', $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&cn_number)
    .bind(body.invoice_id)
    .bind(body.amount)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(note))
}

pub async fn apply_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApplyCreditNoteRequest>,
) -> Result<Json<CreditNote>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let note = sqlx::query_as::<_, CreditNote>(
        "UPDATE credit_notes SET \
         status = 'used', \
         used_against_invoice_id = $1, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND status = 'active' \
         RETURNING *",
    )
    .bind(body.invoice_id)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Apply credit to the target invoice
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(note.amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(note))
}

// ══════════════════════════════════════════════════════════
//  Receipts
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct GenerateReceiptRequest {
    pub payment_id: Uuid,
}

async fn generate_receipt_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'RECEIPT' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM receipts WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(&mut **tx)
                .await?;
        Ok(format!("RCT{:0>6}", count + 1))
    }
}

pub async fn list_receipts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<Receipt>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Receipt>(
        "SELECT * FROM receipts \
         WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn generate_receipt(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<GenerateReceiptRequest>,
) -> Result<Json<Receipt>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get payment amount
    let payment = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3",
    )
    .bind(body.payment_id)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let receipt_number = generate_receipt_number(&mut tx, &claims.tenant_id).await?;

    let receipt = sqlx::query_as::<_, Receipt>(
        "INSERT INTO receipts \
         (tenant_id, receipt_number, invoice_id, payment_id, amount, receipt_date) \
         VALUES ($1, $2, $3, $4, $5, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&receipt_number)
    .bind(invoice_id)
    .bind(body.payment_id)
    .bind(payment.amount)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(receipt))
}

// ══════════════════════════════════════════════════════════
//  Insurance Claims
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInsuranceClaimRequest {
    pub invoice_id: Uuid,
    pub patient_id: Uuid,
    pub insurance_provider: String,
    pub policy_number: Option<String>,
    pub claim_type: String,
    pub pre_auth_amount: Option<Decimal>,
    pub tpa_name: Option<String>,
    pub notes: Option<String>,
    pub scheme_type: Option<String>,
    pub co_pay_percent: Option<Decimal>,
    pub deductible_amount: Option<Decimal>,
    pub member_id: Option<String>,
    pub scheme_card_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInsuranceClaimRequest {
    pub status: Option<String>,
    pub claim_number: Option<String>,
    pub approved_amount: Option<Decimal>,
    pub settled_amount: Option<Decimal>,
    pub notes: Option<String>,
}

pub async fn list_insurance_claims(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<InsuranceClaim>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims WHERE tenant_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_insurance_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let claim = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(claim))
}

pub async fn create_insurance_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInsuranceClaimRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let scheme = body.scheme_type.as_deref().unwrap_or("private");

    let claim = sqlx::query_as::<_, InsuranceClaim>(
        "INSERT INTO insurance_claims \
         (tenant_id, invoice_id, patient_id, insurance_provider, policy_number, \
          claim_type, status, pre_auth_amount, tpa_name, notes, created_by, \
          scheme_type, co_pay_percent, deductible_amount, member_id, scheme_card_number) \
         VALUES ($1, $2, $3, $4, $5, $6, 'initiated', $7, $8, $9, $10, \
          $11::insurance_scheme_type, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.patient_id)
    .bind(&body.insurance_provider)
    .bind(&body.policy_number)
    .bind(&body.claim_type)
    .bind(body.pre_auth_amount)
    .bind(&body.tpa_name)
    .bind(&body.notes)
    .bind(claims.sub)
    .bind(scheme)
    .bind(body.co_pay_percent)
    .bind(body.deductible_amount)
    .bind(&body.member_id)
    .bind(&body.scheme_card_number)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(claim))
}

pub async fn update_insurance_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInsuranceClaimRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Handle settled_at based on status
    let set_settled = body.status.as_deref() == Some("settled")
        || body.status.as_deref() == Some("partially_settled");

    let claim = sqlx::query_as::<_, InsuranceClaim>(
        "UPDATE insurance_claims SET \
         status = COALESCE($1, status), \
         claim_number = COALESCE($2, claim_number), \
         approved_amount = COALESCE($3, approved_amount), \
         settled_amount = COALESCE($4, settled_amount), \
         notes = COALESCE($5, notes), \
         submitted_at = CASE WHEN $1 = 'claim_submitted' THEN now() ELSE submitted_at END, \
         settled_at = CASE WHEN $6 THEN now() ELSE settled_at END, \
         updated_at = now() \
         WHERE id = $7 AND tenant_id = $8 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(&body.claim_number)
    .bind(body.approved_amount)
    .bind(body.settled_amount)
    .bind(&body.notes)
    .bind(set_settled)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(claim))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/auto-charge  (manual trigger)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ManualAutoChargeRequest {
    pub encounter_id: Uuid,
    pub modules: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ManualAutoChargeResponse {
    pub invoice_id: Option<Uuid>,
    pub items_added: i32,
    pub items_skipped: i32,
    pub errors: Vec<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct LabOrderInfo {
    id: Uuid,
    patient_id: Uuid,
    test_id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct LabTestInfo {
    code: String,
    name: String,
    price: Decimal,
}

#[derive(Debug, sqlx::FromRow)]
struct PharmOrderInfo {
    id: Uuid,
    patient_id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct PharmItemInfo {
    id: Uuid,
    catalog_item_id: Option<Uuid>,
    drug_name: String,
    quantity: i32,
    unit_price: Decimal,
}

#[derive(Debug, sqlx::FromRow)]
struct RadOrderInfo {
    id: Uuid,
    patient_id: Uuid,
    modality_id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct OtBookingInfo {
    id: Uuid,
    patient_id: Uuid,
    procedure_name: Option<String>,
    ot_room_id: Option<Uuid>,
}

pub async fn trigger_auto_charge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ManualAutoChargeRequest>,
) -> Result<Json<ManualAutoChargeResponse>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut items_added: i32 = 0;
    let mut items_skipped: i32 = 0;
    let mut last_invoice_id: Option<Uuid> = None;
    let mut errors: Vec<String> = Vec::new();

    for module in &body.modules {
        match module.as_str() {
            "lab" => {
                let orders = sqlx::query_as::<_, LabOrderInfo>(
                    "SELECT id, patient_id, test_id FROM lab_orders \
                     WHERE encounter_id = $1 AND tenant_id = $2 \
                       AND status IN ('completed', 'verified')",
                )
                .bind(body.encounter_id)
                .bind(claims.tenant_id)
                .fetch_all(&mut *tx)
                .await?;

                for o in &orders {
                    let test = sqlx::query_as::<_, LabTestInfo>(
                        "SELECT code, name, price FROM lab_test_catalog \
                         WHERE id = $1 AND tenant_id = $2",
                    )
                    .bind(o.test_id)
                    .bind(claims.tenant_id)
                    .fetch_optional(&mut *tx)
                    .await?;

                    if let Some(t) = test {
                        match auto_charge(
                            &mut tx,
                            &claims.tenant_id,
                            AutoChargeInput {
                                patient_id: o.patient_id,
                                encounter_id: body.encounter_id,
                                charge_code: t.code,
                                source: "lab".to_owned(),
                                source_id: o.id,
                                quantity: 1,
                                description_override: Some(t.name),
                                unit_price_override: Some(t.price),
                                tax_percent_override: None,
                            },
                        )
                        .await
                        {
                            Ok(r) => {
                                last_invoice_id = Some(r.invoice_id);
                                if r.skipped_duplicate {
                                    items_skipped += 1;
                                } else {
                                    items_added += 1;
                                }
                            }
                            Err(e) => errors.push(format!("lab order {}: {e}", o.id)),
                        }
                    }
                }
            }
            "pharmacy" => {
                let orders = sqlx::query_as::<_, PharmOrderInfo>(
                    "SELECT id, patient_id FROM pharmacy_orders \
                     WHERE encounter_id = $1 AND tenant_id = $2 AND status = 'dispensed'",
                )
                .bind(body.encounter_id)
                .bind(claims.tenant_id)
                .fetch_all(&mut *tx)
                .await?;

                for o in &orders {
                    let items = sqlx::query_as::<_, PharmItemInfo>(
                        "SELECT id, catalog_item_id, drug_name, quantity, unit_price \
                         FROM pharmacy_order_items WHERE order_id = $1 AND tenant_id = $2",
                    )
                    .bind(o.id)
                    .bind(claims.tenant_id)
                    .fetch_all(&mut *tx)
                    .await?;

                    for item in &items {
                        let code = item.catalog_item_id.map_or_else(
                            || "PHARMA-GENERIC".to_owned(),
                            |cid| format!("PHARMA-{cid}"),
                        );
                        match auto_charge(
                            &mut tx,
                            &claims.tenant_id,
                            AutoChargeInput {
                                patient_id: o.patient_id,
                                encounter_id: body.encounter_id,
                                charge_code: code,
                                source: "pharmacy".to_owned(),
                                source_id: item.id,
                                quantity: item.quantity,
                                description_override: Some(item.drug_name.clone()),
                                unit_price_override: Some(item.unit_price),
                                tax_percent_override: None,
                            },
                        )
                        .await
                        {
                            Ok(r) => {
                                last_invoice_id = Some(r.invoice_id);
                                if r.skipped_duplicate {
                                    items_skipped += 1;
                                } else {
                                    items_added += 1;
                                }
                            }
                            Err(e) => errors.push(format!("pharmacy item {}: {e}", item.id)),
                        }
                    }
                }
            }
            "radiology" => {
                let orders = sqlx::query_as::<_, RadOrderInfo>(
                    "SELECT id, patient_id, modality_id FROM radiology_orders \
                     WHERE encounter_id = $1 AND tenant_id = $2 \
                       AND status IN ('completed', 'reported', 'verified')",
                )
                .bind(body.encounter_id)
                .bind(claims.tenant_id)
                .fetch_all(&mut *tx)
                .await?;

                for o in &orders {
                    let modality_code = sqlx::query_scalar::<_, String>(
                        "SELECT code FROM radiology_modalities \
                         WHERE id = $1 AND tenant_id = $2",
                    )
                    .bind(o.modality_id)
                    .bind(claims.tenant_id)
                    .fetch_optional(&mut *tx)
                    .await?;

                    let charge_code =
                        modality_code.map_or_else(|| "RAD-EXAM".to_owned(), |c| format!("RAD-{c}"));

                    match auto_charge(
                        &mut tx,
                        &claims.tenant_id,
                        AutoChargeInput {
                            patient_id: o.patient_id,
                            encounter_id: body.encounter_id,
                            charge_code,
                            source: "radiology".to_owned(),
                            source_id: o.id,
                            quantity: 1,
                            description_override: None,
                            unit_price_override: None,
                            tax_percent_override: None,
                        },
                    )
                    .await
                    {
                        Ok(r) => {
                            last_invoice_id = Some(r.invoice_id);
                            if r.skipped_duplicate {
                                items_skipped += 1;
                            } else {
                                items_added += 1;
                            }
                        }
                        Err(e) => errors.push(format!("radiology order {}: {e}", o.id)),
                    }
                }
            }
            "ot" => {
                // OT auto-billing: charge completed OT bookings
                let bookings = sqlx::query_as::<_, OtBookingInfo>(
                    "SELECT ob.id, ob.patient_id, ob.procedure_name, ob.ot_room_id \
                     FROM ot_bookings ob \
                     WHERE ob.encounter_id = $1 AND ob.tenant_id = $2 \
                       AND ob.status = 'completed'",
                )
                .bind(body.encounter_id)
                .bind(claims.tenant_id)
                .fetch_all(&mut *tx)
                .await?;

                for b in &bookings {
                    // Charge procedure
                    let proc_code = format!("OT-PROC-{}", b.id);
                    match auto_charge(
                        &mut tx,
                        &claims.tenant_id,
                        AutoChargeInput {
                            patient_id: b.patient_id,
                            encounter_id: body.encounter_id,
                            charge_code: proc_code,
                            source: "ot".to_owned(),
                            source_id: b.id,
                            quantity: 1,
                            description_override: Some(
                                b.procedure_name
                                    .clone()
                                    .unwrap_or_else(|| "OT Procedure".to_owned()),
                            ),
                            unit_price_override: None,
                            tax_percent_override: None,
                        },
                    )
                    .await
                    {
                        Ok(r) => {
                            last_invoice_id = Some(r.invoice_id);
                            if r.skipped_duplicate {
                                items_skipped += 1;
                            } else {
                                items_added += 1;
                            }
                        }
                        Err(e) => errors.push(format!("ot booking {}: {e}", b.id)),
                    }

                    // Charge OT room usage (if room assigned)
                    if let Some(room_id) = b.ot_room_id {
                        let room_code = format!("OT-ROOM-{room_id}");
                        match auto_charge(
                            &mut tx,
                            &claims.tenant_id,
                            AutoChargeInput {
                                patient_id: b.patient_id,
                                encounter_id: body.encounter_id,
                                charge_code: room_code,
                                source: "ot".to_owned(),
                                source_id: room_id,
                                quantity: 1,
                                description_override: Some("OT Room Usage".to_owned()),
                                unit_price_override: None,
                                tax_percent_override: None,
                            },
                        )
                        .await
                        {
                            Ok(r) => {
                                last_invoice_id = Some(r.invoice_id);
                                if r.skipped_duplicate {
                                    items_skipped += 1;
                                } else {
                                    items_added += 1;
                                }
                            }
                            Err(e) => errors.push(format!("ot room for booking {}: {e}", b.id)),
                        }
                    }
                }
            }
            other => {
                errors.push(format!("unsupported module: {other}"));
            }
        }
    }

    tx.commit().await?;

    Ok(Json(ManualAutoChargeResponse {
        invoice_id: last_invoice_id,
        items_added,
        items_skipped,
        errors,
    }))
}

// ══════════════════════════════════════════════════════════
//  Advance number generation
// ══════════════════════════════════════════════════════════

async fn generate_advance_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'ADVANCE' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM patient_advances WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(format!("ADV{:0>6}", count + 1))
    }
}

// ══════════════════════════════════════════════════════════
//  Patient Advances
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAdvancesQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdvanceRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub amount: Decimal,
    pub payment_mode: String,
    pub reference_number: Option<String>,
    pub purpose: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdjustAdvanceRequest {
    pub invoice_id: Uuid,
    pub amount: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RefundAdvanceRequest {
    pub amount: Decimal,
    pub reason: String,
    pub mode: Option<String>,
    pub reference_number: Option<String>,
}

pub async fn list_advances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAdvancesQuery>,
) -> Result<Json<Vec<PatientAdvance>>, AppError> {
    require_permission(&claims, permissions::billing::advances::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(pid) = params.patient_id {
        sqlx::query_as::<_, PatientAdvance>(
            "SELECT * FROM patient_advances \
             WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(pid)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PatientAdvance>(
            "SELECT * FROM patient_advances \
             WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_advance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAdvanceRequest>,
) -> Result<Json<PatientAdvance>, AppError> {
    require_permission(&claims, permissions::billing::advances::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let adv_number = generate_advance_number(&mut tx, &claims.tenant_id).await?;
    let purpose = body.purpose.as_deref().unwrap_or("general");

    let advance = sqlx::query_as::<_, PatientAdvance>(
        "INSERT INTO patient_advances \
         (tenant_id, patient_id, encounter_id, advance_number, amount, balance, \
          payment_mode, reference_number, purpose, status, received_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $5, $6::payment_mode, $7, \
          $8::advance_purpose, 'active'::advance_status, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(&adv_number)
    .bind(body.amount)
    .bind(&body.payment_mode)
    .bind(&body.reference_number)
    .bind(purpose)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(advance))
}

pub async fn adjust_advance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdjustAdvanceRequest>,
) -> Result<Json<AdvanceAdjustment>, AppError> {
    require_permission(&claims, permissions::billing::advances::ADJUST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Check advance balance
    let advance = sqlx::query_as::<_, PatientAdvance>(
        "SELECT * FROM patient_advances WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if advance.balance < body.amount {
        return Err(AppError::BadRequest(
            "Adjustment amount exceeds advance balance".to_owned(),
        ));
    }

    // Deduct balance
    let new_balance = advance.balance - body.amount;
    let new_status = if new_balance == Decimal::ZERO {
        "fully_used"
    } else {
        "partially_used"
    };

    sqlx::query(
        "UPDATE patient_advances SET balance = $1, status = $2::advance_status, \
         updated_at = now() WHERE id = $3 AND tenant_id = $4",
    )
    .bind(new_balance)
    .bind(new_status)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Create adjustment record
    let adj = sqlx::query_as::<_, AdvanceAdjustment>(
        "INSERT INTO advance_adjustments \
         (tenant_id, advance_id, invoice_id, amount_adjusted, adjusted_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.invoice_id)
    .bind(body.amount)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Apply as payment to the invoice
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(adj))
}

pub async fn refund_advance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RefundAdvanceRequest>,
) -> Result<Json<PatientAdvance>, AppError> {
    require_permission(&claims, permissions::billing::advances::REFUND)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let advance = sqlx::query_as::<_, PatientAdvance>(
        "SELECT * FROM patient_advances WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if advance.balance < body.amount {
        return Err(AppError::BadRequest(
            "Refund amount exceeds advance balance".to_owned(),
        ));
    }

    let new_balance = advance.balance - body.amount;
    let updated = sqlx::query_as::<_, PatientAdvance>(
        "UPDATE patient_advances SET balance = $1, \
         status = 'refunded'::advance_status, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 RETURNING *",
    )
    .bind(new_balance)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Create a refunds record
    let mode = body.mode.as_deref().unwrap_or("cash");
    let refund_number = generate_refund_number(&mut tx, &claims.tenant_id).await?;

    // Use a zero-invoice placeholder — advance refund is not tied to a specific invoice
    // We create the refund record with the advance's own data for audit trail
    sqlx::query(
        "INSERT INTO refunds \
         (tenant_id, refund_number, amount, reason, mode, reference_number, \
          refunded_by, refunded_at, invoice_id) \
         VALUES ($1, $2, $3, $4, $5::payment_mode, $6, $7, now(), \
          (SELECT id FROM invoices WHERE tenant_id = $1 LIMIT 1))",
    )
    .bind(claims.tenant_id)
    .bind(&refund_number)
    .bind(body.amount)
    .bind(&body.reason)
    .bind(mode)
    .bind(&body.reference_number)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await
    .ok(); // Best-effort — don't fail advance refund if refund record fails

    tx.commit().await?;
    Ok(Json(updated))
}

// ══════════════════════════════════════════════════════════
//  Interim Billing
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInterimInvoiceRequest {
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub notes: Option<String>,
}

pub async fn create_interim_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInterimInvoiceRequest>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Find the last interim invoice for this encounter
    #[derive(Debug, sqlx::FromRow)]
    struct LastInterim {
        sequence_number: Option<i32>,
        billing_period_end: Option<chrono::DateTime<chrono::Utc>>,
    }

    let last = sqlx::query_as::<_, LastInterim>(
        "SELECT sequence_number, billing_period_end FROM invoices \
         WHERE tenant_id = $1 AND encounter_id = $2 AND is_interim = true \
         ORDER BY sequence_number DESC NULLS LAST LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .fetch_optional(&mut *tx)
    .await?;

    let seq_num = last.as_ref().and_then(|l| l.sequence_number).unwrap_or(0) + 1;
    let period_start = last.and_then(|l| l.billing_period_end).unwrap_or_else(|| {
        // Use encounter start time as first period start
        chrono::Utc::now()
    });
    let period_end = chrono::Utc::now();

    let inv_number = generate_invoice_number(&mut tx, &claims.tenant_id).await?;

    // Copy unbilled items from current draft (if any), or create empty interim
    let invoice = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, \
          cgst_amount, sgst_amount, igst_amount, cess_amount, \
          is_interim, billing_period_start, billing_period_end, \
          sequence_number, notes) \
         VALUES ($1, $2, $3, $4, 'issued'::invoice_status, \
          0, 0, 0, 0, 0, 0, 0, 0, 0, \
          true, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&inv_number)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(period_start)
    .bind(period_end)
    .bind(seq_num)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Move items from current draft to interim
    let draft_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoices \
         WHERE tenant_id = $1 AND encounter_id = $2 \
           AND status = 'draft'::invoice_status AND is_interim = false \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(draft) = draft_id {
        sqlx::query(
            "UPDATE invoice_items SET invoice_id = $1 \
             WHERE invoice_id = $2 AND tenant_id = $3",
        )
        .bind(invoice.id)
        .bind(draft)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        recalculate_invoice_totals(&mut tx, invoice.id, claims.tenant_id).await?;

        // Delete the now-empty draft
        sqlx::query("DELETE FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(draft)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
    }

    // Re-fetch the invoice with updated totals
    let updated =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(invoice.id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(updated))
}

// ══════════════════════════════════════════════════════════
//  Corporate Clients
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateCorporateRequest {
    pub code: String,
    pub name: String,
    pub gst_number: Option<String>,
    pub billing_address: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub credit_days: Option<i32>,
    pub agreed_discount_percent: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCorporateRequest {
    pub name: Option<String>,
    pub gst_number: Option<String>,
    pub billing_address: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub credit_days: Option<i32>,
    pub agreed_discount_percent: Option<Decimal>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnrollmentRequest {
    pub patient_id: Uuid,
    pub employee_id: Option<String>,
    pub department: Option<String>,
}

pub async fn list_corporates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CorporateClient>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CorporateClient>(
        "SELECT * FROM corporate_clients WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_corporate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CorporateClient>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let corp = sqlx::query_as::<_, CorporateClient>(
        "SELECT * FROM corporate_clients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(corp))
}

pub async fn create_corporate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCorporateRequest>,
) -> Result<Json<CorporateClient>, AppError> {
    require_permission(&claims, permissions::billing::corporate::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let corp = sqlx::query_as::<_, CorporateClient>(
        "INSERT INTO corporate_clients \
         (tenant_id, code, name, gst_number, billing_address, contact_email, \
          contact_phone, credit_limit, credit_days, agreed_discount_percent) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.gst_number)
    .bind(&body.billing_address)
    .bind(&body.contact_email)
    .bind(&body.contact_phone)
    .bind(body.credit_limit.unwrap_or(Decimal::ZERO))
    .bind(body.credit_days.unwrap_or(30))
    .bind(body.agreed_discount_percent.unwrap_or(Decimal::ZERO))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(corp))
}

pub async fn update_corporate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCorporateRequest>,
) -> Result<Json<CorporateClient>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CorporateClient>(
        "UPDATE corporate_clients SET \
         name = COALESCE($1, name), \
         gst_number = COALESCE($2, gst_number), \
         billing_address = COALESCE($3, billing_address), \
         contact_email = COALESCE($4, contact_email), \
         contact_phone = COALESCE($5, contact_phone), \
         credit_limit = COALESCE($6, credit_limit), \
         credit_days = COALESCE($7, credit_days), \
         agreed_discount_percent = COALESCE($8, agreed_discount_percent), \
         is_active = COALESCE($9, is_active), \
         updated_at = now() \
         WHERE id = $10 AND tenant_id = $11 RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.gst_number)
    .bind(&body.billing_address)
    .bind(&body.contact_email)
    .bind(&body.contact_phone)
    .bind(body.credit_limit)
    .bind(body.credit_days)
    .bind(body.agreed_discount_percent)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_enrollments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(corporate_id): Path<Uuid>,
) -> Result<Json<Vec<CorporateEnrollment>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CorporateEnrollment>(
        "SELECT * FROM corporate_enrollments \
         WHERE tenant_id = $1 AND corporate_id = $2 ORDER BY enrolled_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(corporate_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_enrollment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(corporate_id): Path<Uuid>,
    Json(body): Json<CreateEnrollmentRequest>,
) -> Result<Json<CorporateEnrollment>, AppError> {
    require_permission(&claims, permissions::billing::corporate::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enr = sqlx::query_as::<_, CorporateEnrollment>(
        "INSERT INTO corporate_enrollments \
         (tenant_id, corporate_id, patient_id, employee_id, department) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(corporate_id)
    .bind(body.patient_id)
    .bind(&body.employee_id)
    .bind(&body.department)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(enr))
}

pub async fn delete_enrollment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((corporate_id, enrollment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "DELETE FROM corporate_enrollments \
         WHERE id = $1 AND corporate_id = $2 AND tenant_id = $3",
    )
    .bind(enrollment_id)
    .bind(corporate_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn list_corporate_invoices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(corporate_id): Path<Uuid>,
) -> Result<Json<Vec<Invoice>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Invoice>(
        "SELECT * FROM invoices \
         WHERE tenant_id = $1 AND corporate_id = $2 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(corporate_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Revenue Reports
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ReportDateRange {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct BillingSummaryReport {
    pub total_invoiced: Decimal,
    pub total_collected: Decimal,
    pub total_outstanding: Decimal,
    pub total_refunded: Decimal,
    pub total_discounts: Decimal,
    pub invoice_count: i64,
    pub payment_modes: Vec<PaymentModeSummary>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PaymentModeSummary {
    pub mode: String,
    pub total: Decimal,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepartmentRevenueRow {
    pub department: String,
    pub total_revenue: Decimal,
    pub invoice_count: i64,
}

#[derive(Debug, Serialize)]
pub struct CollectionEfficiencyReport {
    pub overall_rate: Decimal,
    pub months: Vec<MonthlyEfficiency>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MonthlyEfficiency {
    pub month: String,
    pub invoiced: Decimal,
    pub collected: Decimal,
    pub rate: Decimal,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AgingBucket {
    pub bucket: String,
    pub count: i64,
    pub total_amount: Decimal,
}

#[derive(Debug, Serialize)]
pub struct DailySummary {
    pub date: NaiveDate,
    pub invoices_created: i64,
    pub invoices_issued: i64,
    pub total_billed: Decimal,
    pub total_collected: Decimal,
    pub payments: Vec<PaymentModeSummary>,
}

#[derive(Debug, Deserialize)]
pub struct DailyReportQuery {
    pub date: NaiveDate,
}

pub async fn report_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<BillingSummaryReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(Debug, sqlx::FromRow)]
    struct Summary {
        total_invoiced: Option<Decimal>,
        total_collected: Option<Decimal>,
        total_outstanding: Option<Decimal>,
        invoice_count: Option<i64>,
    }

    let s = sqlx::query_as::<_, Summary>(
        "SELECT \
           COALESCE(SUM(total_amount), 0) AS total_invoiced, \
           COALESCE(SUM(paid_amount), 0) AS total_collected, \
           COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding, \
           COUNT(*) AS invoice_count \
         FROM invoices \
         WHERE tenant_id = $1 \
           AND status != 'cancelled'::invoice_status \
           AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day')",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&mut *tx)
    .await?;

    let total_refunded = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(amount), 0) FROM refunds \
         WHERE tenant_id = $1 AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day')",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&mut *tx)
    .await?;

    let total_discounts = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(discount_amount), 0) FROM invoices \
         WHERE tenant_id = $1 AND status != 'cancelled'::invoice_status \
           AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day')",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&mut *tx)
    .await?;

    let payment_modes = sqlx::query_as::<_, PaymentModeSummary>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at >= $2::date \
           AND paid_at < ($3::date + interval '1 day') \
         GROUP BY mode ORDER BY total DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(BillingSummaryReport {
        total_invoiced: s.total_invoiced.unwrap_or(Decimal::ZERO),
        total_collected: s.total_collected.unwrap_or(Decimal::ZERO),
        total_outstanding: s.total_outstanding.unwrap_or(Decimal::ZERO),
        total_refunded: total_refunded.unwrap_or(Decimal::ZERO),
        total_discounts: total_discounts.unwrap_or(Decimal::ZERO),
        invoice_count: s.invoice_count.unwrap_or(0),
        payment_modes,
    }))
}

pub async fn report_department_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<Vec<DepartmentRevenueRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DepartmentRevenueRow>(
        "SELECT \
           COALESCE(ii.charge_code, 'Other') AS department, \
           COALESCE(SUM(ii.total_price), 0) AS total_revenue, \
           COUNT(DISTINCT ii.invoice_id) AS invoice_count \
         FROM invoice_items ii \
         JOIN invoices inv ON inv.id = ii.invoice_id AND inv.tenant_id = ii.tenant_id \
         WHERE ii.tenant_id = $1 \
           AND inv.status != 'cancelled'::invoice_status \
           AND inv.created_at >= $2::date \
           AND inv.created_at < ($3::date + interval '1 day') \
         GROUP BY ii.charge_code ORDER BY total_revenue DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn report_collection_efficiency(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<CollectionEfficiencyReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let months = sqlx::query_as::<_, MonthlyEfficiency>(
        "SELECT \
           to_char(created_at, 'YYYY-MM') AS month, \
           COALESCE(SUM(total_amount), 0) AS invoiced, \
           COALESCE(SUM(paid_amount), 0) AS collected, \
           CASE WHEN SUM(total_amount) > 0 \
             THEN ROUND(SUM(paid_amount) * 100 / SUM(total_amount), 2) \
             ELSE 0 END AS rate \
         FROM invoices \
         WHERE tenant_id = $1 \
           AND status != 'cancelled'::invoice_status \
           AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day') \
         GROUP BY to_char(created_at, 'YYYY-MM') ORDER BY month",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    let overall_invoiced: Decimal = months.iter().map(|m| m.invoiced).sum();
    let overall_collected: Decimal = months.iter().map(|m| m.collected).sum();
    let overall_rate = if overall_invoiced > Decimal::ZERO {
        (overall_collected * Decimal::from(100) / overall_invoiced).round_dp(2)
    } else {
        Decimal::ZERO
    };

    tx.commit().await?;

    Ok(Json(CollectionEfficiencyReport {
        overall_rate,
        months,
    }))
}

pub async fn report_aging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AgingBucket>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AgingBucket>(
        "SELECT \
           CASE \
             WHEN now() - issued_at <= interval '30 days' THEN '0-30 days' \
             WHEN now() - issued_at <= interval '60 days' THEN '31-60 days' \
             WHEN now() - issued_at <= interval '90 days' THEN '61-90 days' \
             ELSE '90+ days' \
           END AS bucket, \
           COUNT(*) AS count, \
           COALESCE(SUM(total_amount - paid_amount), 0) AS total_amount \
         FROM invoices \
         WHERE tenant_id = $1 \
           AND status IN ('issued'::invoice_status, 'partially_paid'::invoice_status) \
           AND issued_at IS NOT NULL \
         GROUP BY bucket ORDER BY bucket",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn report_daily(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DailyReportQuery>,
) -> Result<Json<DailySummary>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoices_created = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices \
         WHERE tenant_id = $1 AND created_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let invoices_issued = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices \
         WHERE tenant_id = $1 AND issued_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let total_billed = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM invoices \
         WHERE tenant_id = $1 AND issued_at::date = $2 \
           AND status != 'cancelled'::invoice_status",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let total_collected = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(amount), 0) FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let payments = sqlx::query_as::<_, PaymentModeSummary>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2 \
         GROUP BY mode ORDER BY total DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DailySummary {
        date: params.date,
        invoices_created,
        invoices_issued,
        total_billed: total_billed.unwrap_or(Decimal::ZERO),
        total_collected: total_collected.unwrap_or(Decimal::ZERO),
        payments,
    }))
}

// ══════════════════════════════════════════════════════════
//  Audit Log Helper (append-only, fire-and-forget)
// ══════════════════════════════════════════════════════════

#[allow(clippy::too_many_arguments)]
async fn log_billing_audit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    action: AuditAction,
    entity_type: &str,
    entity_id: Uuid,
    invoice_id: Option<Uuid>,
    patient_id: Option<Uuid>,
    amount: Option<Decimal>,
    new_state: Option<serde_json::Value>,
    performed_by: Uuid,
) {
    let _ = sqlx::query(
        "INSERT INTO billing_audit_log \
         (tenant_id, action, entity_type, entity_id, invoice_id, patient_id, \
          amount, new_state, performed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(tenant_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(invoice_id)
    .bind(patient_id)
    .bind(amount)
    .bind(new_state)
    .bind(performed_by)
    .execute(&mut **tx)
    .await;
}

// ══════════════════════════════════════════════════════════
//  Day-End Cash Closing
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateDayCloseRequest {
    pub close_date: NaiveDate,
    pub actual_cash: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListDayClosesQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

pub async fn list_day_closes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDayClosesQuery>,
) -> Result<Json<Vec<DayEndClose>>, AppError> {
    require_permission(&claims, permissions::billing::day_close::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (params.from, params.to) {
        (Some(from), Some(to)) => {
            sqlx::query_as::<_, DayEndClose>(
                "SELECT * FROM day_end_closes \
                 WHERE tenant_id = $1 AND close_date >= $2 AND close_date <= $3 \
                 ORDER BY close_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(from)
            .bind(to)
            .fetch_all(&mut *tx)
            .await?
        }
        _ => {
            sqlx::query_as::<_, DayEndClose>(
                "SELECT * FROM day_end_closes \
                 WHERE tenant_id = $1 ORDER BY close_date DESC LIMIT 30",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, sqlx::FromRow)]
struct PaymentModeTotal {
    mode: String,
    total: Decimal,
    cnt: i64,
}

pub async fn create_day_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDayCloseRequest>,
) -> Result<Json<DayEndClose>, AppError> {
    require_permission(&claims, permissions::billing::day_close::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Auto-calculate expected totals from payments on this date
    let mode_totals = sqlx::query_as::<_, PaymentModeTotal>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2 \
         GROUP BY mode",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_all(&mut *tx)
    .await?;

    let mut expected_cash = Decimal::ZERO;
    let mut total_card = Decimal::ZERO;
    let mut total_upi = Decimal::ZERO;
    let mut total_cheque = Decimal::ZERO;
    let mut total_bank = Decimal::ZERO;
    let mut total_insurance = Decimal::ZERO;
    let mut payments_count: i64 = 0;

    for mt in &mode_totals {
        payments_count += mt.cnt;
        match mt.mode.as_str() {
            "cash" => expected_cash = mt.total,
            "card" => total_card = mt.total,
            "upi" => total_upi = mt.total,
            "cheque" => total_cheque = mt.total,
            "bank_transfer" => total_bank = mt.total,
            "insurance" => total_insurance = mt.total,
            _ => {}
        }
    }

    let total_collected =
        expected_cash + total_card + total_upi + total_cheque + total_bank + total_insurance;
    let cash_difference = body.actual_cash - expected_cash;

    let invoices_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices \
         WHERE tenant_id = $1 AND issued_at::date = $2 \
           AND status != 'cancelled'::invoice_status",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_one(&mut *tx)
    .await?;

    let refunds_total = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT SUM(amount) FROM refunds \
         WHERE tenant_id = $1 AND refunded_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(Decimal::ZERO);

    let advances_total = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT SUM(amount) FROM patient_advances \
         WHERE tenant_id = $1 AND created_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(Decimal::ZERO);

    let inv_count_i32 = i32::try_from(invoices_count).unwrap_or(0);
    let pay_count_i32 = i32::try_from(payments_count).unwrap_or(0);

    let row = sqlx::query_as::<_, DayEndClose>(
        "INSERT INTO day_end_closes \
         (tenant_id, close_date, cashier_id, expected_cash, actual_cash, cash_difference, \
          total_card, total_upi, total_cheque, total_bank_transfer, total_insurance, \
          total_collected, invoices_count, payments_count, refunds_total, advances_total, \
          status, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, \
          'open'::day_close_status, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .bind(claims.sub)
    .bind(expected_cash)
    .bind(body.actual_cash)
    .bind(cash_difference)
    .bind(total_card)
    .bind(total_upi)
    .bind(total_cheque)
    .bind(total_bank)
    .bind(total_insurance)
    .bind(total_collected)
    .bind(inv_count_i32)
    .bind(pay_count_i32)
    .bind(refunds_total)
    .bind(advances_total)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::DayClosed,
        "day_close",
        row.id,
        None,
        None,
        Some(total_collected),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn verify_day_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DayEndClose>, AppError> {
    require_permission(&claims, permissions::billing::day_close::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing = sqlx::query_as::<_, DayEndClose>(
        "SELECT * FROM day_end_closes WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let new_status = if existing.cash_difference == Decimal::ZERO {
        "verified"
    } else {
        "discrepancy"
    };

    let row = sqlx::query_as::<_, DayEndClose>(
        "UPDATE day_end_closes SET \
         status = $1::day_close_status, verified_by = $2, verified_at = now(), \
         updated_at = now() \
         WHERE id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(new_status)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Bad Debt Write-Offs
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateWriteOffRequest {
    pub invoice_id: Uuid,
    pub amount: Decimal,
    pub reason: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveWriteOffRequest {
    pub approved: bool,
    pub notes: Option<String>,
}

async fn generate_write_off_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'WRITE_OFF' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM bad_debt_write_offs WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(format!("WO{:0>6}", count + 1))
    }
}

pub async fn list_write_offs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BadDebtWriteOff>>, AppError> {
    require_permission(&claims, permissions::billing::write_off::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BadDebtWriteOff>(
        "SELECT * FROM bad_debt_write_offs WHERE tenant_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_write_off(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWriteOffRequest>,
) -> Result<Json<BadDebtWriteOff>, AppError> {
    require_permission(&claims, permissions::billing::write_off::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let wo_number = generate_write_off_number(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BadDebtWriteOff>(
        "INSERT INTO bad_debt_write_offs \
         (tenant_id, invoice_id, write_off_number, amount, reason, \
          status, requested_by, notes) \
         VALUES ($1, $2, $3, $4, $5, 'pending'::write_off_status, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(&wo_number)
    .bind(body.amount)
    .bind(&body.reason)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::WriteOffCreated,
        "write_off",
        row.id,
        Some(body.invoice_id),
        None,
        Some(body.amount),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_write_off(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveWriteOffRequest>,
) -> Result<Json<BadDebtWriteOff>, AppError> {
    require_permission(&claims, permissions::billing::write_off::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let new_status = if body.approved {
        "approved"
    } else {
        "rejected"
    };

    let row = sqlx::query_as::<_, BadDebtWriteOff>(
        "UPDATE bad_debt_write_offs SET \
         status = $1::write_off_status, approved_by = $2, approved_at = now(), \
         notes = COALESCE($3, notes), updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 AND status = 'pending'::write_off_status \
         RETURNING *",
    )
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::WriteOffApproved,
        "write_off",
        row.id,
        Some(row.invoice_id),
        None,
        Some(row.amount),
        Some(serde_json::json!({ "approved": body.approved })),
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  TPA Rate Cards
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateTpaRateCardRequest {
    pub tpa_name: String,
    pub insurance_provider: String,
    pub rate_plan_id: Uuid,
    pub scheme_type: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTpaRateCardRequest {
    pub tpa_name: Option<String>,
    pub insurance_provider: Option<String>,
    pub rate_plan_id: Option<Uuid>,
    pub scheme_type: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub is_active: Option<bool>,
}

pub async fn list_tpa_rate_cards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TpaRateCard>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TpaRateCard>(
        "SELECT * FROM tpa_rate_cards WHERE tenant_id = $1 ORDER BY tpa_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_tpa_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTpaRateCardRequest>,
) -> Result<Json<TpaRateCard>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let scheme = body.scheme_type.as_deref().unwrap_or("private");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TpaRateCard>(
        "INSERT INTO tpa_rate_cards \
         (tenant_id, tpa_name, insurance_provider, rate_plan_id, \
          scheme_type, valid_from, valid_to) \
         VALUES ($1, $2, $3, $4, $5::insurance_scheme_type, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.tpa_name)
    .bind(&body.insurance_provider)
    .bind(body.rate_plan_id)
    .bind(scheme)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_tpa_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTpaRateCardRequest>,
) -> Result<Json<TpaRateCard>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TpaRateCard>(
        "UPDATE tpa_rate_cards SET \
         tpa_name = COALESCE($1, tpa_name), \
         insurance_provider = COALESCE($2, insurance_provider), \
         rate_plan_id = COALESCE($3, rate_plan_id), \
         valid_from = COALESCE($4, valid_from), \
         valid_to = COALESCE($5, valid_to), \
         is_active = COALESCE($6, is_active), \
         updated_at = now() \
         WHERE id = $7 AND tenant_id = $8 \
         RETURNING *",
    )
    .bind(&body.tpa_name)
    .bind(&body.insurance_provider)
    .bind(body.rate_plan_id)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_tpa_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM tpa_rate_cards WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Invoice Clone
// ══════════════════════════════════════════════════════════

pub async fn clone_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let original =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let new_number = generate_invoice_number(&mut tx, &claims.tenant_id).await?;

    let cloned = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, \
          notes, cgst_amount, sgst_amount, igst_amount, cess_amount, \
          is_interim, corporate_id, place_of_supply, cloned_from_id, is_er_deferred) \
         VALUES ($1, $2, $3, $4, 'draft'::invoice_status, \
          $5, $6, 0, $7, 0, $8, $9, $10, $11, $12, \
          false, $13, $14, $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&new_number)
    .bind(original.patient_id)
    .bind(original.encounter_id)
    .bind(original.subtotal)
    .bind(original.tax_amount)
    .bind(original.total_amount)
    .bind(
        original
            .notes
            .as_deref()
            .map(|n| format!("Cloned from {}: {n}", original.invoice_number)),
    )
    .bind(original.cgst_amount)
    .bind(original.sgst_amount)
    .bind(original.igst_amount)
    .bind(original.cess_amount)
    .bind(original.corporate_id)
    .bind(&original.place_of_supply)
    .bind(id)
    .bind(original.is_er_deferred)
    .fetch_one(&mut *tx)
    .await?;

    // Deep-copy line items
    let items = sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    for item in &items {
        sqlx::query(
            "INSERT INTO invoice_items \
             (tenant_id, invoice_id, charge_code, description, source, source_id, \
              quantity, unit_price, tax_percent, total_price, gst_rate, gst_type, \
              cgst_amount, sgst_amount, igst_amount, hsn_sac_code, \
              ordering_doctor_id, department_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, \
              $13, $14, $15, $16, $17, $18)",
        )
        .bind(claims.tenant_id)
        .bind(cloned.id)
        .bind(&item.charge_code)
        .bind(&item.description)
        .bind(item.source)
        .bind(item.source_id)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(item.tax_percent)
        .bind(item.total_price)
        .bind(item.gst_rate)
        .bind(item.gst_type)
        .bind(item.cgst_amount)
        .bind(item.sgst_amount)
        .bind(item.igst_amount)
        .bind(&item.hsn_sac_code)
        .bind(item.ordering_doctor_id)
        .bind(item.department_id)
        .execute(&mut *tx)
        .await?;
    }

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::InvoiceCloned,
        "invoice",
        cloned.id,
        Some(cloned.id),
        Some(cloned.patient_id),
        Some(cloned.total_amount),
        Some(serde_json::json!({ "cloned_from": id })),
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(cloned))
}

// ══════════════════════════════════════════════════════════
//  Billing Audit Log
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAuditLogQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub entity_type: Option<String>,
    pub invoice_id: Option<Uuid>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct AuditLogResponse {
    pub entries: Vec<BillingAuditEntry>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

pub async fn list_audit_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAuditLogQuery>,
) -> Result<Json<AuditLogResponse>, AppError> {
    require_permission(&claims, permissions::billing::audit::VIEW)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Build dynamic WHERE
    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut param_idx: usize = 2;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
        date_val: Option<NaiveDate>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref et) = params.entity_type {
        conditions.push(format!("entity_type = ${param_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(et.clone()),
            date_val: None,
        });
        param_idx += 1;
    }
    if let Some(inv_id) = params.invoice_id {
        conditions.push(format!("invoice_id = ${param_idx}"));
        binds.push(Bind {
            uuid_val: Some(inv_id),
            string_val: None,
            date_val: None,
        });
        param_idx += 1;
    }
    if let Some(from) = params.from {
        conditions.push(format!("created_at::date >= ${param_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: None,
            date_val: Some(from),
        });
        param_idx += 1;
    }
    if let Some(to) = params.to {
        conditions.push(format!("created_at::date <= ${param_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: None,
            date_val: Some(to),
        });
        param_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM billing_audit_log WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            cq = cq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            cq = cq.bind(s.clone());
        }
        if let Some(d) = b.date_val {
            cq = cq.bind(d);
        }
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM billing_audit_log WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${param_idx} OFFSET ${}",
        param_idx + 1
    );
    let mut dq = sqlx::query_as::<_, BillingAuditEntry>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            dq = dq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            dq = dq.bind(s.clone());
        }
        if let Some(d) = b.date_val {
            dq = dq.bind(d);
        }
    }
    let entries = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(AuditLogResponse {
        entries,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  Doctor Revenue Report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorRevenueRow {
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub total_revenue: Decimal,
    pub item_count: i64,
}

pub async fn report_doctor_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<Vec<DoctorRevenueRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DoctorRevenueRow>(
        "SELECT ii.ordering_doctor_id AS doctor_id, \
         u.full_name AS doctor_name, \
         COALESCE(SUM(ii.total_price), 0) AS total_revenue, \
         COUNT(*) AS item_count \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         LEFT JOIN users u ON u.id = ii.ordering_doctor_id \
         WHERE ii.tenant_id = $1 \
           AND i.issued_at >= $2::date AND i.issued_at < ($3::date + 1) \
           AND i.status NOT IN ('draft'::invoice_status, 'cancelled'::invoice_status) \
         GROUP BY ii.ordering_doctor_id, u.full_name \
         ORDER BY total_revenue DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Insurance Panel Summary
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InsurancePanelRow {
    pub insurance_provider: String,
    pub total_claims: i64,
    pub total_claimed: Decimal,
    pub total_approved: Decimal,
    pub total_settled: Decimal,
    pub pending_count: i64,
}

pub async fn report_insurance_panel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<InsurancePanelRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InsurancePanelRow>(
        "SELECT insurance_provider, \
         COUNT(*) AS total_claims, \
         COALESCE(SUM(pre_auth_amount), 0) AS total_claimed, \
         COALESCE(SUM(approved_amount), 0) AS total_approved, \
         COALESCE(SUM(settled_amount), 0) AS total_settled, \
         COUNT(*) FILTER (WHERE status NOT IN ('settled', 'partially_settled', 'claim_rejected')) AS pending_count \
         FROM insurance_claims WHERE tenant_id = $1 \
         GROUP BY insurance_provider ORDER BY total_claims DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Reconciliation Report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct ReconciliationReport {
    pub date: NaiveDate,
    pub system_cash: Decimal,
    pub system_card: Decimal,
    pub system_upi: Decimal,
    pub system_total: Decimal,
    pub day_close: Option<DayEndClose>,
    pub variance: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct ReconciliationQuery {
    pub date: NaiveDate,
}

pub async fn report_reconciliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReconciliationQuery>,
) -> Result<Json<ReconciliationReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // System computed totals
    let mode_totals = sqlx::query_as::<_, PaymentModeTotal>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt \
         FROM payments WHERE tenant_id = $1 AND paid_at::date = $2 GROUP BY mode",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_all(&mut *tx)
    .await?;

    let mut system_cash = Decimal::ZERO;
    let mut system_card = Decimal::ZERO;
    let mut system_upi = Decimal::ZERO;
    let mut system_total = Decimal::ZERO;

    for mt in &mode_totals {
        system_total += mt.total;
        match mt.mode.as_str() {
            "cash" => system_cash = mt.total,
            "card" => system_card = mt.total,
            "upi" => system_upi = mt.total,
            _ => {}
        }
    }

    let day_close = sqlx::query_as::<_, DayEndClose>(
        "SELECT * FROM day_end_closes \
         WHERE tenant_id = $1 AND close_date = $2 LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_optional(&mut *tx)
    .await?;

    let variance = day_close
        .as_ref()
        .map_or(Decimal::ZERO, |dc| dc.actual_cash - system_cash);

    tx.commit().await?;

    Ok(Json(ReconciliationReport {
        date: params.date,
        system_cash,
        system_card,
        system_upi,
        system_total,
        day_close,
        variance,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Exchange Rates
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ExchangeRateQuery {
    pub from_currency: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn list_exchange_rates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ExchangeRateQuery>,
) -> Result<Json<Vec<ExchangeRate>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ExchangeRate>(
        "SELECT * FROM exchange_rates WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR from_currency::text = $2) \
         AND ($3::date IS NULL OR effective_date >= $3) \
         AND ($4::date IS NULL OR effective_date <= $4) \
         ORDER BY effective_date DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(params.from_currency.as_deref())
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateExchangeRateRequest {
    pub from_currency: CurrencyCode,
    pub to_currency: Option<CurrencyCode>,
    pub rate: Decimal,
    pub effective_date: NaiveDate,
    pub source: Option<String>,
}

pub async fn create_exchange_rate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateExchangeRateRequest>,
) -> Result<Json<ExchangeRate>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let to_cur = body.to_currency.unwrap_or(CurrencyCode::Inr);

    let row = sqlx::query_as::<_, ExchangeRate>(
        "INSERT INTO exchange_rates \
         (tenant_id, from_currency, to_currency, rate, effective_date, source) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.from_currency)
    .bind(to_cur)
    .bind(body.rate)
    .bind(body.effective_date)
    .bind(body.source.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Invoice Print Data (GST Breakup)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct InvoicePrintData {
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
    pub payments: Vec<Payment>,
    pub hospital_gstin: Option<String>,
    pub hospital_name: Option<String>,
    pub hospital_address: Option<String>,
    pub patient_name: Option<String>,
    pub patient_address: Option<String>,
    pub hsn_summary: Vec<HsnSummaryRow>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HsnSummaryRow {
    pub hsn_code: String,
    pub taxable_amount: Decimal,
    pub cgst_amount: Decimal,
    pub sgst_amount: Decimal,
    pub igst_amount: Decimal,
    pub total_tax: Decimal,
    pub item_count: i64,
}

pub async fn get_invoice_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<InvoicePrintData>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let items = sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY paid_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Hospital info from tenant_settings
    let hospital_gstin = sqlx::query_scalar::<_, Option<String>>(
        "SELECT value->>'gstin' FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'hospital_gst'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    let hospital_name =
        sqlx::query_scalar::<_, Option<String>>("SELECT name FROM tenants WHERE id = $1")
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();

    let patient_name = sqlx::query_scalar::<_, Option<String>>(
        "SELECT CONCAT(first_name, ' ', last_name) FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    // HSN summary grouped
    let hsn_summary = sqlx::query_as::<_, HsnSummaryRow>(
        "SELECT COALESCE(hsn_sac_code, 'N/A') AS hsn_code, \
         COALESCE(SUM(unit_price * quantity), 0) AS taxable_amount, \
         COALESCE(SUM(cgst_amount), 0) AS cgst_amount, \
         COALESCE(SUM(sgst_amount), 0) AS sgst_amount, \
         COALESCE(SUM(igst_amount), 0) AS igst_amount, \
         COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total_tax, \
         COUNT(*) AS item_count \
         FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 \
         GROUP BY hsn_sac_code ORDER BY hsn_code",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(InvoicePrintData {
        invoice,
        items,
        payments,
        hospital_gstin,
        hospital_name,
        hospital_address: None,
        patient_name,
        patient_address: None,
        hsn_summary,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Billing Threshold Check
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct BillingThresholdStatus {
    pub encounter_id: Uuid,
    pub current_total: Decimal,
    pub threshold: Option<Decimal>,
    pub exceeded: bool,
    pub percentage_used: Option<Decimal>,
}

pub async fn check_billing_threshold(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<BillingThresholdStatus>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let current_total = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM invoices \
         WHERE encounter_id = $1 AND tenant_id = $2 AND status != 'cancelled'",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get threshold from ip_type_configurations via admission
    let threshold = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT itc.billing_alert_threshold \
         FROM ip_admissions a \
         JOIN ip_type_configurations itc ON itc.ip_type = a.admission_type AND itc.tenant_id = a.tenant_id \
         WHERE a.encounter_id = $1 AND a.tenant_id = $2 \
         LIMIT 1",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    let exceeded = threshold.is_some_and(|t| t > Decimal::ZERO && current_total >= t);
    let percentage_used = threshold.and_then(|t| {
        if t > Decimal::ZERO {
            Some(current_total * Decimal::from(100) / t)
        } else {
            None
        }
    });

    tx.commit().await?;

    Ok(Json(BillingThresholdStatus {
        encounter_id,
        current_total,
        threshold,
        exceeded,
        percentage_used,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Scheme Rate Lookup
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SchemeRateQuery {
    pub scheme_type: String,
    pub charge_code: String,
}

#[derive(Debug, Serialize)]
pub struct SchemeRateResult {
    pub charge_code: String,
    pub scheme_type: String,
    pub override_price: Option<Decimal>,
    pub tpa_name: Option<String>,
    pub rate_plan_name: Option<String>,
}

pub async fn get_scheme_rate_for_charge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SchemeRateQuery>,
) -> Result<Json<SchemeRateResult>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(Debug, sqlx::FromRow)]
    struct RateRow {
        tpa_name: String,
        rate_plan_name: String,
        override_price: Decimal,
    }

    let rate = sqlx::query_as::<_, RateRow>(
        "SELECT t.tpa_name, rp.name AS rate_plan_name, rpi.override_price \
         FROM tpa_rate_cards t \
         JOIN rate_plans rp ON rp.id = t.rate_plan_id AND rp.tenant_id = t.tenant_id \
         JOIN rate_plan_items rpi ON rpi.rate_plan_id = rp.id AND rpi.tenant_id = rp.tenant_id \
         WHERE t.tenant_id = $1 AND t.scheme_type::text = $2 AND rpi.charge_code = $3 \
           AND t.is_active = true AND rp.is_active = true \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(&params.scheme_type)
    .bind(&params.charge_code)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(SchemeRateResult {
        charge_code: params.charge_code,
        scheme_type: params.scheme_type,
        override_price: rate.as_ref().map(|r| r.override_price),
        tpa_name: rate.as_ref().map(|r| r.tpa_name.clone()),
        rate_plan_name: rate.map(|r| r.rate_plan_name),
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Credit Patients
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreditPatientQuery {
    pub status: Option<String>,
}

pub async fn list_credit_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<CreditPatientQuery>,
) -> Result<Json<Vec<CreditPatient>>, AppError> {
    require_permission(&claims, permissions::billing::credit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CreditPatient>(
        "SELECT * FROM credit_patients WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY updated_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateCreditPatientRequest {
    pub patient_id: Uuid,
    pub credit_limit: Decimal,
    pub reason: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_credit_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditPatientRequest>,
) -> Result<Json<CreditPatient>, AppError> {
    require_permission(&claims, permissions::billing::credit::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CreditPatient>(
        "INSERT INTO credit_patients \
         (tenant_id, patient_id, credit_limit, status, approved_by, reason, notes) \
         VALUES ($1, $2, $3, 'active', $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.credit_limit)
    .bind(claims.sub)
    .bind(body.reason.as_deref())
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateCreditPatientRequest {
    pub credit_limit: Option<Decimal>,
    pub status: Option<CreditPatientStatus>,
    pub notes: Option<String>,
}

pub async fn update_credit_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCreditPatientRequest>,
) -> Result<Json<CreditPatient>, AppError> {
    require_permission(&claims, permissions::billing::credit::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CreditPatient>(
        "UPDATE credit_patients SET \
         credit_limit = COALESCE($3, credit_limit), \
         status = COALESCE($4, status), \
         notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.credit_limit)
    .bind(body.status)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CreditAgingRow {
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub credit_limit: Decimal,
    pub current_balance: Decimal,
    pub status: CreditPatientStatus,
    pub overdue_since: Option<chrono::DateTime<chrono::Utc>>,
    pub days_overdue: Option<i32>,
}

pub async fn report_credit_aging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CreditAgingRow>>, AppError> {
    require_permission(&claims, permissions::billing::credit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CreditAgingRow>(
        "SELECT cp.patient_id, \
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name, \
         cp.credit_limit, cp.current_balance, cp.status, cp.overdue_since, \
         CASE WHEN cp.overdue_since IS NOT NULL \
           THEN EXTRACT(DAY FROM now() - cp.overdue_since)::int \
           ELSE NULL END AS days_overdue \
         FROM credit_patients cp \
         JOIN patients p ON p.id = cp.patient_id AND p.tenant_id = cp.tenant_id \
         WHERE cp.tenant_id = $1 AND cp.current_balance > 0 \
         ORDER BY cp.current_balance DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Dual Insurance / Reimbursement
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct DualInsuranceResult {
    pub primary_claim: Option<InsuranceClaim>,
    pub secondary_claim: Option<InsuranceClaim>,
    pub patient_responsibility: Decimal,
    pub coordination_notes: String,
}

pub async fn coordinate_dual_insurance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<DualInsuranceResult>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    // Get primary insurance
    let primary = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims \
         WHERE invoice_id = $1 AND tenant_id = $2 AND is_secondary = false \
         ORDER BY created_at LIMIT 1",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let primary_settled = primary
        .as_ref()
        .and_then(|p| p.approved_amount)
        .unwrap_or(Decimal::ZERO);

    let remaining = invoice.total_amount - primary_settled;
    let patient_responsibility;
    let mut secondary_claim: Option<InsuranceClaim> = None;
    let coordination_notes;

    if remaining > Decimal::ZERO {
        // Check for secondary insurance on patient
        let secondary_ins = sqlx::query_scalar::<_, Option<String>>(
            "SELECT provider_name FROM patient_insurance \
             WHERE patient_id = $1 AND tenant_id = $2 AND priority = 2 AND is_active = true \
             LIMIT 1",
        )
        .bind(invoice.patient_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

        if let Some(provider) = secondary_ins {
            // Create secondary claim for the remainder
            let claim = sqlx::query_as::<_, InsuranceClaim>(
                "INSERT INTO insurance_claims \
                 (tenant_id, invoice_id, patient_id, insurance_provider, \
                  claim_type, status, is_secondary, primary_claim_id, \
                  claim_amount, coordination_of_benefits, created_by, scheme_type) \
                 VALUES ($1, $2, $3, $4, 'cashless', 'submitted', true, $5, $6, \
                  'Secondary payer for remaining balance after primary', $7, 'private') \
                 RETURNING *",
            )
            .bind(claims.tenant_id)
            .bind(invoice_id)
            .bind(invoice.patient_id)
            .bind(&provider)
            .bind(primary.as_ref().map(|p| p.id))
            .bind(remaining)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;

            secondary_claim = Some(claim);
            patient_responsibility = Decimal::ZERO;
            coordination_notes = format!(
                "Primary: {primary_settled}, Secondary claim: {remaining}, \
                 Patient: 0",
            );
        } else {
            patient_responsibility = remaining;
            coordination_notes = format!(
                "Primary: {primary_settled}, No secondary insurance. \
                 Patient: {remaining}",
            );
        }
    } else {
        patient_responsibility = Decimal::ZERO;
        coordination_notes = format!("Primary covers full amount: {primary_settled}");
    }

    tx.commit().await?;

    Ok(Json(DualInsuranceResult {
        primary_claim: primary,
        secondary_claim,
        patient_responsibility,
        coordination_notes,
    }))
}

pub async fn get_dual_insurance_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<DualInsuranceResult>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let primary = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims \
         WHERE invoice_id = $1 AND tenant_id = $2 AND is_secondary = false \
         ORDER BY created_at LIMIT 1",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let secondary = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims \
         WHERE invoice_id = $1 AND tenant_id = $2 AND is_secondary = true \
         ORDER BY created_at LIMIT 1",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let settled = primary
        .as_ref()
        .and_then(|p| p.settled_amount)
        .unwrap_or(Decimal::ZERO)
        + secondary
            .as_ref()
            .and_then(|s| s.settled_amount)
            .unwrap_or(Decimal::ZERO);
    let patient_responsibility = (invoice.total_amount - settled).max(Decimal::ZERO);

    tx.commit().await?;

    Ok(Json(DualInsuranceResult {
        primary_claim: primary,
        secondary_claim: secondary,
        patient_responsibility,
        coordination_notes: String::new(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct ReimbursementDocsRequest {
    pub documents: serde_json::Value,
}

pub async fn generate_reimbursement_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
    Json(body): Json<ReimbursementDocsRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InsuranceClaim>(
        "UPDATE insurance_claims SET reimbursement_docs = $3 \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .bind(&body.documents)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_reimbursement_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
    Json(body): Json<ReimbursementDocsRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InsuranceClaim>(
        "UPDATE insurance_claims SET reimbursement_docs = $3 \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .bind(&body.documents)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — GL Accounts (Chart of Accounts)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct GlAccountQuery {
    pub account_type: Option<String>,
}

pub async fn list_gl_accounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<GlAccountQuery>,
) -> Result<Json<Vec<GlAccount>>, AppError> {
    require_permission(&claims, permissions::billing::journal::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, GlAccount>(
        "SELECT * FROM gl_accounts WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR account_type = $2) \
         ORDER BY code",
    )
    .bind(claims.tenant_id)
    .bind(params.account_type.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateGlAccountRequest {
    pub code: String,
    pub name: String,
    pub account_type: String,
    pub parent_id: Option<Uuid>,
    pub description: Option<String>,
}

pub async fn create_gl_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGlAccountRequest>,
) -> Result<Json<GlAccount>, AppError> {
    require_permission(&claims, permissions::billing::journal::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, GlAccount>(
        "INSERT INTO gl_accounts \
         (tenant_id, code, name, account_type, parent_id, description) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.account_type)
    .bind(body.parent_id)
    .bind(body.description.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateGlAccountRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

pub async fn update_gl_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateGlAccountRequest>,
) -> Result<Json<GlAccount>, AppError> {
    require_permission(&claims, permissions::billing::journal::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, GlAccount>(
        "UPDATE gl_accounts SET \
         name = COALESCE($3, name), \
         description = COALESCE($4, description), \
         is_active = COALESCE($5, is_active) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.as_deref())
    .bind(body.description.as_deref())
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Journal Entries (Double-Entry Accounting)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct JournalEntryQuery {
    pub status: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn list_journal_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<JournalEntryQuery>,
) -> Result<Json<Vec<JournalEntry>>, AppError> {
    require_permission(&claims, permissions::billing::journal::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         AND ($3::date IS NULL OR entry_date >= $3) \
         AND ($4::date IS NULL OR entry_date <= $4) \
         ORDER BY entry_date DESC, created_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(params.status.as_deref())
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct JournalEntryDetail {
    pub entry: JournalEntry,
    pub lines: Vec<JournalEntryLine>,
}

pub async fn get_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntryDetail>, AppError> {
    require_permission(&claims, permissions::billing::journal::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines \
         WHERE journal_entry_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(JournalEntryDetail { entry, lines }))
}

#[derive(Debug, Deserialize)]
pub struct JournalLineInput {
    pub account_id: Uuid,
    pub department_id: Option<Uuid>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub narration: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJournalEntryRequest {
    pub entry_date: NaiveDate,
    pub description: Option<String>,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub lines: Vec<JournalLineInput>,
}

pub async fn create_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateJournalEntryRequest>,
) -> Result<Json<JournalEntryDetail>, AppError> {
    require_permission(&claims, permissions::billing::journal::CREATE)?;

    if body.lines.is_empty() {
        return Err(AppError::BadRequest(
            "Journal entry must have at least one line".to_owned(),
        ));
    }

    let total_debit: Decimal = body.lines.iter().map(|l| l.debit_amount).sum();
    let total_credit: Decimal = body.lines.iter().map(|l| l.credit_amount).sum();

    if total_debit != total_credit {
        return Err(AppError::BadRequest(format!(
            "Debits ({total_debit}) must equal credits ({total_credit})"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry_number = generate_je_number(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, JournalEntry>(
        "INSERT INTO journal_entries \
         (tenant_id, entry_number, entry_date, entry_type, status, \
          total_debit, total_credit, description, reference_type, reference_id, created_by) \
         VALUES ($1, $2, $3, 'manual', 'draft', $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&entry_number)
    .bind(body.entry_date)
    .bind(total_debit)
    .bind(total_credit)
    .bind(body.description.as_deref())
    .bind(body.reference_type.as_deref())
    .bind(body.reference_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let mut lines = Vec::with_capacity(body.lines.len());
    for line in &body.lines {
        let l = sqlx::query_as::<_, JournalEntryLine>(
            "INSERT INTO journal_entry_lines \
             (tenant_id, journal_entry_id, account_id, department_id, \
              debit_amount, credit_amount, narration) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(entry.id)
        .bind(line.account_id)
        .bind(line.department_id)
        .bind(line.debit_amount)
        .bind(line.credit_amount)
        .bind(line.narration.as_deref())
        .fetch_one(&mut *tx)
        .await?;
        lines.push(l);
    }

    tx.commit().await?;
    Ok(Json(JournalEntryDetail { entry, lines }))
}

async fn generate_je_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'JOURNAL_ENTRY' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let seq =
        seq.ok_or_else(|| AppError::Internal("JOURNAL_ENTRY sequence not configured".to_owned()))?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

pub async fn post_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntry>, AppError> {
    require_permission(&claims, permissions::billing::journal::POST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, JournalEntry>(
        "UPDATE journal_entries SET \
         status = 'posted', posted_by = $3, posted_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Audit log
    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::JournalEntryPosted,
        "journal_entry",
        entry.id,
        None,
        None,
        Some(entry.total_debit),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(entry))
}

pub async fn reverse_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntryDetail>, AppError> {
    require_permission(&claims, permissions::billing::journal::POST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Mark original as reversed
    sqlx::query(
        "UPDATE journal_entries SET status = 'reversed' \
         WHERE id = $1 AND tenant_id = $2 AND status = 'posted'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Get original lines
    let original_lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines \
         WHERE journal_entry_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total_debit: Decimal = original_lines.iter().map(|l| l.credit_amount).sum();
    let total_credit: Decimal = original_lines.iter().map(|l| l.debit_amount).sum();

    let entry_number = generate_je_number(&mut tx, &claims.tenant_id).await?;

    // Create reversal entry (swap debits/credits)
    let reversal = sqlx::query_as::<_, JournalEntry>(
        "INSERT INTO journal_entries \
         (tenant_id, entry_number, entry_date, entry_type, status, \
          total_debit, total_credit, description, reversal_of_id, \
          posted_by, posted_at, created_by) \
         VALUES ($1, $2, CURRENT_DATE, 'manual', 'posted', $3, $4, \
          $5, $6, $7, now(), $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&entry_number)
    .bind(total_debit)
    .bind(total_credit)
    .bind(format!("Reversal of JE {id}"))
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let mut rev_lines = Vec::with_capacity(original_lines.len());
    for line in &original_lines {
        let l = sqlx::query_as::<_, JournalEntryLine>(
            "INSERT INTO journal_entry_lines \
             (tenant_id, journal_entry_id, account_id, department_id, \
              debit_amount, credit_amount, narration) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(reversal.id)
        .bind(line.account_id)
        .bind(line.department_id)
        .bind(line.credit_amount) // swap
        .bind(line.debit_amount) // swap
        .bind(line.narration.as_deref())
        .fetch_one(&mut *tx)
        .await?;
        rev_lines.push(l);
    }

    tx.commit().await?;
    Ok(Json(JournalEntryDetail {
        entry: reversal,
        lines: rev_lines,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Bank Reconciliation
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct BankTransactionQuery {
    pub recon_status: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn list_bank_transactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<BankTransactionQuery>,
) -> Result<Json<Vec<BankTransaction>>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BankTransaction>(
        "SELECT * FROM bank_transactions WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR recon_status::text = $2) \
         AND ($3::date IS NULL OR transaction_date >= $3) \
         AND ($4::date IS NULL OR transaction_date <= $4) \
         ORDER BY transaction_date DESC LIMIT 1000",
    )
    .bind(claims.tenant_id)
    .bind(params.recon_status.as_deref())
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ImportBankTransactionRow {
    pub bank_name: String,
    pub account_number: String,
    pub transaction_date: NaiveDate,
    pub value_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub running_balance: Option<Decimal>,
    pub reference_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImportBankTransactionsRequest {
    pub transactions: Vec<ImportBankTransactionRow>,
    pub import_batch: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportBankTransactionsResponse {
    pub imported: i32,
    pub import_batch: String,
}

pub async fn import_bank_transactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ImportBankTransactionsRequest>,
) -> Result<Json<ImportBankTransactionsResponse>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batch = body
        .import_batch
        .unwrap_or_else(|| format!("IMPORT-{}", chrono::Utc::now().format("%Y%m%d%H%M%S")));

    let mut count = 0i32;
    for row in &body.transactions {
        sqlx::query(
            "INSERT INTO bank_transactions \
             (tenant_id, bank_name, account_number, transaction_date, value_date, \
              description, debit_amount, credit_amount, running_balance, \
              reference_number, import_batch) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(claims.tenant_id)
        .bind(&row.bank_name)
        .bind(&row.account_number)
        .bind(row.transaction_date)
        .bind(row.value_date)
        .bind(row.description.as_deref())
        .bind(row.debit_amount)
        .bind(row.credit_amount)
        .bind(row.running_balance)
        .bind(row.reference_number.as_deref())
        .bind(&batch)
        .execute(&mut *tx)
        .await?;
        count += 1;
    }

    tx.commit().await?;
    Ok(Json(ImportBankTransactionsResponse {
        imported: count,
        import_batch: batch,
    }))
}

#[derive(Debug, Deserialize)]
pub struct MatchBankTransactionRequest {
    pub payment_id: Option<Uuid>,
    pub refund_id: Option<Uuid>,
    pub notes: Option<String>,
}

pub async fn match_bank_transaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<MatchBankTransactionRequest>,
) -> Result<Json<BankTransaction>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BankTransaction>(
        "UPDATE bank_transactions SET \
         recon_status = 'matched', \
         matched_payment_id = COALESCE($3, matched_payment_id), \
         matched_refund_id = COALESCE($4, matched_refund_id), \
         matched_by = $5, matched_at = now(), \
         notes = COALESCE($6, notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.payment_id)
    .bind(body.refund_id)
    .bind(claims.sub)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize)]
pub struct AutoReconcileResponse {
    pub matched_count: i32,
    pub unmatched_count: i64,
}

pub async fn auto_reconcile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoReconcileResponse>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Match bank credits to payments by amount + date ± 1 day + reference_number
    let matched = sqlx::query_scalar::<_, i64>(
        "WITH matches AS ( \
           SELECT bt.id AS bt_id, p.id AS pay_id \
           FROM bank_transactions bt \
           JOIN payments p ON p.tenant_id = bt.tenant_id \
             AND p.amount = bt.credit_amount \
             AND ABS(EXTRACT(DAY FROM p.paid_at - bt.transaction_date::timestamp)) <= 1 \
             AND (bt.reference_number IS NULL OR p.reference_number = bt.reference_number) \
           WHERE bt.tenant_id = $1 AND bt.recon_status = 'unmatched' \
             AND bt.credit_amount > 0 \
             AND p.id NOT IN (SELECT matched_payment_id FROM bank_transactions \
                              WHERE matched_payment_id IS NOT NULL AND tenant_id = $1) \
         ) \
         UPDATE bank_transactions SET \
           recon_status = 'matched', matched_payment_id = m.pay_id, \
           matched_by = $2, matched_at = now() \
         FROM matches m WHERE bank_transactions.id = m.bt_id \
         RETURNING bank_transactions.id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?
    .len() as i64;

    let unmatched = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM bank_transactions \
         WHERE tenant_id = $1 AND recon_status = 'unmatched'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AutoReconcileResponse {
        matched_count: i32::try_from(matched).unwrap_or(0),
        unmatched_count: unmatched,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — TDS Management
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct TdsQuery {
    pub financial_year: Option<String>,
    pub quarter: Option<String>,
    pub status: Option<String>,
}

pub async fn list_tds_deductions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TdsQuery>,
) -> Result<Json<Vec<TdsDeduction>>, AppError> {
    require_permission(&claims, permissions::billing::tds::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TdsDeduction>(
        "SELECT * FROM tds_deductions WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR financial_year = $2) \
         AND ($3::text IS NULL OR quarter = $3) \
         AND ($4::text IS NULL OR status::text = $4) \
         ORDER BY deducted_date DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.financial_year.as_deref())
    .bind(params.quarter.as_deref())
    .bind(params.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateTdsRequest {
    pub invoice_id: Option<Uuid>,
    pub deductee_name: String,
    pub deductee_pan: String,
    pub tds_section: String,
    pub tds_rate: Decimal,
    pub base_amount: Decimal,
    pub deducted_date: NaiveDate,
    pub financial_year: String,
    pub quarter: String,
}

pub async fn create_tds_deduction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTdsRequest>,
) -> Result<Json<TdsDeduction>, AppError> {
    require_permission(&claims, permissions::billing::tds::MANAGE)?;

    let tds_amount = body.base_amount * body.tds_rate / Decimal::from(100);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TdsDeduction>(
        "INSERT INTO tds_deductions \
         (tenant_id, invoice_id, deductee_name, deductee_pan, tds_section, \
          tds_rate, base_amount, tds_amount, deducted_date, financial_year, quarter, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(&body.deductee_name)
    .bind(&body.deductee_pan)
    .bind(&body.tds_section)
    .bind(body.tds_rate)
    .bind(body.base_amount)
    .bind(tds_amount)
    .bind(body.deducted_date)
    .bind(&body.financial_year)
    .bind(&body.quarter)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct DepositTdsRequest {
    pub challan_number: String,
    pub challan_date: NaiveDate,
}

pub async fn deposit_tds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DepositTdsRequest>,
) -> Result<Json<TdsDeduction>, AppError> {
    require_permission(&claims, permissions::billing::tds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TdsDeduction>(
        "UPDATE tds_deductions SET \
         status = 'deposited', challan_number = $3, challan_date = $4 \
         WHERE id = $1 AND tenant_id = $2 AND status = 'deducted' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.challan_number)
    .bind(body.challan_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct IssueTdsCertRequest {
    pub certificate_number: String,
    pub certificate_date: NaiveDate,
}

pub async fn issue_tds_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IssueTdsCertRequest>,
) -> Result<Json<TdsDeduction>, AppError> {
    require_permission(&claims, permissions::billing::tds::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TdsDeduction>(
        "UPDATE tds_deductions SET \
         status = 'certificate_issued', \
         certificate_number = $3, certificate_date = $4 \
         WHERE id = $1 AND tenant_id = $2 AND status = 'deposited' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.certificate_number)
    .bind(body.certificate_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — GST Return Summaries
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct GenerateGstrRequest {
    pub return_type: String,
    pub period: String,
}

pub async fn generate_gstr_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateGstrRequest>,
) -> Result<Json<GstReturnSummary>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Aggregate from invoices for the period (YYYY-MM format)
    let totals = sqlx::query_as::<_, GstTotals>(
        "SELECT \
         COALESCE(SUM(subtotal), 0) AS total_taxable, \
         COALESCE(SUM(cgst_amount), 0) AS total_cgst, \
         COALESCE(SUM(sgst_amount), 0) AS total_sgst, \
         COALESCE(SUM(igst_amount), 0) AS total_igst, \
         COALESCE(SUM(cess_amount), 0) AS total_cess, \
         COALESCE(SUM(tax_amount), 0) AS total_tax, \
         COUNT(*)::int AS invoice_count \
         FROM invoices WHERE tenant_id = $1 \
         AND status IN ('issued', 'partially_paid', 'paid') \
         AND TO_CHAR(issued_at, 'YYYY-MM') = $2",
    )
    .bind(claims.tenant_id)
    .bind(&body.period)
    .fetch_one(&mut *tx)
    .await?;

    // HSN summary as JSONB
    let hsn = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(row_to_json(h)), '[]'::json)::jsonb FROM ( \
           SELECT COALESCE(ii.hsn_sac_code, 'N/A') AS hsn_code, \
           SUM(ii.unit_price * ii.quantity) AS taxable, \
           SUM(ii.cgst_amount) AS cgst, SUM(ii.sgst_amount) AS sgst, \
           SUM(ii.igst_amount) AS igst, COUNT(*) AS items \
           FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
           WHERE ii.tenant_id = $1 \
           AND i.status IN ('issued', 'partially_paid', 'paid') \
           AND TO_CHAR(i.issued_at, 'YYYY-MM') = $2 \
           GROUP BY ii.hsn_sac_code \
         ) h",
    )
    .bind(claims.tenant_id)
    .bind(&body.period)
    .fetch_one(&mut *tx)
    .await?;

    // Upsert summary
    let row = sqlx::query_as::<_, GstReturnSummary>(
        "INSERT INTO gst_return_summaries \
         (tenant_id, return_type, period, total_taxable, total_cgst, total_sgst, \
          total_igst, total_cess, total_tax, hsn_summary, invoice_count) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         ON CONFLICT (tenant_id, return_type, period) DO UPDATE SET \
         total_taxable = EXCLUDED.total_taxable, \
         total_cgst = EXCLUDED.total_cgst, \
         total_sgst = EXCLUDED.total_sgst, \
         total_igst = EXCLUDED.total_igst, \
         total_cess = EXCLUDED.total_cess, \
         total_tax = EXCLUDED.total_tax, \
         hsn_summary = EXCLUDED.hsn_summary, \
         invoice_count = EXCLUDED.invoice_count, \
         filing_status = 'draft' \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.return_type)
    .bind(&body.period)
    .bind(totals.total_taxable)
    .bind(totals.total_cgst)
    .bind(totals.total_sgst)
    .bind(totals.total_igst)
    .bind(totals.total_cess)
    .bind(totals.total_tax)
    .bind(&hsn)
    .bind(totals.invoice_count)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, sqlx::FromRow)]
struct GstTotals {
    total_taxable: Decimal,
    total_cgst: Decimal,
    total_sgst: Decimal,
    total_igst: Decimal,
    total_cess: Decimal,
    total_tax: Decimal,
    invoice_count: i32,
}

pub async fn list_gstr_summaries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<GstReturnSummary>>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, GstReturnSummary>(
        "SELECT * FROM gst_return_summaries WHERE tenant_id = $1 \
         ORDER BY period DESC, return_type",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn file_gstr(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GstReturnSummary>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, GstReturnSummary>(
        "UPDATE gst_return_summaries SET \
         filing_status = 'filed', filed_by = $3, filed_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND filing_status IN ('draft', 'validated') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — HSN Summary Report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct HsnReportQuery {
    pub period: String,
}

pub async fn report_hsn_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<HsnReportQuery>,
) -> Result<Json<Vec<HsnSummaryRow>>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, HsnSummaryRow>(
        "SELECT COALESCE(ii.hsn_sac_code, 'N/A') AS hsn_code, \
         COALESCE(SUM(ii.unit_price * ii.quantity), 0) AS taxable_amount, \
         COALESCE(SUM(ii.cgst_amount), 0) AS cgst_amount, \
         COALESCE(SUM(ii.sgst_amount), 0) AS sgst_amount, \
         COALESCE(SUM(ii.igst_amount), 0) AS igst_amount, \
         COALESCE(SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount), 0) AS total_tax, \
         COUNT(*) AS item_count \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         WHERE ii.tenant_id = $1 \
         AND i.status IN ('issued', 'partially_paid', 'paid') \
         AND TO_CHAR(i.issued_at, 'YYYY-MM') = $2 \
         GROUP BY ii.hsn_sac_code ORDER BY hsn_code",
    )
    .bind(claims.tenant_id)
    .bind(&params.period)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Financial MIS & P&L
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct FinancialReportQuery {
    pub date_from: NaiveDate,
    pub date_to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct FinancialMisReport {
    pub total_revenue: Decimal,
    pub total_collections: Decimal,
    pub total_outstanding: Decimal,
    pub total_refunds: Decimal,
    pub total_write_offs: Decimal,
    pub total_advances: Decimal,
    pub collection_rate: Decimal,
    pub period_from: NaiveDate,
    pub period_to: NaiveDate,
}

pub async fn report_financial_mis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<FinancialReportQuery>,
) -> Result<Json<FinancialMisReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let revenue = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM invoices \
         WHERE tenant_id = $1 AND status != 'cancelled' \
         AND issued_at::date >= $2 AND issued_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let collections = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM payments \
         WHERE tenant_id = $1 AND paid_at::date >= $2 AND paid_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let refunds = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM refunds \
         WHERE tenant_id = $1 AND refunded_at::date >= $2 AND refunded_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let write_offs = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM bad_debt_write_offs \
         WHERE tenant_id = $1 AND status = 'approved' \
         AND created_at::date >= $2 AND created_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let advances = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM patient_advances \
         WHERE tenant_id = $1 AND created_at::date >= $2 AND created_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let outstanding = revenue - collections;
    let collection_rate = if revenue > Decimal::ZERO {
        collections * Decimal::from(100) / revenue
    } else {
        Decimal::ZERO
    };

    tx.commit().await?;

    Ok(Json(FinancialMisReport {
        total_revenue: revenue,
        total_collections: collections,
        total_outstanding: outstanding,
        total_refunds: refunds,
        total_write_offs: write_offs,
        total_advances: advances,
        collection_rate,
        period_from: params.date_from,
        period_to: params.date_to,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProfitLossDeptRow {
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub revenue: Decimal,
    pub expenses: Decimal,
    pub profit: Decimal,
}

pub async fn report_profit_loss(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<FinancialReportQuery>,
) -> Result<Json<Vec<ProfitLossDeptRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProfitLossDeptRow>(
        "WITH dept_revenue AS ( \
           SELECT ii.department_id, COALESCE(SUM(ii.total_price), 0) AS revenue \
           FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
           WHERE ii.tenant_id = $1 AND i.status != 'cancelled' \
           AND i.issued_at::date >= $2 AND i.issued_at::date <= $3 \
           GROUP BY ii.department_id \
         ), \
         dept_expense AS ( \
           SELECT jl.department_id, \
           COALESCE(SUM(jl.debit_amount), 0) AS expenses \
           FROM journal_entry_lines jl \
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.tenant_id = jl.tenant_id \
           JOIN gl_accounts ga ON ga.id = jl.account_id AND ga.tenant_id = jl.tenant_id \
           WHERE jl.tenant_id = $1 AND je.status = 'posted' \
           AND je.entry_date >= $2 AND je.entry_date <= $3 \
           AND ga.account_type = 'expense' \
           GROUP BY jl.department_id \
         ) \
         SELECT COALESCE(r.department_id, e.department_id) AS department_id, \
           d.name AS department_name, \
           COALESCE(r.revenue, 0) AS revenue, \
           COALESCE(e.expenses, 0) AS expenses, \
           COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) AS profit \
         FROM dept_revenue r \
         FULL OUTER JOIN dept_expense e ON r.department_id = e.department_id \
         LEFT JOIN departments d ON d.id = COALESCE(r.department_id, e.department_id) \
         ORDER BY profit DESC",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — ERP Export
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ErpExportRequest {
    pub target_system: String,
    pub export_type: String,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn export_to_erp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ErpExportRequest>,
) -> Result<Json<ErpExportLog>, AppError> {
    require_permission(&claims, permissions::billing::erp::EXPORT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Collect invoice IDs for the period
    let invoice_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoices WHERE tenant_id = $1 \
         AND status IN ('issued', 'partially_paid', 'paid') \
         AND ($2::date IS NULL OR issued_at::date >= $2) \
         AND ($3::date IS NULL OR issued_at::date <= $3)",
    )
    .bind(claims.tenant_id)
    .bind(body.date_from)
    .bind(body.date_to)
    .fetch_all(&mut *tx)
    .await?;

    // Build export payload stub (actual ERP API integration deferred)
    let payload = serde_json::json!({
        "target": body.target_system,
        "type": body.export_type,
        "invoice_count": invoice_ids.len(),
        "date_from": body.date_from,
        "date_to": body.date_to,
        "format_version": "1.0",
        "note": "ERP API integration pending — data formatted for export",
    });

    let row = sqlx::query_as::<_, ErpExportLog>(
        "INSERT INTO erp_export_log \
         (tenant_id, target_system, export_type, record_ids, date_from, date_to, \
          status, payload, exported_by) \
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.target_system)
    .bind(&body.export_type)
    .bind(&invoice_ids)
    .bind(body.date_from)
    .bind(body.date_to)
    .bind(&payload)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_erp_exports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ErpExportLog>>, AppError> {
    require_permission(&claims, permissions::billing::erp::EXPORT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ErpExportLog>(
        "SELECT * FROM erp_export_log WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/copay/calculate
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CopayCalculationRequest {
    pub invoice_id: Uuid,
}

pub async fn copay_calculation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CopayCalculationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch invoice total
    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(body.invoice_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    // Fetch insurance verification for the patient
    let verification = sqlx::query_as::<_, (Option<Decimal>, Option<Decimal>, Option<Decimal>)>(
        "SELECT copay_percent, copay_fixed, max_coverage_amount \
         FROM insurance_verifications \
         WHERE patient_id = $1 AND tenant_id = $2 \
           AND verification_status = 'verified' \
         ORDER BY verified_at DESC LIMIT 1",
    )
    .bind(invoice.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let total = invoice.total_amount;

    match verification {
        Some((copay_pct, copay_fixed, max_coverage)) => {
            let copay_from_pct = copay_pct
                .map(|pct| total * pct / Decimal::from(100))
                .unwrap_or_default();
            let copay_from_fixed = copay_fixed.unwrap_or_default();
            let copay = if copay_from_pct > Decimal::ZERO {
                copay_from_pct
            } else {
                copay_from_fixed
            };
            let max_cov = max_coverage.unwrap_or(total);
            let insurance_pays = (total - copay).min(max_cov);
            let patient_pays = total - insurance_pays;

            Ok(Json(serde_json::json!({
                "invoice_id": body.invoice_id,
                "invoice_total": total,
                "copay_percent": copay_pct,
                "copay_fixed": copay_fixed,
                "max_coverage": max_coverage,
                "insurance_pays": insurance_pays,
                "patient_pays": patient_pays,
                "has_insurance_verification": true,
            })))
        }
        None => Ok(Json(serde_json::json!({
            "invoice_id": body.invoice_id,
            "invoice_total": total,
            "insurance_pays": Decimal::ZERO,
            "patient_pays": total,
            "has_insurance_verification": false,
            "message": "No active insurance verification found",
        }))),
    }
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/er-invoice
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ErFastInvoiceRequest {
    pub emergency_visit_id: Uuid,
    pub patient_id: Uuid,
    pub notes: Option<String>,
}

pub async fn er_fast_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ErFastInvoiceRequest>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Collect ER charges from emergency visit encounter
    let er_encounter_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT encounter_id FROM emergency_visits \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.emergency_visit_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Emergency visit not found".to_owned()))?;

    // Create a fast invoice from ER charges
    let invoice = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, patient_id, encounter_id, invoice_type, status, \
          total_amount, notes, created_by) \
         VALUES ($1, $2, $3, 'emergency', 'draft'::invoice_status, \
                 0, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(er_encounter_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Pull charge_master items for ER consultation and add them
    let charge_rows = sqlx::query_as::<_, ChargeMaster>(
        "SELECT * FROM charge_master \
         WHERE tenant_id = $1 AND department_code = 'ER' \
           AND is_active = true \
         LIMIT 50",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut total = Decimal::ZERO;
    for charge in &charge_rows {
        let item_total = charge.base_price * Decimal::from(1);
        let tax = charge.tax_percent * item_total / Decimal::from(100);
        sqlx::query(
            "INSERT INTO invoice_items \
             (tenant_id, invoice_id, charge_code, description, quantity, \
              unit_price, tax_amount, total_amount) \
             VALUES ($1, $2, $3, $4, 1, $5, $6, $7)",
        )
        .bind(claims.tenant_id)
        .bind(invoice.id)
        .bind(&charge.code)
        .bind(&charge.name)
        .bind(charge.base_price)
        .bind(tax)
        .bind(item_total + tax)
        .execute(&mut *tx)
        .await?;
        total += item_total + tax;
    }

    // Update invoice total
    let updated_invoice = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET total_amount = $2, updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(invoice.id)
    .bind(total)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(updated_invoice))
}

// ══════════════════════════════════════════════════════════
//  Public service charge helper (used by other modules)
// ══════════════════════════════════════════════════════════

/// Input for cross-module service charge creation.
pub(crate) struct ServiceChargeInput<'a> {
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub charge_code: &'a str,
    pub quantity: i32,
    pub source_module: &'a str,
    pub source_entity_id: Uuid,
    pub requested_by: Uuid,
}

/// Create a service charge on behalf of another module.
/// Resolves price from charge_master + rate_plan, checks auto-concession rules,
/// creates invoice_item, and logs any concession applied.
/// Fails gracefully — callers should not let billing failures block module ops.
pub(crate) async fn create_service_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    inp: ServiceChargeInput<'_>,
) -> Result<AutoChargeResult, AppError> {
    let charge_input = AutoChargeInput {
        patient_id: inp.patient_id,
        encounter_id: inp.encounter_id,
        charge_code: inp.charge_code.to_owned(),
        source: inp.source_module.to_owned(),
        source_id: inp.source_entity_id,
        quantity: inp.quantity,
        description_override: None,
        unit_price_override: None,
        tax_percent_override: None,
    };

    let result = auto_charge(tx, &inp.tenant_id, charge_input).await?;

    // Check auto-concession rules from tenant_settings
    if !result.skipped_duplicate {
        let concession_inp = ConcessionCheckInput {
            tenant_id: inp.tenant_id,
            patient_id: inp.patient_id,
            invoice_id: result.invoice_id,
            invoice_item_id: result.item_id,
            source_module: inp.source_module,
            source_entity_id: inp.source_entity_id,
            requested_by: inp.requested_by,
        };
        apply_auto_concessions(tx, concession_inp).await.ok(); // best-effort — don't fail the charge if concession logic fails
    }

    Ok(result)
}

struct ConcessionCheckInput<'a> {
    tenant_id: Uuid,
    patient_id: Uuid,
    invoice_id: Uuid,
    invoice_item_id: Uuid,
    source_module: &'a str,
    source_entity_id: Uuid,
    requested_by: Uuid,
}

/// Apply auto-concession rules defined in tenant_settings.
async fn apply_auto_concessions(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    inp: ConcessionCheckInput<'_>,
) -> Result<(), AppError> {
    let tenant_id = &inp.tenant_id;
    let patient_id = &inp.patient_id;
    let invoice_id = inp.invoice_id;
    let invoice_item_id = inp.invoice_item_id;
    let source_module = inp.source_module;
    let source_entity_id = &inp.source_entity_id;
    let requested_by = &inp.requested_by;
    // Read auto-concession rules from tenant_settings
    let rules_json = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'auto_concession_rules'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(rules_val) = rules_json else {
        return Ok(());
    };

    let rules: Vec<AutoConcessionRule> = serde_json::from_value(rules_val).unwrap_or_default();

    if rules.is_empty() {
        return Ok(());
    }

    // Get patient category for rule matching
    let patient_category = sqlx::query_scalar::<_, Option<String>>(
        "SELECT category FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();

    // Get the item amount
    let item = sqlx::query_as::<_, ItemAmount>(
        "SELECT total_price FROM invoice_items WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_item_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    for rule in &rules {
        if !rule.is_active {
            continue;
        }
        // Match by module
        if let Some(ref modules) = rule.applicable_modules {
            if !modules.iter().any(|m| m == source_module) {
                continue;
            }
        }
        // Match by patient category
        if let Some(ref cats) = rule.patient_categories {
            let cat_str = patient_category.as_deref().unwrap_or("");
            if !cats.iter().any(|c| c == cat_str) {
                continue;
            }
        }
        // Apply the concession
        let concession_amount = item.total_price * rule.percent / Decimal::from(100);
        let final_amount = item.total_price - concession_amount;

        sqlx::query(
            "INSERT INTO billing_concessions \
             (tenant_id, invoice_id, invoice_item_id, patient_id, concession_type, \
              original_amount, concession_percent, concession_amount, final_amount, \
              reason, status, requested_by, approved_by, approved_at, auto_rule, \
              source_module, source_entity_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, \
                     'auto_applied'::concession_status, $11, $11, now(), $12, $13, $14)",
        )
        .bind(tenant_id)
        .bind(invoice_id)
        .bind(invoice_item_id)
        .bind(patient_id)
        .bind(&rule.concession_type)
        .bind(item.total_price)
        .bind(rule.percent)
        .bind(concession_amount)
        .bind(final_amount)
        .bind(&rule.reason)
        .bind(requested_by)
        .bind(&rule.name)
        .bind(source_module)
        .bind(source_entity_id)
        .execute(&mut **tx)
        .await?;

        // Update item price to reflect concession
        sqlx::query(
            "UPDATE invoice_items SET total_price = $2 \
             WHERE id = $1 AND tenant_id = $3",
        )
        .bind(invoice_item_id)
        .bind(final_amount)
        .bind(tenant_id)
        .execute(&mut **tx)
        .await?;

        recalculate_invoice_totals(tx, invoice_id, *tenant_id).await?;

        // Only apply first matching rule
        break;
    }

    Ok(())
}

#[derive(Debug, sqlx::FromRow)]
struct ItemAmount {
    total_price: Decimal,
}

#[derive(Debug, Deserialize)]
struct AutoConcessionRule {
    name: String,
    concession_type: String,
    percent: Decimal,
    reason: Option<String>,
    is_active: bool,
    applicable_modules: Option<Vec<String>>,
    patient_categories: Option<Vec<String>>,
}

// ══════════════════════════════════════════════════════════
//  Concession request / response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListConcessionsQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ConcessionListResponse {
    pub concessions: Vec<BillingConcession>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateConcessionRequest {
    pub invoice_id: Option<Uuid>,
    pub invoice_item_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub concession_type: String,
    pub original_amount: Decimal,
    pub concession_percent: Option<Decimal>,
    pub concession_amount: Decimal,
    pub final_amount: Decimal,
    pub reason: Option<String>,
    pub source_module: Option<String>,
    pub source_entity_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct AutoConcessionRulesResponse {
    pub rules: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAutoRulesRequest {
    pub rules: serde_json::Value,
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/concessions
// ══════════════════════════════════════════════════════════

pub async fn list_concessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListConcessionsQuery>,
) -> Result<Json<ConcessionListResponse>, AppError> {
    require_permission(&claims, permissions::billing::concessions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut where_clauses = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx = 2u32;

    if params.status.is_some() {
        where_clauses.push(format!("status = ${bind_idx}::concession_status"));
        bind_idx += 1;
    }
    if params.patient_id.is_some() {
        where_clauses.push(format!("patient_id = ${bind_idx}"));
        bind_idx += 1;
    }

    let where_str = where_clauses.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM billing_concessions WHERE {where_str}");
    let list_sql = format!(
        "SELECT * FROM billing_concessions WHERE {where_str} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );

    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    let mut list_q = sqlx::query_as::<_, BillingConcession>(&list_sql).bind(claims.tenant_id);

    if let Some(ref status) = params.status {
        count_q = count_q.bind(status);
        list_q = list_q.bind(status);
    }
    if let Some(pid) = params.patient_id {
        count_q = count_q.bind(pid);
        list_q = list_q.bind(pid);
    }

    list_q = list_q.bind(per_page).bind(offset);

    let total = count_q.fetch_one(&mut *tx).await?;
    let concessions = list_q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(ConcessionListResponse {
        concessions,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/concessions
// ══════════════════════════════════════════════════════════

pub async fn create_concession(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConcessionRequest>,
) -> Result<Json<BillingConcession>, AppError> {
    require_permission(&claims, permissions::billing::concessions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BillingConcession>(
        "INSERT INTO billing_concessions \
         (tenant_id, invoice_id, invoice_item_id, patient_id, concession_type, \
          original_amount, concession_percent, concession_amount, final_amount, \
          reason, status, requested_by, source_module, source_entity_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, \
                 'pending'::concession_status, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.invoice_item_id)
    .bind(body.patient_id)
    .bind(&body.concession_type)
    .bind(body.original_amount)
    .bind(body.concession_percent)
    .bind(body.concession_amount)
    .bind(body.final_amount)
    .bind(&body.reason)
    .bind(claims.sub)
    .bind(&body.source_module)
    .bind(body.source_entity_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/concessions/{id}/approve
// ══════════════════════════════════════════════════════════

pub async fn approve_concession(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BillingConcession>, AppError> {
    require_permission(&claims, permissions::billing::concessions::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BillingConcession>(
        "UPDATE billing_concessions SET \
         status = 'approved'::concession_status, \
         approved_by = $2, approved_at = now() \
         WHERE id = $1 AND tenant_id = $3 AND status = 'pending'::concession_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Apply to invoice if linked
    if let (Some(inv_id), Some(item_id)) = (row.invoice_id, row.invoice_item_id) {
        sqlx::query(
            "UPDATE invoice_items SET total_price = $2 \
             WHERE id = $1 AND tenant_id = $3",
        )
        .bind(item_id)
        .bind(row.final_amount)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        recalculate_invoice_totals(&mut tx, inv_id, claims.tenant_id).await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/concessions/{id}/reject
// ══════════════════════════════════════════════════════════

pub async fn reject_concession(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BillingConcession>, AppError> {
    require_permission(&claims, permissions::billing::concessions::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BillingConcession>(
        "UPDATE billing_concessions SET \
         status = 'rejected'::concession_status, \
         approved_by = $2, approved_at = now() \
         WHERE id = $1 AND tenant_id = $3 AND status = 'pending'::concession_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/concessions/auto-rules
// ══════════════════════════════════════════════════════════

pub async fn get_auto_concession_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoConcessionRulesResponse>, AppError> {
    require_permission(&claims, permissions::billing::concessions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let val = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'auto_concession_rules'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(AutoConcessionRulesResponse {
        rules: val.unwrap_or(serde_json::Value::Array(vec![])),
    }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/concessions/auto-rules
// ══════════════════════════════════════════════════════════

pub async fn update_auto_concession_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateAutoRulesRequest>,
) -> Result<Json<AutoConcessionRulesResponse>, AppError> {
    require_permission(&claims, permissions::billing::concessions::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'billing', 'auto_concession_rules', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(claims.tenant_id)
    .bind(&body.rules)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(AutoConcessionRulesResponse { rules: body.rules }))
}
