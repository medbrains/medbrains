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

// Charge master, packages and rate plans — what the hospital charges for.
mod catalog;
pub use catalog::*;

// Discounts, refunds and credit notes — money going back the other way.
mod adjustments;
pub use adjustments::*;

// Revenue, doctor-share, insurance-panel and reconciliation reporting.
// Read-only: nothing here writes.
mod reports;
pub use reports::*;

// Concessions — the one billing write that is a judgement, not a calculation,
// which is why it alone carries an approve/reject cycle.
mod concessions;
pub use concessions::*;

// Corporate clients, credit patients and bad-debt write-offs — money already
// earned and not yet received.
mod credit;
pub use credit::*;

// Day-end cash closing — the one place billing's source of truth is a drawer.
mod cash_closing;
pub use cash_closing::*;

use axum::routing::{delete, get, post, put};
use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::{
    AuditAction, BillingAuditEntry, BillingPackage, BillingPackageItem, ChargeMaster, CreditNote,
    CreditPatient, CurrencyCode, ExchangeRate, Invoice, InvoiceDiscount, InvoiceItem,
    InvoiceStatus, PatientAdvance, Payment, RatePlanItem, Receipt, Refund,
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
    medbrains_server_core::middleware::authorization::collapse(
        medbrains_server_core::middleware::authorization::outcome_of(
            state.authz.check(&authz_ctx, medbrains_authz::Relation::Viewer, "invoice", invoice_id,).await,
            "invoice",
        ),
    )

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
            match state.authz.list_accessible(&authz_ctx, "invoice", medbrains_authz::Relation::Viewer).await {
            Ok(ids) => ids,
            Err(e) => {
                tracing::error!(error = %e, object_type = "invoice",
                    "rebac: list_accessible failed; refusing rather than showing an empty list");
                return Err(AppError::ServiceUnavailable(
                    "authorization backend unavailable".to_owned(),
                ));
            }
        },
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
    // No record check on body.patient_id, deliberately. Raising a bill is a
    // front-desk act against whoever presents, and the only relation written
    // below is Viewer on the invoice this call just created — scoped to the
    // new row, never to the patient. Finance desk.

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
    // Join the visit this patient is already in, so the number on their
    // slip carries through to this counter too.
    let visit_id = medbrains_tokens::current_visit(&mut tx, invoice.patient_id).await?;
    medbrains_tokens::issue_token_once_per_patient_day(
        &mut tx,
        claims.tenant_id,
        medbrains_tokens::IssueToken {
            visit_id,
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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;

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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;

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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
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
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;
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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;

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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;

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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
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
    medbrains_notifications::publish_surface_board_signal(
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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
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

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;

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
    // Driven by a completed lab order rather than a caller-named patient; the
    // order's own endpoints carry the record check. Left as a permission-only
    // hook so a billing sweep cannot silently stop charging for work done.

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
//  Invoice Clone
// ══════════════════════════════════════════════════════════

pub async fn clone_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        id,
    )
    .await?;

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
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id)
        .await?;

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
    // `tpa_rate_cards` is a price list. No patient data.

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
    // Financial, so the direct grant rather than the clinical check — treating
    // somebody does not entitle you to their bill. The id is caller-supplied,
    // which is weaker than a path id but still refuses an unreachable patient.
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, body.patient_id)
        .await?;

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
