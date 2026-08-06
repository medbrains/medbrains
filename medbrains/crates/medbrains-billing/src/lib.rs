#![allow(clippy::too_many_lines)]

// Double-entry accounting (GL, journals, bank rec, TDS, GST, MIS, ERP export).
// Re-exported flat so `medbrains_billing::<handler>` paths stay unchanged.
mod accounting;
pub use accounting::*;

// Insurance, TPA and co-pay — money that arrives from someone other than the
// patient. Re-exported flat so `medbrains_billing::<handler>` paths stay unchanged.
mod insurance;
pub use insurance::*;

// Advances and interim billing — money held before the bill exists.
mod advances;
pub use advances::*;

use axum::routing::{delete, get, post, put};
use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::{
    AuditAction, BadDebtWriteOff, BillingAuditEntry, BillingConcession, BillingPackage,
    BillingPackageItem, ChargeMaster, ConcessionStatus, CorporateClient, CorporateEnrollment,
    CreditNote, CreditPatient, CreditPatientStatus, CurrencyCode, DayEndClose, ExchangeRate,
    Invoice, InvoiceDiscount, InvoiceItem, InvoiceStatus, PatientAdvance, Payment, RatePlan,
    RatePlanItem, Receipt, Refund,
};
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{
            authz_context, is_bypass_role, require_any_permission, require_permission,
        },
        field_access,
    },
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Auto-billing service (used by other modules)
// ──────────────────────────────────────────────────────────
//  The transaction-scoped auto-charge helpers now live in
//  `medbrains-server-services` so domain crates can auto-charge
//  without depending back on `medbrains-server`. Re-exported here so
//  the billing routes and the `super::billing::…` callers resolve unchanged.
// ══════════════════════════════════════════════════════════
pub(crate) use medbrains_server_services::billing::{
    AutoChargeInput, SeqResult, admission_id_for_encounter_in_tx, auto_charge,
    generate_invoice_number, recalculate_invoice_totals, reverse_invoice_item_by_id_in_tx,
    verified_admission_id_for_invoice_in_tx,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListInvoicesQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub search: Option<String>,
    pub service_lane: Option<String>,
    /// Column key to sort by (allowlisted server-side). Defaults to created_at.
    pub sort: Option<String>,
    /// Sort direction: "asc" or "desc" (default desc).
    pub order: Option<String>,
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
    pub admission_id: Option<Uuid>,
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

const BILLING_AMOUNT_FIELD: &str = "billing.amount";

async fn resolve_billing_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn billing_amount_access(restricted: &HashMap<String, FieldAccessLevel>) -> FieldAccessLevel {
    restricted
        .get(BILLING_AMOUNT_FIELD)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn should_scrub_billing_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    matches!(
        billing_amount_access(restricted),
        FieldAccessLevel::Mask | FieldAccessLevel::Hidden
    )
}

fn can_write_billing_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    billing_amount_access(restricted) == FieldAccessLevel::Edit
}

fn validate_billing_amount_write_access(
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if can_write_billing_amount(restricted) {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted billing amount fields".to_owned(),
    ))
}

fn filter_invoice_amounts(
    mut row: Invoice,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Invoice {
    if should_scrub_billing_amount(restricted) {
        row.subtotal = Decimal::ZERO;
        row.tax_amount = Decimal::ZERO;
        row.discount_amount = Decimal::ZERO;
        row.total_amount = Decimal::ZERO;
        row.paid_amount = Decimal::ZERO;
        row.cgst_amount = Decimal::ZERO;
        row.sgst_amount = Decimal::ZERO;
        row.igst_amount = Decimal::ZERO;
        row.cess_amount = Decimal::ZERO;
    }
    row
}

fn filter_invoice_item_amounts(
    mut row: InvoiceItem,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> InvoiceItem {
    if should_scrub_billing_amount(restricted) {
        row.unit_price = Decimal::ZERO;
        row.tax_percent = Decimal::ZERO;
        row.total_price = Decimal::ZERO;
        row.gst_rate = Decimal::ZERO;
        row.cgst_amount = Decimal::ZERO;
        row.sgst_amount = Decimal::ZERO;
        row.igst_amount = Decimal::ZERO;
    }
    row
}

fn filter_payment_amounts(
    mut row: Payment,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Payment {
    if should_scrub_billing_amount(restricted) {
        row.amount = Decimal::ZERO;
    }
    row
}

fn filter_discount_amounts(
    mut row: InvoiceDiscount,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> InvoiceDiscount {
    if should_scrub_billing_amount(restricted) {
        row.discount_value = Decimal::ZERO;
    }
    row
}

fn filter_refund_amounts(
    mut row: Refund,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Refund {
    if should_scrub_billing_amount(restricted) {
        row.amount = Decimal::ZERO;
    }
    row
}

fn filter_credit_note_amounts(
    mut row: CreditNote,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> CreditNote {
    if should_scrub_billing_amount(restricted) {
        row.amount = Decimal::ZERO;
    }
    row
}

fn filter_credit_patient_amounts(
    mut row: CreditPatient,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> CreditPatient {
    if should_scrub_billing_amount(restricted) {
        row.credit_limit = Decimal::ZERO;
        row.current_balance = Decimal::ZERO;
    }
    row
}

fn filter_advance_amounts(
    mut row: PatientAdvance,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PatientAdvance {
    if should_scrub_billing_amount(restricted) {
        row.amount = Decimal::ZERO;
        row.balance = Decimal::ZERO;
    }
    row
}

fn filter_charge_master_amounts(
    mut row: ChargeMaster,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> ChargeMaster {
    if should_scrub_billing_amount(restricted) {
        row.base_price = Decimal::ZERO;
    }
    row
}

fn filter_billing_package_amounts(
    mut row: BillingPackage,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> BillingPackage {
    if should_scrub_billing_amount(restricted) {
        row.total_price = Decimal::ZERO;
        row.discount_percent = Decimal::ZERO;
    }
    row
}

fn filter_billing_package_item_amounts(
    mut row: BillingPackageItem,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> BillingPackageItem {
    if should_scrub_billing_amount(restricted) {
        row.unit_price = Decimal::ZERO;
    }
    row
}

fn filter_rate_plan_item_amounts(
    mut row: RatePlanItem,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> RatePlanItem {
    if should_scrub_billing_amount(restricted) {
        row.override_price = Decimal::ZERO;
        row.override_tax_percent = Some(Decimal::ZERO);
    }
    row
}

fn filter_hsn_amounts(
    mut row: HsnSummaryRow,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> HsnSummaryRow {
    if should_scrub_billing_amount(restricted) {
        row.taxable_amount = Decimal::ZERO;
        row.cgst_amount = Decimal::ZERO;
        row.sgst_amount = Decimal::ZERO;
        row.igst_amount = Decimal::ZERO;
        row.total_tax = Decimal::ZERO;
    }
    row
}

fn filter_credit_aging_row(
    mut row: CreditAgingRow,
    restricted: &HashMap<String, FieldAccessLevel>,
    can_view_patient_identity: bool,
) -> CreditAgingRow {
    if !can_view_patient_identity {
        row.patient_name = None;
    }
    if should_scrub_billing_amount(restricted) {
        row.credit_limit = Decimal::ZERO;
        row.current_balance = Decimal::ZERO;
    }
    row
}

async fn ensure_invoice_view_access(
    state: &AppState,
    claims: &Claims,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    let authz_ctx = authz_context(claims);
    let allowed = state
        .authz
        .check(
            &authz_ctx,
            medbrains_authz::Relation::Viewer,
            "invoice",
            invoice_id,
        )
        .await
        .unwrap_or(false);
    if allowed {
        return Ok(());
    }
    Err(AppError::NotFound)
}

const BILLING_INVOICE_WORKSPACE_PERMISSIONS: &[&str] = &[
    permissions::billing::invoices::VIEW,
    permissions::billing::invoices::UPDATE,
    permissions::billing::invoices::CANCEL,
    permissions::billing::payments::CREATE,
    permissions::billing::payments::VOID,
    permissions::billing::receipts::PRINT,
    permissions::billing::receipts::REPRINT,
];
const BILLING_RECEIPT_CONTEXT_PERMISSIONS: &[&str] = &[
    permissions::billing::invoices::VIEW,
    permissions::billing::receipts::PRINT,
    permissions::billing::receipts::REPRINT,
];
const BILLING_REFUND_LIST_PERMISSIONS: &[&str] = &[
    permissions::billing::invoices::LIST,
    permissions::billing::payments::VOID,
];

fn claims_have_any_billing_permission(claims: &Claims, permissions: &[&str]) -> bool {
    is_bypass_role(claims)
        || permissions.iter().any(|permission| {
            claims
                .permissions
                .iter()
                .any(|granted| granted == permission)
        })
}

async fn ensure_invoice_workspace_access(
    state: &AppState,
    claims: &Claims,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    if claims_have_any_billing_permission(claims, &[permissions::billing::invoices::VIEW]) {
        ensure_invoice_view_access(state, claims, invoice_id).await?;
    }
    Ok(())
}

fn can_view_patient_identity(claims: &Claims) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW)
}

fn invoice_service_lane_condition(
    service_lane: Option<&str>,
) -> Result<Option<&'static str>, AppError> {
    match service_lane {
        None | Some("") | Some("all") => Ok(None),
        Some("patient") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source IN ('opd'::charge_source, 'procedure'::charge_source, \
                                 'ot'::charge_source))",
        )),
        Some("pharmacy") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source = 'pharmacy'::charge_source)",
        )),
        Some("lab") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source = 'lab'::charge_source)",
        )),
        Some("imaging") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source = 'radiology'::charge_source)",
        )),
        Some("ward") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source IN ('ipd'::charge_source, 'diet'::charge_source, \
                                 'cssd'::charge_source))",
        )),
        Some("emergency") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source IN ('emergency'::charge_source, 'ambulance'::charge_source))",
        )),
        Some("other") => Ok(Some(
            "EXISTS (SELECT 1 FROM invoice_items ii \
             WHERE ii.tenant_id = invoices.tenant_id \
               AND ii.invoice_id = invoices.id \
               AND ii.source = 'manual'::charge_source)",
        )),
        Some(other) => Err(AppError::BadRequest(format!(
            "unsupported billing service lane: {other}"
        ))),
    }
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentRequest {
    pub amount: Decimal,
    pub mode: String,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
    /// Cash counter / shift the payment was taken at, for day-close
    /// tallying. Free-text labels supplied by the desk.
    pub counter_id: Option<String>,
    pub shift: Option<String>,
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
//  GET /api/billing/invoices
// ══════════════════════════════════════════════════════════

pub async fn list_invoices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListInvoicesQuery>,
) -> Result<Json<InvoiceListResponse>, AppError> {
    let has_invoice_list =
        claims_have_any_billing_permission(&claims, &[permissions::billing::invoices::LIST]);
    let has_advance_adjust_picker = params.patient_id.is_some()
        && claims_have_any_billing_permission(&claims, &[permissions::billing::advances::ADJUST]);
    if !has_invoice_list && !has_advance_adjust_picker {
        return Err(AppError::Forbidden);
    }

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // ── ReBAC scope — invoices the caller has `view` on ──────
    let authz_ctx = authz_context(&claims);
    let visible_ids: Option<Vec<Uuid>> = if authz_ctx.is_bypass || !has_invoice_list {
        None
    } else {
        Some(
            state
                .authz
                .list_accessible(&authz_ctx, "invoice", medbrains_authz::Relation::Viewer)
                .await
                .unwrap_or_default(),
        )
    };

    if let Some(ref ids) = visible_ids {
        if ids.is_empty() {
            return Ok(Json(InvoiceListResponse {
                invoices: Vec::new(),
                total: 0,
                page,
                per_page,
            }));
        }
    }

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
    if let Some(encounter_id) = params.encounter_id {
        conditions.push(format!("encounter_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(encounter_id),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(admission_id) = params.admission_id {
        conditions.push(format!("admission_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(admission_id),
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
    if let Some(condition) = invoice_service_lane_condition(params.service_lane.as_deref())? {
        conditions.push(condition.to_owned());
    }
    if visible_ids.is_some() {
        conditions.push(format!("id = ANY(${bind_idx}::uuid[])"));
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
    if let Some(ref ids) = visible_ids {
        cq = cq.bind(ids.clone());
    }
    let total = cq.fetch_one(&mut *tx).await?;

    // ORDER BY built from an allowlist (never raw user input).
    let sort_dir = if params.order.as_deref() == Some("asc") {
        "ASC"
    } else {
        "DESC"
    };
    let order_by = match params.sort.as_deref() {
        Some("invoice_number") => format!("invoice_number {sort_dir}"),
        Some("status") => format!("status {sort_dir}"),
        Some("total_amount") => format!("total_amount {sort_dir}"),
        _ => format!("created_at {sort_dir}"),
    };
    let data_sql = format!(
        "SELECT * FROM invoices WHERE {where_clause} \
         ORDER BY {order_by} LIMIT ${bind_idx} OFFSET ${}",
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
    if let Some(ref ids) = visible_ids {
        dq = dq.bind(ids.clone());
    }
    let invoices = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let invoices = invoices
        .into_iter()
        .map(|row| filter_invoice_amounts(row, &restricted_fields))
        .collect();
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
    let admission_id = verified_admission_id_for_invoice_in_tx(
        &mut tx,
        &claims.tenant_id,
        body.patient_id,
        body.encounter_id,
        body.admission_id,
    )
    .await?;

    let invoice = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, admission_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, notes, \
          is_er_deferred) \
         VALUES ($1, $2, $3, $4, $5, 'draft'::invoice_status, 0, 0, 0, 0, 0, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&inv_number)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(admission_id)
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

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::BillingInvoiceCreated,
        invoice.id,
        claims.sub,
        serde_json::json!({
            "invoice_id": invoice.id,
            "patient_id": invoice.patient_id,
            "encounter_id": invoice.encounter_id,
            "admission_id": invoice.admission_id,
            "invoice_number": &invoice.invoice_number,
            "total_amount": invoice.total_amount,
            "status": format!("{:?}", invoice.status),
        }),
    )
    .with_patient(invoice.patient_id);
    if let Some(encounter_id) = invoice.encounter_id {
        event = event.with_encounter(encounter_id);
    }
    if let Some(admission_id) = invoice.admission_id {
        event = event.with_admission(admission_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    // Auto-issue a billing-counter token (one per patient per day; gated by the
    // tenant's billing-token enablement).
    medbrains_tokens::issue_token_once_per_patient_day(
        &mut tx,
        claims.tenant_id,
        medbrains_tokens::IssueToken {
            module: "billing",
            scope: "global",
            scope_id: None,
            scope_label: Some("Billing counter"),
            priority: "normal",
            patient_id: Some(invoice.patient_id),
            patient_name: None,
            entity_type: Some("invoice"),
            entity_id: Some(invoice.id),
            issued_by: Some(claims.sub),
        },
    )
    .await?;

    tx.commit().await?;

    // Grant the creating user viewer access to this invoice in SpiceDB
    let authz_ctx = authz_context(&claims);
    let _ = state
        .authz
        .write_tuple(
            &authz_ctx,
            "invoice",
            invoice.id,
            medbrains_authz::Relation::Viewer,
            medbrains_authz::Subject::User(claims.sub),
            None,
            Some("invoice creator".to_owned()),
        )
        .await;

    let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "billing.invoice.created",
        serde_json::json!({
            "invoice_id": invoice.id,
            "patient_id": invoice.patient_id,
            "encounter_id": invoice.encounter_id,
            "admission_id": invoice.admission_id,
            "invoice_number": invoice.invoice_number,
            "total_amount": invoice.total_amount,
            "net_amount": invoice.total_amount - invoice.discount_amount,
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
    require_any_permission(&claims, BILLING_INVOICE_WORKSPACE_PERMISSIONS)?;

    // Invoice viewers keep resource-scoped ReBAC. Payment/receipt action roles may open
    // a known invoice shell so they can collect, reverse, or print without list authority.
    ensure_invoice_workspace_access(&state, &claims, id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    if invoice.admission_id.is_none() && invoice.encounter_id.is_some() {
        invoice.admission_id =
            admission_id_for_encounter_in_tx(&mut tx, &claims.tenant_id, invoice.encounter_id)
                .await?;
    }

    let items = sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY paid_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    Ok(Json(InvoiceDetailResponse {
        invoice: filter_invoice_amounts(invoice, &restricted_fields),
        items: items
            .into_iter()
            .map(|row| filter_invoice_item_amounts(row, &restricted_fields))
            .collect(),
        payments: payments
            .into_iter()
            .map(|row| filter_payment_amounts(row, &restricted_fields))
            .collect(),
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
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;

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

    if let Some(ref i) = inv {
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::BillingInvoiceFinalized,
            i.id,
            claims.sub,
            serde_json::json!({
                "invoice_id": i.id,
                "patient_id": i.patient_id,
                "encounter_id": i.encounter_id,
                "admission_id": i.admission_id,
                "invoice_number": &i.invoice_number,
                "status": format!("{:?}", i.status),
            }),
        )
        .with_patient(i.patient_id);
        if let Some(encounter_id) = i.encounter_id {
            event = event.with_encounter(encounter_id);
        }
        if let Some(admission_id) = i.admission_id {
            event = event.with_admission(admission_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

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
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let belongs_to_invoice = sqlx::query_scalar!(
        "SELECT id FROM invoice_items
         WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3
         LIMIT 1",
        item_id,
        invoice_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    if belongs_to_invoice.is_none() {
        tx.commit().await?;
        return Err(AppError::NotFound);
    }

    let reversal_id = reverse_invoice_item_by_id_in_tx(
        &mut tx,
        &claims.tenant_id,
        item_id,
        None,
        claims.sub,
        "Invoice item voided",
        "billing_invoice_item_void",
        item_id,
    )
    .await?;

    let Some(reversal_id) = reversal_id else {
        tx.commit().await?;
        return Err(AppError::NotFound);
    };

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "reversed",
        "reversal_item_id": reversal_id
    })))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/invoices/{id}/issue
// ══════════════════════════════════════════════════════════

#[derive(Debug, Default, serde::Deserialize)]
pub struct IssueInvoiceRequest {
    /// Issue despite a failed TPA pre-auth check. Requires a reason;
    /// the override is written to the audit log.
    #[serde(default)]
    pub preauth_override: bool,
    pub override_reason: Option<String>,
}

/// TPA pre-auth gate (opt-in: billing.enforce_preauth = true). For
/// patients with an active insurance policy, the invoice total must be
/// covered by approved prior-auth amounts — issuing beyond that is what
/// produces claim denials. Cash patients and tenants without the PA
/// workflow are unaffected.
async fn enforce_preauth_limit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    invoice_id: Uuid,
    body: &IssueInvoiceRequest,
) -> Result<(), AppError> {
    let enforce = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'enforce_preauth'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .map(|v| v.as_bool().unwrap_or(v.as_str() == Some("true")))
    .unwrap_or(false);
    if !enforce {
        return Ok(());
    }

    let Some((patient_id, encounter_id, total_amount)) =
        sqlx::query_as::<_, (Uuid, Option<Uuid>, Decimal)>(
            "SELECT patient_id, encounter_id, total_amount FROM invoices \
             WHERE id = $1 AND tenant_id = $2 AND status = 'draft'::invoice_status",
        )
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut **tx)
        .await?
    else {
        return Ok(()); // not a draft — the UPDATE below will no-op anyway
    };

    let insured: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM patient_insurance \
         WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true \
           AND CURRENT_DATE BETWEEN valid_from AND valid_until)",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if !insured {
        return Ok(());
    }

    let approved: Decimal = sqlx::query_scalar(
        "SELECT COALESCE(SUM(approved_amount), 0) FROM prior_auth_requests \
         WHERE tenant_id = $1 AND patient_id = $2 AND status = 'approved' \
           AND ($3::uuid IS NULL OR encounter_id IS NULL OR encounter_id = $3) \
           AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(encounter_id)
    .fetch_one(&mut **tx)
    .await?;

    if total_amount <= approved {
        return Ok(());
    }

    if body.preauth_override {
        let reason = body
            .override_reason
            .as_deref()
            .map(str::trim)
            .filter(|reason| reason.len() >= 5)
            .ok_or_else(|| {
                AppError::BadRequest(
                    "Pre-auth override requires a reason (min 5 characters)".to_owned(),
                )
            })?;
        let override_details = serde_json::json!({
            "reason": reason,
            "invoice_total": total_amount,
            "approved_preauth": approved,
        });
        medbrains_db::audit::AuditLogger::log(
            tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id: claims.tenant_id,
                user_id: Some(claims.sub),
                action: "preauth_override",
                entity_type: "invoice",
                entity_id: Some(invoice_id),
                old_values: None,
                new_values: Some(&override_details),
                ip_address: None,
            },
        )
        .await
        .map_err(AppError::from)?;
        return Ok(());
    }

    Err(AppError::Conflict(format!(
        "Invoice total {total_amount} exceeds approved pre-authorization {approved}. \
         Obtain additional pre-auth or issue with preauth_override + reason."
    )))
}

pub async fn issue_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<IssueInvoiceRequest>>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    let body = body.map(|Json(body)| body).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    enforce_preauth_limit(&mut tx, &claims, id, &body).await?;

    // A zero-total invoice (free / medical-college / charity) has
    // nothing to collect, so it settles the moment it is issued
    // rather than sitting in 'issued' with no completion path (#293).
    let inv = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET \
         status = CASE WHEN total_amount = 0 THEN 'paid'::invoice_status \
                       ELSE 'issued'::invoice_status END, \
         issued_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft'::invoice_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(ref i) = inv {
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::BillingInvoiceFinalized,
            i.id,
            claims.sub,
            serde_json::json!({
                "invoice_id": i.id,
                "patient_id": i.patient_id,
                "encounter_id": i.encounter_id,
                "admission_id": i.admission_id,
                "invoice_number": &i.invoice_number,
                "status": format!("{:?}", i.status),
            }),
        )
        .with_patient(i.patient_id);
        if let Some(encounter_id) = i.encounter_id {
            event = event.with_encounter(encounter_id);
        }
        if let Some(admission_id) = i.admission_id {
            event = event.with_admission(admission_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;

    if let Some(ref i) = inv {
        let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            "billing.invoice.finalized",
            serde_json::json!({
                "invoice_id": i.id,
                "patient_id": i.patient_id,
                "encounter_id": i.encounter_id,
                "admission_id": i.admission_id,
                "invoice_number": i.invoice_number,
                "status": format!("{:?}", i.status),
            }),
        )
        .await;
    }

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
    require_permission(&claims, permissions::billing::invoices::CANCEL)?;

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
//  POST /api/billing/invoices/{id}/close-zero
// ══════════════════════════════════════════════════════════

/// Settle an issued zero-total invoice (free / scheme / charity) that
/// has no outstanding balance. Mirrors what issuing now does for new
/// zero-total invoices, but rescues ones already stuck in 'issued'
/// with no payment path (#293). Requires the payment permission since
/// it completes the bill.
pub async fn close_zero_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let inv = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET status = 'paid'::invoice_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status = 'issued'::invoice_status \
           AND total_amount = 0 AND paid_amount = 0 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(invoice) = inv else {
        tx.commit().await?;
        return Err(AppError::BadRequest(
            "Only an issued invoice with a zero balance can be closed this way".to_owned(),
        ));
    };

    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "invoice_close_zero",
            entity_type: "invoice",
            entity_id: Some(invoice.id),
            old_values: None,
            new_values: None,
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;
    Ok(Json(invoice))
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
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let payment_amount = body.amount.round_dp(2);
    if payment_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Payment amount must be greater than zero".to_owned(),
        ));
    }

    #[derive(sqlx::FromRow)]
    struct InvoicePaymentGate {
        patient_id: Uuid,
        encounter_id: Option<Uuid>,
        admission_id: Option<Uuid>,
        status: InvoiceStatus,
        total_amount: Decimal,
        paid_amount: Decimal,
    }

    let invoice = sqlx::query_as::<_, InvoicePaymentGate>(
        "SELECT patient_id, encounter_id, admission_id, status, total_amount, paid_amount \
         FROM invoices WHERE id = $1 AND tenant_id = $2 \
         FOR UPDATE",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if !matches!(
        invoice.status,
        InvoiceStatus::Issued | InvoiceStatus::PartiallyPaid
    ) {
        return Err(AppError::BadRequest(
            "Payments can be recorded only against issued invoices with an outstanding balance"
                .to_owned(),
        ));
    }

    let outstanding = (invoice.total_amount - invoice.paid_amount).round_dp(2);
    if outstanding <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Invoice has no outstanding balance".to_owned(),
        ));
    }
    if payment_amount > outstanding {
        return Err(AppError::BadRequest(format!(
            "Payment exceeds outstanding balance of {outstanding}"
        )));
    }

    let payment = sqlx::query_as::<_, Payment>(
        "INSERT INTO payments \
         (tenant_id, invoice_id, amount, mode, reference_number, received_by, notes, \
          counter_id, shift, paid_at) \
         VALUES ($1, $2, $3, $4::payment_mode, $5, $6, $7, $8, $9, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(payment_amount)
    .bind(&body.mode)
    .bind(&body.reference_number)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(
        body.counter_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(
        body.shift
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
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
    .bind(payment_amount)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::BillingPaymentReceived,
        payment.id,
        claims.sub,
        serde_json::json!({
            "payment_id": payment.id,
            "invoice_id": invoice_id,
            "patient_id": invoice.patient_id,
            "encounter_id": invoice.encounter_id,
            "admission_id": invoice.admission_id,
            "amount": payment.amount,
            "payment_mode": format!("{:?}", payment.mode),
            "receipt_number": payment.reference_number.as_deref(),
        }),
    )
    .with_patient(invoice.patient_id);
    let event = if let Some(encounter_id) = invoice.encounter_id {
        event.with_encounter(encounter_id)
    } else {
        event
    };
    let event = if let Some(admission_id) = invoice.admission_id {
        event.with_admission(admission_id)
    } else {
        event
    };
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    // Post-commit: a settled bill should leave the counter board when it is
    // settled, not on the board's next poll — the patient is already walking away.
    medbrains_server_core::notifications::publish_surface_board_signal(
        &state,
        claims.tenant_id,
        "billing",
        ClinicalEventName::BillingPaymentReceived.as_str(),
        "invoice",
        invoice_id,
    );

    let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "billing.payment.received",
        serde_json::json!({
            "payment_id": payment.id,
            "invoice_id": invoice_id,
            "patient_id": invoice.patient_id,
            "encounter_id": invoice.encounter_id,
            "admission_id": invoice.admission_id,
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
    require_any_permission(&claims, BILLING_INVOICE_WORKSPACE_PERMISSIONS)?;
    ensure_invoice_workspace_access(&state, &claims, invoice_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 \
         ORDER BY paid_at DESC LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let payments = payments
        .into_iter()
        .map(|row| filter_payment_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(payments))
}

// ══════════════════════════════════════════════════════════
//  Charge Master CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ChargeMaster>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ChargeMaster>(
        "SELECT * FROM charge_master WHERE tenant_id = $1 ORDER BY category, name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_charge_master_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn create_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateChargeMasterRequest>,
) -> Result<Json<ChargeMaster>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    Ok(Json(filter_charge_master_amounts(row, &restricted_fields)))
}

pub async fn update_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChargeMasterRequest>,
) -> Result<Json<ChargeMaster>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    if body.base_price.is_some() || body.tax_percent.is_some() {
        validate_billing_amount_write_access(&restricted_fields)?;
    }

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
    row.map_or_else(
        || Err(AppError::NotFound),
        |r| Ok(Json(filter_charge_master_amounts(r, &restricted_fields))),
    )
}

pub async fn delete_charge_master(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

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
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BillingPackage>(
        "SELECT * FROM billing_packages WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_billing_package_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn get_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PackageDetailResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::VIEW,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

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
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let package = filter_billing_package_amounts(package, &restricted_fields);
    let items = items
        .into_iter()
        .map(|row| filter_billing_package_item_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(PackageDetailResponse { package, items }))
}

pub async fn create_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePackageRequest>,
) -> Result<Json<BillingPackage>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    Ok(Json(filter_billing_package_amounts(
        pkg,
        &restricted_fields,
    )))
}

pub async fn update_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePackageRequest>,
) -> Result<Json<BillingPackage>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    if body.total_price.is_some() || body.discount_percent.is_some() {
        validate_billing_amount_write_access(&restricted_fields)?;
    }

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
    row.map_or_else(
        || Err(AppError::NotFound),
        |r| Ok(Json(filter_billing_package_amounts(r, &restricted_fields))),
    )
}

pub async fn delete_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

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
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::LIST,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RatePlan>(
        "SELECT * FROM rate_plans WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
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
    require_any_permission(
        &claims,
        &[
            permissions::billing::invoices::VIEW,
            permissions::billing::catalog::MANAGE,
        ],
    )?;

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
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let items = items
        .into_iter()
        .map(|row| filter_rate_plan_item_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(RatePlanDetailResponse { plan, items }))
}

pub async fn create_rate_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRatePlanRequest>,
) -> Result<Json<RatePlan>, AppError> {
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

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
    require_permission(&claims, permissions::billing::catalog::MANAGE)?;

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
    ensure_invoice_view_access(&state, &claims, invoice_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InvoiceDiscount>(
        "SELECT * FROM invoice_discounts \
         WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_discount_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn add_discount(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<AddDiscountRequest>,
) -> Result<Json<InvoiceDiscount>, AppError> {
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    Query(p): Query<medbrains_server_core::pagination::Pagination>,
) -> Result<Json<medbrains_server_core::pagination::Paginated<Refund>>, AppError> {
    require_any_permission(&claims, BILLING_REFUND_LIST_PERMISSIONS)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM refunds WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let rows = sqlx::query_as::<_, Refund>(
        "SELECT * FROM refunds WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(p.limit())
    .bind(p.offset())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_refund_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(medbrains_server_core::pagination::Paginated::new(
        rows, total, &p,
    )))
}

pub async fn create_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRefundRequest>,
) -> Result<Json<Refund>, AppError> {
    require_permission(&claims, permissions::billing::payments::VOID)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let refund_amount = body.amount.round_dp(2);
    if refund_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Refund amount must be greater than zero".to_owned(),
        ));
    }

    #[derive(sqlx::FromRow)]
    struct RefundInvoiceGate {
        status: InvoiceStatus,
        paid_amount: Decimal,
    }

    let invoice = sqlx::query_as::<_, RefundInvoiceGate>(
        "SELECT status, paid_amount FROM invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if matches!(
        invoice.status,
        InvoiceStatus::Draft | InvoiceStatus::Cancelled | InvoiceStatus::Refunded
    ) {
        return Err(AppError::BadRequest(
            "Refunds can be processed only against paid or partially paid invoices".to_owned(),
        ));
    }
    if refund_amount > invoice.paid_amount {
        return Err(AppError::BadRequest(format!(
            "Refund exceeds refundable paid amount of {}",
            invoice.paid_amount
        )));
    }

    if let Some(payment_id) = body.payment_id {
        let payment_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM payments WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3)",
        )
        .bind(payment_id)
        .bind(body.invoice_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !payment_exists {
            return Err(AppError::BadRequest(
                "Refund payment reference does not belong to this invoice".to_owned(),
            ));
        }
    }

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
    .bind(refund_amount)
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
    .bind(refund_amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_refund_amounts(refund, &restricted_fields)))
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
    Query(p): Query<medbrains_server_core::pagination::Pagination>,
) -> Result<Json<medbrains_server_core::pagination::Paginated<CreditNote>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
            permissions::billing::credit::APPLY,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM credit_notes WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let rows = sqlx::query_as::<_, CreditNote>(
        "SELECT * FROM credit_notes WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(p.limit())
    .bind(p.offset())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_credit_note_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(medbrains_server_core::pagination::Paginated::new(
        rows, total, &p,
    )))
}

pub async fn create_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditNoteRequest>,
) -> Result<Json<CreditNote>, AppError> {
    require_permission(&claims, permissions::billing::credit::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let credit_amount = body.amount.round_dp(2);
    if credit_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Credit note amount must be greater than zero".to_owned(),
        ));
    }
    let reason = body.reason.trim();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "Credit note reason must contain at least 3 characters".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let source_invoice = sqlx::query_as::<_, (InvoiceStatus, Decimal)>(
        "SELECT status, paid_amount \
         FROM invoices \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Source invoice not found".to_owned()))?;

    if !matches!(
        source_invoice.0,
        InvoiceStatus::Paid | InvoiceStatus::PartiallyPaid
    ) || source_invoice.1 <= Decimal::ZERO
    {
        return Err(AppError::BadRequest(
            "Credit note can only be created from a paid or partially paid invoice".to_owned(),
        ));
    }
    if credit_amount > source_invoice.1 {
        return Err(AppError::BadRequest(format!(
            "Credit note amount exceeds refundable paid amount: {}",
            source_invoice.1
        )));
    }

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
    .bind(credit_amount)
    .bind(reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_note_amounts(note, &restricted_fields)))
}

pub async fn apply_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApplyCreditNoteRequest>,
) -> Result<Json<CreditNote>, AppError> {
    require_permission(&claims, permissions::billing::credit::APPLY)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let note = sqlx::query_as::<_, CreditNote>(
        "SELECT * FROM credit_notes \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active' \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let note_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM invoices WHERE id = $1 AND tenant_id = $2",
    )
    .bind(note.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Credit note source invoice not found".to_owned()))?;

    let target_invoice = sqlx::query_as::<_, (Uuid, InvoiceStatus, Decimal, Decimal)>(
        "SELECT patient_id, status, total_amount, paid_amount \
         FROM invoices \
         WHERE id = $1 AND tenant_id = $2 \
         FOR UPDATE",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Target invoice not found".to_owned()))?;

    if target_invoice.0 != note_patient_id {
        return Err(AppError::BadRequest(
            "Credit note can only be applied to the same patient".to_owned(),
        ));
    }

    if !matches!(
        target_invoice.1,
        InvoiceStatus::Issued | InvoiceStatus::PartiallyPaid
    ) {
        return Err(AppError::BadRequest(
            "Credit note can only be applied to an issued invoice with outstanding balance"
                .to_owned(),
        ));
    }

    let outstanding = (target_invoice.2 - target_invoice.3).round_dp(2);
    if outstanding <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Target invoice has no outstanding balance".to_owned(),
        ));
    }
    if note.amount > outstanding {
        return Err(AppError::BadRequest(format!(
            "Credit note amount exceeds invoice outstanding balance: {outstanding}"
        )));
    }

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
    Ok(Json(filter_credit_note_amounts(note, &restricted_fields)))
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
    require_any_permission(&claims, BILLING_RECEIPT_CONTEXT_PERMISSIONS)?;
    ensure_invoice_workspace_access(&state, &claims, invoice_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Receipt>(
        "SELECT * FROM receipts \
         WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 5000",
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
    require_permission(&claims, permissions::billing::receipts::PRINT)?;

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

    if let Some(existing) = sqlx::query_as::<_, Receipt>(
        "SELECT * FROM receipts \
         WHERE payment_id = $1 AND invoice_id = $2 AND tenant_id = $3 \
         ORDER BY created_at DESC \
         LIMIT 1",
    )
    .bind(body.payment_id)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    {
        tx.commit().await?;
        return Ok(Json(existing));
    }

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
                                encounter_id: Some(body.encounter_id),
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
                         FROM pharmacy_order_items \
                         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL",
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
                                encounter_id: Some(body.encounter_id),
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
                            encounter_id: Some(body.encounter_id),
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
                            encounter_id: Some(body.encounter_id),
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
                                encounter_id: Some(body.encounter_id),
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
        "SELECT * FROM corporate_clients WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
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
         WHERE tenant_id = $1 AND corporate_id = $2 ORDER BY enrolled_at DESC LIMIT 5000",
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
    require_permission(&claims, permissions::billing::corporate::ENROLL)?;

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
    require_permission(&claims, permissions::billing::corporate::UNENROLL)?;

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
         WHERE tenant_id = $1 AND corporate_id = $2 ORDER BY created_at DESC LIMIT 5000",
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
         GROUP BY mode ORDER BY total DESC LIMIT 5000",
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
         GROUP BY ii.charge_code ORDER BY total_revenue DESC LIMIT 5000",
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
         GROUP BY to_char(created_at, 'YYYY-MM') ORDER BY month LIMIT 5000",
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
         GROUP BY bucket ORDER BY bucket LIMIT 5000",
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
         GROUP BY mode ORDER BY total DESC LIMIT 5000",
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
    /// When set, the tally counts only payments tagged to this counter.
    pub counter_id: Option<String>,
    pub shift: Option<String>,
    /// Note-count by denomination, e.g. {"500": 4, "100": 7}.
    pub denominations: Option<serde_json::Value>,
    /// Card / UPI figures from the POS / bank settlement report.
    #[serde(default)]
    pub actual_card: Decimal,
    #[serde(default)]
    pub actual_upi: Decimal,
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
    require_any_permission(
        &claims,
        &[
            permissions::billing::day_close::CREATE,
            permissions::billing::day_close::VERIFY,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (params.from, params.to) {
        (Some(from), Some(to)) => {
            sqlx::query_as::<_, DayEndClose>(
                "SELECT * FROM day_end_closes \
                 WHERE tenant_id = $1 AND close_date >= $2 AND close_date <= $3 \
                 ORDER BY close_date DESC LIMIT 5000",
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

    // Auto-calculate expected totals from payments on this date,
    // scoped to the counter when one is given (NULL counter filter =
    // tally everything, preserving pre-counter behaviour).
    let counter_filter = body
        .counter_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let mode_totals = sqlx::query_as::<_, PaymentModeTotal>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2 \
           AND ($3::text IS NULL OR counter_id = $3) \
         GROUP BY mode",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .bind(counter_filter.as_deref())
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
    // Settlement reconciliation: a non-zero figure means the desk
    // entered a POS/bank total to match against the system.
    let card_difference = body.actual_card - total_card;
    let upi_difference = body.actual_upi - total_upi;

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

    let shift_label = body
        .shift
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let row = sqlx::query_as::<_, DayEndClose>(
        "INSERT INTO day_end_closes \
         (tenant_id, close_date, cashier_id, expected_cash, actual_cash, cash_difference, \
          total_card, total_upi, total_cheque, total_bank_transfer, total_insurance, \
          total_collected, invoices_count, payments_count, refunds_total, advances_total, \
          status, notes, counter_id, shift, denominations, actual_card, actual_upi, \
          card_difference, upi_difference) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, \
          'open'::day_close_status, $17, $18, $19, $20, $21, $22, $23, $24) \
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
    .bind(counter_filter.as_deref())
    .bind(shift_label.as_deref())
    .bind(&body.denominations)
    .bind(body.actual_card)
    .bind(body.actual_upi)
    .bind(card_difference)
    .bind(upi_difference)
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

#[derive(Debug, Deserialize, Default)]
pub struct VerifyDayCloseRequest {
    pub verification_notes: Option<String>,
}

pub async fn verify_day_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<VerifyDayCloseRequest>>,
) -> Result<Json<DayEndClose>, AppError> {
    require_permission(&claims, permissions::billing::day_close::VERIFY)?;
    let body = body.map(|Json(body)| body).unwrap_or_default();

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

    // Any cash, card or UPI variance leaves the close in discrepancy.
    let balanced = existing.cash_difference == Decimal::ZERO
        && existing.card_difference == Decimal::ZERO
        && existing.upi_difference == Decimal::ZERO;
    let new_status = if balanced { "verified" } else { "discrepancy" };

    let row = sqlx::query_as::<_, DayEndClose>(
        "UPDATE day_end_closes SET \
         status = $1::day_close_status, verified_by = $2, verified_at = now(), \
         verification_notes = COALESCE($5, verification_notes), updated_at = now() \
         WHERE id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(new_status)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(
        body.verification_notes
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
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
    Query(p): Query<medbrains_server_core::pagination::Pagination>,
) -> Result<Json<medbrains_server_core::pagination::Paginated<BadDebtWriteOff>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::write_off::CREATE,
            permissions::billing::write_off::APPROVE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM bad_debt_write_offs WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let rows = sqlx::query_as::<_, BadDebtWriteOff>(
        "SELECT * FROM bad_debt_write_offs WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(p.limit())
    .bind(p.offset())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(medbrains_server_core::pagination::Paginated::new(
        rows, total, &p,
    )))
}

pub async fn create_write_off(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWriteOffRequest>,
) -> Result<Json<BadDebtWriteOff>, AppError> {
    require_permission(&claims, permissions::billing::write_off::CREATE)?;

    let reason = body.reason.trim();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "write-off reason must contain at least 3 characters".to_owned(),
        ));
    }
    if body.amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "write-off amount must be greater than zero".to_owned(),
        ));
    }
    let notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let Some((invoice_status, total_amount, paid_amount)) =
        sqlx::query_as::<_, (String, Decimal, Decimal)>(
            "SELECT status::text, total_amount, paid_amount \
             FROM invoices WHERE id = $1 AND tenant_id = $2",
        )
        .bind(body.invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
    else {
        return Err(AppError::NotFound);
    };

    if matches!(
        invoice_status.as_str(),
        "draft" | "paid" | "cancelled" | "refunded"
    ) {
        return Err(AppError::Conflict(
            "Only issued or partially paid invoices can be written off".to_owned(),
        ));
    }

    let outstanding = total_amount - paid_amount;
    if outstanding <= Decimal::ZERO {
        return Err(AppError::Conflict(
            "Invoice has no outstanding balance to write off".to_owned(),
        ));
    }

    let reserved_write_offs = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0)::numeric \
         FROM bad_debt_write_offs \
         WHERE invoice_id = $1 AND tenant_id = $2 \
           AND status IN ('pending'::write_off_status, 'approved'::write_off_status)",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let available_to_write_off = outstanding - reserved_write_offs;
    if available_to_write_off <= Decimal::ZERO {
        return Err(AppError::Conflict(
            "Invoice outstanding balance is already reserved for write-off".to_owned(),
        ));
    }
    if body.amount > available_to_write_off {
        return Err(AppError::Conflict(format!(
            "write-off amount exceeds available outstanding balance: {available_to_write_off}"
        )));
    }

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
    .bind(reason)
    .bind(claims.sub)
    .bind(&notes)
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

    let existing = sqlx::query_as::<_, BadDebtWriteOff>(
        "SELECT * FROM bad_debt_write_offs \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending'::write_off_status \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.requested_by == claims.sub {
        return Err(AppError::Conflict(
            "write-off requester cannot approve or reject the same write-off".to_owned(),
        ));
    }

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

    // Apply an APPROVED write-off to the invoice — a non-cash settlement of the balance.
    // (Previously approval never touched the invoice, so it still showed fully owing.)
    if body.approved {
        let outstanding: Decimal = sqlx::query_scalar(
            "SELECT (total_amount - paid_amount) FROM invoices WHERE id = $1 AND tenant_id = $2",
        )
        .bind(existing.invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(Decimal::ZERO)
        .round_dp(2);
        if existing.amount > outstanding {
            return Err(AppError::BadRequest(format!(
                "Write-off {} exceeds the invoice's outstanding balance {outstanding}",
                existing.amount
            )));
        }
        sqlx::query(
            "UPDATE invoices SET \
               paid_amount = paid_amount + $1, \
               written_off_amount = written_off_amount + $1, \
               status = CASE WHEN (total_amount - (paid_amount + $1)) <= 0.01 \
                             THEN 'paid'::invoice_status ELSE status END, \
               updated_at = now() \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(existing.amount)
        .bind(existing.invoice_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

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
    let admission_id = match original.admission_id {
        Some(admission_id) => Some(admission_id),
        None => {
            admission_id_for_encounter_in_tx(&mut tx, &claims.tenant_id, original.encounter_id)
                .await?
        }
    };

    let cloned = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, admission_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, \
          notes, cgst_amount, sgst_amount, igst_amount, cess_amount, \
          is_interim, corporate_id, place_of_supply, cloned_from_id, is_er_deferred) \
         VALUES ($1, $2, $3, $4, $5, 'draft'::invoice_status, \
          $6, $7, 0, $8, 0, $9, $10, $11, $12, $13, \
          false, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&new_number)
    .bind(original.patient_id)
    .bind(original.encounter_id)
    .bind(admission_id)
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
         ORDER BY total_revenue DESC LIMIT 5000",
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
         GROUP BY insurance_provider ORDER BY total_claims DESC LIMIT 5000",
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
    ensure_invoice_view_access(&state, &claims, id).await?;

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
         ORDER BY created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let payments = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY paid_at LIMIT 5000",
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
         GROUP BY hsn_sac_code ORDER BY hsn_code LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let patient_name = if can_view_patient_identity(&claims) {
        patient_name
    } else {
        None
    };

    Ok(Json(InvoicePrintData {
        invoice: filter_invoice_amounts(invoice, &restricted_fields),
        items: items
            .into_iter()
            .map(|row| filter_invoice_item_amounts(row, &restricted_fields))
            .collect(),
        payments: payments
            .into_iter()
            .map(|row| filter_payment_amounts(row, &restricted_fields))
            .collect(),
        hospital_gstin,
        hospital_name,
        hospital_address: None,
        patient_name,
        patient_address: None,
        hsn_summary: hsn_summary
            .into_iter()
            .map(|row| filter_hsn_amounts(row, &restricted_fields))
            .collect(),
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
    require_any_permission(
        &claims,
        &[
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CreditPatient>(
        "SELECT * FROM credit_patients WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY updated_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_credit_patient_amounts(row, &restricted_fields))
            .collect(),
    ))
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
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

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
    Ok(Json(filter_credit_patient_amounts(row, &restricted_fields)))
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
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    if body.credit_limit.is_some() {
        validate_billing_amount_write_access(&restricted_fields)?;
    }

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
    Ok(Json(filter_credit_patient_amounts(row, &restricted_fields)))
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
    require_any_permission(
        &claims,
        &[
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let can_reveal_patient_identity = can_view_patient_identity(&claims);

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
    Ok(Json(
        rows.into_iter()
            .map(|row| {
                filter_credit_aging_row(row, &restricted_fields, can_reveal_patient_identity)
            })
            .collect(),
    ))
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
    require_any_permission(
        &claims,
        &[
            permissions::emergency::visits::LIST,
            permissions::emergency::visits::UPDATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (er_patient_id, visit_number) = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT patient_id, visit_number FROM er_visits \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.emergency_visit_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Emergency visit not found".to_owned()))?;

    if er_patient_id != body.patient_id {
        return Err(AppError::BadRequest(
            "Emergency visit patient does not match selected patient".to_owned(),
        ));
    }

    let inv_number = generate_invoice_number(&mut tx, &claims.tenant_id).await?;
    let notes = body
        .notes
        .unwrap_or_else(|| format!("ER fast invoice for {visit_number}"));

    // Create a fast invoice from ER charges
    let invoice = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, notes, created_by, \
          is_er_deferred) \
         VALUES ($1, $2, $3, NULL::uuid, 'draft'::invoice_status, \
                 0, 0, 0, 0, 0, $4, $5, false) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&inv_number)
    .bind(er_patient_id)
    .bind(&notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Pull standard ER registration and consultation charges.
    let charge_rows = sqlx::query_as::<_, ChargeMaster>(
        "SELECT * FROM charge_master \
         WHERE tenant_id = $1 \
           AND code = ANY($2::text[]) \
           AND is_active = true \
         ORDER BY CASE code \
           WHEN 'REG_EMERGENCY' THEN 1 \
           WHEN 'CON_EMERGENCY' THEN 2 \
           ELSE 99 \
         END LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(["REG_EMERGENCY", "CON_EMERGENCY"])
    .fetch_all(&mut *tx)
    .await?;
    if charge_rows.is_empty() {
        return Err(AppError::BadRequest(
            "Standard ER charges are not configured".to_owned(),
        ));
    }

    let mut subtotal = Decimal::ZERO;
    let mut tax_total = Decimal::ZERO;
    for charge in &charge_rows {
        let item_total = charge.base_price * Decimal::from(1);
        let tax = charge.tax_percent * item_total / Decimal::from(100);
        sqlx::query(
            "INSERT INTO invoice_items \
             (tenant_id, invoice_id, charge_code, description, source, source_id, quantity, \
              unit_price, tax_percent, total_price) \
             VALUES ($1, $2, $3, $4, 'emergency'::charge_source, $5, 1, $6, $7, $8)",
        )
        .bind(claims.tenant_id)
        .bind(invoice.id)
        .bind(&charge.code)
        .bind(&charge.name)
        .bind(body.emergency_visit_id)
        .bind(charge.base_price)
        .bind(charge.tax_percent)
        .bind(item_total + tax)
        .execute(&mut *tx)
        .await?;
        subtotal += item_total;
        tax_total += tax;
    }

    // Update invoice total
    let updated_invoice = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET subtotal = $2, tax_amount = $3, total_amount = $4, updated_at = NOW() \
         WHERE id = $1 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(invoice.id)
    .bind(subtotal)
    .bind(tax_total)
    .bind(subtotal + tax_total)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(updated_invoice))
}

// ══════════════════════════════════════════════════════════
//  Public service charge helper (used by other modules)
// ══════════════════════════════════════════════════════════

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

#[derive(Debug, sqlx::FromRow)]
struct ConcessionInvoiceContext {
    patient_id: Uuid,
    status: InvoiceStatus,
}

#[derive(Debug, sqlx::FromRow)]
struct ConcessionInvoiceItemContext {
    invoice_id: Uuid,
    total_price: Decimal,
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
    require_any_permission(
        &claims,
        &[
            permissions::billing::concessions::LIST,
            permissions::billing::concessions::APPROVE,
        ],
    )?;

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

    let concession_type = body.concession_type.trim().to_owned();
    if concession_type.is_empty() {
        return Err(AppError::BadRequest(
            "concession type is required".to_owned(),
        ));
    }

    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| value.chars().count() >= 3)
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            AppError::BadRequest("concession reason must contain at least 3 characters".to_owned())
        })?;

    if body.original_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "original amount must be greater than zero".to_owned(),
        ));
    }
    if body.concession_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "concession amount must be greater than zero".to_owned(),
        ));
    }
    if body.final_amount < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "final amount cannot be negative".to_owned(),
        ));
    }
    if body.concession_amount > body.original_amount {
        return Err(AppError::BadRequest(
            "concession amount cannot exceed original amount".to_owned(),
        ));
    }
    if body.original_amount - body.concession_amount != body.final_amount {
        return Err(AppError::BadRequest(
            "final amount must equal original amount minus concession amount".to_owned(),
        ));
    }
    if body
        .concession_percent
        .is_some_and(|percent| percent < Decimal::ZERO || percent > Decimal::from(100))
    {
        return Err(AppError::BadRequest(
            "concession percent must be between 0 and 100".to_owned(),
        ));
    }

    let item_context = if let Some(item_id) = body.invoice_item_id {
        Some(
            sqlx::query_as::<_, ConcessionInvoiceItemContext>(
                "SELECT invoice_id, total_price \
                 FROM invoice_items \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(item_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::BadRequest("invoice item not found".to_owned()))?,
        )
    } else {
        None
    };

    if body.invoice_id.is_some() && item_context.is_none() {
        return Err(AppError::BadRequest(
            "invoice-linked concessions must specify an invoice item".to_owned(),
        ));
    }

    let effective_invoice_id = match (&item_context, body.invoice_id) {
        (Some(item), Some(invoice_id)) if item.invoice_id != invoice_id => {
            return Err(AppError::BadRequest(
                "invoice item does not belong to the supplied invoice".to_owned(),
            ));
        }
        (Some(item), _) => Some(item.invoice_id),
        (None, invoice_id) => invoice_id,
    };

    if let Some(item) = &item_context {
        if item.total_price != body.original_amount {
            return Err(AppError::BadRequest(
                "original amount must match the linked invoice item total".to_owned(),
            ));
        }
    }

    if let Some(invoice_id) = effective_invoice_id {
        let invoice_context = sqlx::query_as::<_, ConcessionInvoiceContext>(
            "SELECT patient_id, status \
             FROM invoices \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::BadRequest("invoice not found".to_owned()))?;

        if invoice_context.patient_id != body.patient_id {
            return Err(AppError::BadRequest(
                "concession patient does not match invoice patient".to_owned(),
            ));
        }
        if matches!(
            invoice_context.status,
            InvoiceStatus::Paid | InvoiceStatus::Cancelled | InvoiceStatus::Refunded
        ) {
            return Err(AppError::BadRequest(
                "paid, cancelled, or refunded invoices require refund/credit-note workflow"
                    .to_owned(),
            ));
        }
    } else {
        let patient_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS( \
                SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2 \
             )",
        )
        .bind(body.patient_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !patient_exists {
            return Err(AppError::BadRequest("patient not found".to_owned()));
        }
    }

    let source_module = body
        .source_module
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

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
    .bind(effective_invoice_id)
    .bind(body.invoice_item_id)
    .bind(body.patient_id)
    .bind(&concession_type)
    .bind(body.original_amount)
    .bind(body.concession_percent)
    .bind(body.concession_amount)
    .bind(body.final_amount)
    .bind(&reason)
    .bind(claims.sub)
    .bind(&source_module)
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

    let current = sqlx::query_as::<_, BillingConcession>(
        "SELECT * FROM billing_concessions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if current.status != ConcessionStatus::Pending {
        return Err(AppError::Conflict(
            "only pending concessions can be approved".to_owned(),
        ));
    }
    if current.requested_by == claims.sub {
        return Err(AppError::BadRequest(
            "concession requester cannot approve the same concession".to_owned(),
        ));
    }

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

    let current = sqlx::query_as::<_, BillingConcession>(
        "SELECT * FROM billing_concessions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if current.status != ConcessionStatus::Pending {
        return Err(AppError::Conflict(
            "only pending concessions can be rejected".to_owned(),
        ));
    }
    if current.requested_by == claims.sub {
        return Err(AppError::BadRequest(
            "concession requester cannot reject the same concession".to_owned(),
        ));
    }

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

/// Billing routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/billing/invoices",
            get(list_invoices).post(create_invoice),
        )
        .route(
            "/api/billing/invoices/interim",
            post(create_interim_invoice),
        )
        .route(
            "/api/billing/invoices/{id}",
            get(get_invoice).put(update_invoice),
        )
        .route("/api/billing/invoices/{id}/items", post(add_invoice_item))
        .route(
            "/api/billing/invoices/{id}/items/{iid}",
            delete(remove_invoice_item),
        )
        .route("/api/billing/invoices/{id}/issue", post(issue_invoice))
        .route("/api/billing/invoices/{id}/cancel", post(cancel_invoice))
        .route(
            "/api/billing/invoices/{id}/close-zero",
            post(close_zero_invoice),
        )
        .route(
            "/api/billing/invoices/{id}/payments",
            get(list_payments).post(record_payment),
        )
        .route(
            "/api/billing/charge-master",
            get(list_charge_master).post(create_charge_master),
        )
        .route(
            "/api/billing/charge-master/{id}",
            put(update_charge_master).delete(delete_charge_master),
        )
        .route(
            "/api/billing/packages",
            get(list_packages).post(create_package),
        )
        .route(
            "/api/billing/packages/{id}",
            get(get_package).put(update_package).delete(delete_package),
        )
        .route(
            "/api/billing/rate-plans",
            get(list_rate_plans).post(create_rate_plan),
        )
        .route(
            "/api/billing/rate-plans/{id}",
            get(get_rate_plan)
                .put(update_rate_plan)
                .delete(delete_rate_plan),
        )
        .route(
            "/api/billing/invoices/{id}/discounts",
            get(list_discounts).post(add_discount),
        )
        .route(
            "/api/billing/invoices/{id}/discounts/{did}",
            delete(remove_discount),
        )
        .route(
            "/api/billing/refunds",
            get(list_refunds).post(create_refund),
        )
        .route(
            "/api/billing/credit-notes",
            get(list_credit_notes).post(create_credit_note),
        )
        .route(
            "/api/billing/credit-notes/{id}/apply",
            post(apply_credit_note),
        )
        .route(
            "/api/billing/invoices/{id}/receipts",
            get(list_receipts).post(generate_receipt),
        )
        .route(
            "/api/billing/insurance-claims",
            get(list_insurance_claims).post(create_insurance_claim),
        )
        .route(
            "/api/billing/insurance-claims/{id}",
            get(get_insurance_claim).put(update_insurance_claim),
        )
        .route("/api/billing/auto-charge", post(trigger_auto_charge))
        .route(
            "/api/billing/advances",
            get(list_advances).post(create_advance),
        )
        .route("/api/billing/advances/{id}/adjust", post(adjust_advance))
        .route("/api/billing/advances/{id}/refund", post(refund_advance))
        .route(
            "/api/billing/corporates",
            get(list_corporates).post(create_corporate),
        )
        .route(
            "/api/billing/corporates/{id}",
            get(get_corporate).put(update_corporate),
        )
        .route(
            "/api/billing/corporates/{id}/enrollments",
            get(list_enrollments).post(create_enrollment),
        )
        .route(
            "/api/billing/corporates/{cid}/enrollments/{eid}",
            delete(delete_enrollment),
        )
        .route(
            "/api/billing/corporates/{id}/invoices",
            get(list_corporate_invoices),
        )
        .route("/api/billing/reports/summary", get(report_summary))
        .route(
            "/api/billing/reports/department-revenue",
            get(report_department_revenue),
        )
        .route(
            "/api/billing/reports/collection-efficiency",
            get(report_collection_efficiency),
        )
        .route("/api/billing/reports/aging", get(report_aging))
        .route("/api/billing/reports/daily", get(report_daily))
        .route(
            "/api/billing/reports/doctor-revenue",
            get(report_doctor_revenue),
        )
        .route(
            "/api/billing/reports/insurance-panel",
            get(report_insurance_panel),
        )
        .route(
            "/api/billing/reports/reconciliation",
            get(report_reconciliation),
        )
        .route(
            "/api/billing/day-closes",
            get(list_day_closes).post(create_day_close),
        )
        .route(
            "/api/billing/day-closes/{id}/verify",
            post(verify_day_close),
        )
        .route(
            "/api/billing/write-offs",
            get(list_write_offs).post(create_write_off),
        )
        .route(
            "/api/billing/write-offs/{id}/approve",
            post(approve_write_off),
        )
        .route(
            "/api/billing/tpa-rate-cards",
            get(list_tpa_rate_cards).post(create_tpa_rate_card),
        )
        .route(
            "/api/billing/tpa-rate-cards/{id}",
            put(update_tpa_rate_card).delete(delete_tpa_rate_card),
        )
        .route("/api/billing/invoices/{id}/clone", post(clone_invoice))
        .route("/api/billing/audit-log", get(list_audit_log))
        .route(
            "/api/billing/exchange-rates",
            get(list_exchange_rates).post(create_exchange_rate),
        )
        .route(
            "/api/billing/invoices/{id}/print-data",
            get(get_invoice_print_data),
        )
        .route(
            "/api/billing/threshold-check/{encounter_id}",
            get(check_billing_threshold),
        )
        .route("/api/billing/scheme-rate", get(get_scheme_rate_for_charge))
        .route(
            "/api/billing/credit-patients",
            get(list_credit_patients).post(create_credit_patient),
        )
        .route(
            "/api/billing/credit-patients/aging",
            get(report_credit_aging),
        )
        .route(
            "/api/billing/credit-patients/{id}",
            put(update_credit_patient),
        )
        .route(
            "/api/billing/invoices/{id}/dual-insurance",
            get(get_dual_insurance_status).post(coordinate_dual_insurance),
        )
        .route(
            "/api/billing/insurance-claims/{id}/reimbursement-docs",
            post(generate_reimbursement_docs).put(update_reimbursement_docs),
        )
        .route(
            "/api/billing/gl-accounts",
            get(list_gl_accounts).post(create_gl_account),
        )
        .route("/api/billing/gl-accounts/{id}", put(update_gl_account))
        .route(
            "/api/billing/journal-entries",
            get(list_journal_entries).post(create_journal_entry),
        )
        .route("/api/billing/journal-entries/{id}", get(get_journal_entry))
        .route(
            "/api/billing/journal-entries/{id}/post",
            post(post_journal_entry),
        )
        .route(
            "/api/billing/journal-entries/{id}/reverse",
            post(reverse_journal_entry),
        )
        .route(
            "/api/billing/bank-transactions",
            get(list_bank_transactions),
        )
        .route(
            "/api/billing/bank-transactions/import",
            post(import_bank_transactions),
        )
        .route(
            "/api/billing/bank-transactions/auto-reconcile",
            post(auto_reconcile),
        )
        .route(
            "/api/billing/bank-transactions/{id}/match",
            post(match_bank_transaction),
        )
        .route(
            "/api/billing/bank-transactions/auto-match",
            post(auto_match_bank_transactions),
        )
        .route(
            "/api/billing/insurance-receivables/aging",
            get(insurance_receivables_aging),
        )
        .route(
            "/api/billing/tds",
            get(list_tds_deductions).post(create_tds_deduction),
        )
        .route("/api/billing/tds/{id}/deposit", post(deposit_tds))
        .route(
            "/api/billing/tds/{id}/certificate",
            post(issue_tds_certificate),
        )
        .route("/api/billing/gst-returns", get(list_gstr_summaries))
        .route(
            "/api/billing/gst-returns/generate",
            post(generate_gstr_summary),
        )
        .route("/api/billing/gst-returns/{id}/file", post(file_gstr))
        .route("/api/billing/reports/hsn-summary", get(report_hsn_summary))
        .route(
            "/api/billing/reports/financial-mis",
            get(report_financial_mis),
        )
        .route("/api/billing/reports/profit-loss", get(report_profit_loss))
        .route("/api/billing/erp/export", post(export_to_erp))
        .route("/api/billing/erp/exports", get(list_erp_exports))
        .route("/api/billing/copay/calculate", post(copay_calculation))
        .route("/api/billing/er-invoice", post(er_fast_invoice))
        .route(
            "/api/billing/concessions",
            get(list_concessions).post(create_concession),
        )
        .route(
            "/api/billing/concessions/auto-rules",
            get(get_auto_concession_rules).put(update_auto_concession_rules),
        )
        .route(
            "/api/billing/concessions/{id}/approve",
            put(approve_concession),
        )
        .route(
            "/api/billing/concessions/{id}/reject",
            put(reject_concession),
        )
}
