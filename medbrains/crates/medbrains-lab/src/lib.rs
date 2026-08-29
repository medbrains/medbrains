#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::lab::{
    LabB2bClient, LabB2bRate, LabCalibration, LabCollectionCenter, LabCriticalAlert,
    LabCytologyReport, LabEqasResult, LabHistopathReport, LabHomeCollection, LabMolecularReport,
    LabNablDocument, LabOrder, LabOutsourcedOrder, LabPanelTest, LabPhlebotomyQueue,
    LabProficiencyTest, LabQcResult, LabReagentLot, LabReportDispatch, LabReportTemplate,
    LabReportTemplateListItem, LabResult, LabResultAmendment, LabResultFlag, LabSampleArchive,
    LabTestCatalog,
    LabTestPanel,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{get,post,put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_any_permission, require_permission};
use medbrains_notifications::{NewNotification, create_notification};
use medbrains_server_core::state::AppState;

mod order_filter;
mod priority;
mod reference_range;
mod westgard;
use order_filter::{Bind, build_order_filter};
use priority::{normalize_lab_priority, token_priority};
use reference_range::{LabRefRow, RefVerdict, judge};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListOrdersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct OrderListResponse {
    pub orders: Vec<LabOrder>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub test_id: Uuid,
    pub priority: Option<String>,
    pub notes: Option<String>,
    /// Internal training / simulator flag. See OPD CreateEncounterRequest.
    #[serde(default)]
    pub is_dummy: Option<bool>,
}


#[derive(Debug, Serialize)]
pub struct OrderDetailResponse {
    pub order: LabOrder,
    pub results: Vec<LabResult>,
}

const LAB_OPERATIONAL_ORDER_SCOPE_PERMISSIONS: &[&str] = &[
    permissions::lab::results::CREATE,
    permissions::lab::results::UPDATE,
    permissions::lab::results::AMEND,
    permissions::lab::phlebotomy::MANAGE,
    permissions::lab::outsourced::MANAGE,
    permissions::lab::samples::MANAGE,
    permissions::lab::dispatch::MANAGE,
    permissions::lab::specialized::CREATE,
    permissions::lab::b2b::MANAGE,
];

fn claims_have_any_permission(claims: &Claims, permissions: &[&str]) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|granted| permissions.iter().any(|permission| granted == permission))
}

fn has_operational_lab_order_scope(claims: &Claims) -> bool {
    claims_have_any_permission(claims, LAB_OPERATIONAL_ORDER_SCOPE_PERMISSIONS)
}

pub async fn grant_lab_order_creator_viewer(
    state: &AppState,
    claims: &Claims,
    order_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }

    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(claims);
    state
        .authz
        .write_tuple(
            &authz_ctx,
            "lab_order",
            order_id,
            medbrains_authz::Relation::Viewer,
            medbrains_authz::Subject::User(claims.sub),
            None,
            Some(reason.to_owned()),
        )
        .await
        .map(|_| ())
        .map_err(|e| AppError::Internal(format!("lab order authz grant failed: {e}")))
}

#[derive(Debug, Deserialize)]
pub struct AddResultInput {
    pub parameter_name: String,
    pub value: String,
    pub unit: Option<String>,
    pub normal_range: Option<String>,
    pub flag: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddResultsRequest {
    pub results: Vec<AddResultInput>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCatalogRequest {
    pub code: String,
    pub name: String,
    pub department_id: Option<Uuid>,
    pub sample_type: Option<String>,
    pub normal_range: Option<String>,
    pub unit: Option<String>,
    pub price: Decimal,
    pub tat_hours: Option<i32>,
    // Phase 2 fields
    pub loinc_code: Option<String>,
    pub method: Option<String>,
    pub specimen_volume: Option<String>,
    pub critical_low: Option<Decimal>,
    pub critical_high: Option<Decimal>,
    pub delta_check_percent: Option<Decimal>,
    pub auto_validation_rules: Option<serde_json::Value>,
    pub allows_add_on: Option<bool>,
    /// Draw tube, e.g. "Lavender EDTA". Wrong additive cannot be salvaged.
    pub container: Option<String>,
    pub fasting_required: Option<bool>,
    pub fasting_hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCatalogRequest {
    pub name: Option<String>,
    pub department_id: Option<Uuid>,
    pub sample_type: Option<String>,
    pub normal_range: Option<String>,
    pub unit: Option<String>,
    pub price: Option<Decimal>,
    pub tat_hours: Option<i32>,
    pub is_active: Option<bool>,
    // Phase 2 fields
    pub loinc_code: Option<String>,
    pub method: Option<String>,
    pub specimen_volume: Option<String>,
    pub critical_low: Option<Decimal>,
    pub critical_high: Option<Decimal>,
    pub delta_check_percent: Option<Decimal>,
    pub auto_validation_rules: Option<serde_json::Value>,
    pub allows_add_on: Option<bool>,
    /// Draw tube, e.g. "Lavender EDTA". Wrong additive cannot be salvaged.
    pub container: Option<String>,
    pub fasting_required: Option<bool>,
    pub fasting_hours: Option<i32>,
}

// Panel types

#[derive(Debug, Deserialize)]
pub struct CreatePanelRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub test_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePanelRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price: Option<Decimal>,
    pub is_active: Option<bool>,
    pub test_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct PanelDetailResponse {
    pub panel: LabTestPanel,
    pub tests: Vec<LabPanelTest>,
}

// Sample rejection types

#[derive(Debug, Deserialize)]
pub struct RejectSampleRequest {
    pub rejection_reason: String,
}

// Phase 2 request / response types

#[derive(Debug, Deserialize)]
pub struct AmendResultRequest {
    pub result_id: Uuid,
    pub amended_value: String,
    pub amended_flag: Option<String>,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReportStatusRequest {
    pub report_status: String,
}

#[derive(Debug, Deserialize)]
pub struct AddOnTestRequest {
    pub test_id: Uuid,
    pub priority: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReagentLotRequest {
    pub reagent_name: String,
    pub lot_number: String,
    pub manufacturer: Option<String>,
    pub test_id: Option<Uuid>,
    pub received_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: Option<Decimal>,
    pub quantity_unit: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReagentLotRequest {
    pub reagent_name: Option<String>,
    pub manufacturer: Option<String>,
    pub test_id: Option<Uuid>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: Option<Decimal>,
    pub quantity_unit: Option<String>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQcResultRequest {
    pub test_id: Uuid,
    pub lot_id: Uuid,
    pub level: String,
    pub target_mean: Option<Decimal>,
    pub target_sd: Option<Decimal>,
    pub observed_value: Option<Decimal>,
    pub run_date: Option<NaiveDate>,
    pub reviewer_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCalibrationRequest {
    pub test_id: Uuid,
    pub instrument_name: Option<String>,
    pub calibrator_lot: Option<String>,
    pub calibration_date: Option<NaiveDate>,
    pub next_calibration_date: Option<NaiveDate>,
    pub result_summary: Option<serde_json::Value>,
    pub is_passed: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePhlebotomyEntryRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub priority: Option<String>,
    pub location_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePhlebotomyStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateOutsourcedOrderRequest {
    pub order_id: Uuid,
    pub external_lab_name: String,
    pub external_lab_code: Option<String>,
    pub sent_date: Option<NaiveDate>,
    pub expected_return_date: Option<NaiveDate>,
    pub cost: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOutsourcedOrderRequest {
    pub status: Option<String>,
    pub actual_return_date: Option<NaiveDate>,
    pub external_ref_number: Option<String>,
    pub cost: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListFilterQuery {
    pub test_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CumulativeReportResponse {
    pub patient_id: Uuid,
    pub test_id: Uuid,
    pub results: Vec<CumulativeResultRow>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CumulativeResultRow {
    pub order_id: Uuid,
    pub parameter_name: String,
    pub value: String,
    pub flag: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TatMonitoringRow {
    pub order_id: Uuid,
    pub test_id: Uuid,
    pub patient_id: Uuid,
    pub expected_tat_minutes: Option<i32>,
    pub actual_minutes: Option<i64>,
    pub is_breached: bool,
    pub ordered_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

// ══════════════════════════════════════════════════════════
//  GET /api/lab/orders
// ══════════════════════════════════════════════════════════

pub async fn list_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOrdersQuery>,
) -> Result<Json<OrderListResponse>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // ── ReBAC scope — only lab orders caller has `view` on ────
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    let visible_ids: Option<Vec<Uuid>> =
        if authz_ctx.is_bypass || has_operational_lab_order_scope(&claims) {
            None
        } else {
            Some(
                match state.authz.list_accessible(&authz_ctx, "lab_order", medbrains_authz::Relation::Viewer).await {
                Ok(ids) => ids,
                Err(e) => {
                    tracing::error!(error = %e, object_type = "lab_order",
                        "rebac: list_accessible failed; refusing rather than showing an empty list");
                    return Err(AppError::ServiceUnavailable(
                        "authorization backend unavailable".to_owned(),
                    ));
                }
            },
            )
        };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    if visible_ids.as_ref().is_some_and(Vec::is_empty) {
        return Ok(Json(OrderListResponse {
            orders: Vec::new(),
            total: 0,
            page,
            per_page,
        }));
    }

    let (where_clause, binds, next_idx) = build_order_filter(&params, visible_ids.as_deref());

    let count_sql = format!("SELECT COUNT(*) FROM lab_orders WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for bind in &binds {
        cq = match bind {
            Bind::Uuid(value) => cq.bind(*value),
            Bind::Text(value) => cq.bind(value.clone()),
            Bind::UuidList(value) => cq.bind(value.clone()),
        };
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM lab_orders WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${next_idx} OFFSET ${}",
        next_idx + 1
    );
    let mut dq = sqlx::query_as::<_, LabOrder>(&data_sql).bind(claims.tenant_id);
    for bind in &binds {
        dq = match bind {
            Bind::Uuid(value) => dq.bind(*value),
            Bind::Text(value) => dq.bind(value.clone()),
            Bind::UuidList(value) => dq.bind(value.clone()),
        };
    }
    let orders = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(OrderListResponse {
        orders,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/lab/orders
// ══════════════════════════════════════════════════════════

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let order = create_order_in_tx(&mut tx, &claims, &body).await?;
    tx.commit().await?;
    grant_lab_order_creator_viewer(&state, &claims, order.id, "lab_order_created").await?;
    Ok(Json(order))
}

/// Transaction-scoped sibling of `create_order`. Used by order basket so
/// multiple orders across modules commit atomically. Caller owns the tx
/// + tenant context. Does NOT check permissions — caller must.
pub async fn create_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateOrderRequest,
) -> Result<LabOrder, AppError> {
    create_order_in_tx_with_options(tx, claims, body, CreateOrderOptions::default()).await
}

#[derive(Debug, Clone, Copy)]
pub struct CreateOrderOptions {
    pub auto_bill: bool,
}

impl Default for CreateOrderOptions {
    fn default() -> Self {
        Self { auto_bill: true }
    }
}

pub async fn create_order_in_tx_with_options(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateOrderRequest,
    options: CreateOrderOptions,
) -> Result<LabOrder, AppError> {
    let priority = normalize_lab_priority(body.priority.as_deref())?;

    let encounter_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if encounter_patient_id != body.patient_id {
        return Err(AppError::BadRequest(
            "encounter does not belong to patient".to_owned(),
        ));
    }

    let is_dummy = body.is_dummy.unwrap_or(false) && is_bypass_role(claims);

    let order = sqlx::query_as::<_, LabOrder>(
        "INSERT INTO lab_orders \
         (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
          status, priority, notes, is_dummy) \
         VALUES ($1, $2, $3, $4, $5, 'ordered'::lab_order_status, \
                 $6::lab_priority, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(body.patient_id)
    .bind(body.test_id)
    .bind(claims.sub)
    .bind(priority)
    .bind(&body.notes)
    .bind(is_dummy)
    .fetch_one(&mut **tx)
    .await?;

    if options.auto_bill {
        best_effort_auto_bill_lab_order_in_tx(tx, claims, &order).await?;
    }

    // Auto-issue a lab sample-collection token (one per patient per day; gated
    // by the tenant's lab-token enablement). Skipped for dummy/test orders.
    if !is_dummy {
        // Join the visit this patient is already in, so the number on their
        // slip carries through to this counter too.
        let visit_id = medbrains_tokens::current_visit(tx, order.patient_id).await?;
        medbrains_tokens::issue_token_once_per_patient_day(
            tx,
            claims.tenant_id,
            medbrains_tokens::IssueToken {
                visit_id,
                module: "lab",
                scope: "global",
                scope_id: None,
                scope_label: Some("Lab sample collection"),
                priority: token_priority(order.priority),
                patient_id: Some(order.patient_id),
                patient_name: None,
                entity_type: Some("lab_order"),
                entity_id: Some(order.id),
                issued_by: Some(claims.sub),
            },
        )
        .await?;
    }

    Ok(order)
}

async fn best_effort_auto_bill_lab_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    order: &LabOrder,
) -> Result<(), AppError> {
    sqlx::query("SAVEPOINT lab_order_auto_bill")
        .execute(&mut **tx)
        .await?;

    match auto_bill_lab_order_in_tx(tx, claims, order).await {
        Ok(()) => {
            sqlx::query("RELEASE SAVEPOINT lab_order_auto_bill")
                .execute(&mut **tx)
                .await?;
        }
        Err(error) => {
            sqlx::query("ROLLBACK TO SAVEPOINT lab_order_auto_bill")
                .execute(&mut **tx)
                .await?;
            sqlx::query("RELEASE SAVEPOINT lab_order_auto_bill")
                .execute(&mut **tx)
                .await?;
            tracing::warn!(
                error = %error,
                order_id = %order.id,
                "lab order auto-billing failed; continuing with clinical order creation"
            );
        }
    }

    Ok(())
}

async fn auto_bill_lab_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    order: &LabOrder,
) -> Result<(), AppError> {
    if !medbrains_server_services::billing::is_auto_billing_enabled(tx, &claims.tenant_id, "lab").await? {
        return Ok(());
    }

    #[derive(sqlx::FromRow)]
    struct TestInfo {
        code: String,
        name: String,
        price: Decimal,
    }

    let test_info = sqlx::query_as::<_, TestInfo>(
        "SELECT code, name, price FROM lab_test_catalog \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order.test_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(test) = test_info else {
        return Ok(());
    };

    medbrains_server_services::billing::auto_charge(
        tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id: order.patient_id,
            encounter_id: Some(order.encounter_id),
            charge_code: test.code,
            source: "lab".to_owned(),
            source_id: order.id,
            quantity: 1,
            description_override: Some(test.name),
            unit_price_override: Some(test.price),
            tax_percent_override: None,
        },
    )
    .await?;

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  GET /api/lab/orders/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    // ── ReBAC pre-check — must hold `view` on the lab_order ───
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    if !has_operational_lab_order_scope(&claims) {
        medbrains_server_core::middleware::authorization::collapse(
            medbrains_server_core::middleware::authorization::outcome_of(
                state.authz.check(&authz_ctx, medbrains_authz::Relation::Viewer, "lab_order", id,).await,
                "lab_order",
            ),
        )?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order =
        sqlx::query_as::<_, LabOrder>("SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let results = sqlx::query_as::<_, LabResult>(
        "SELECT * FROM lab_results WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(OrderDetailResponse { order, results }))
}

// ══════════════════════════════════════════════════════════
//  Status transitions
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CollectSampleRequest {
    /// Scanned/keyed patient wristband identifier (UHID), verified against the order's patient at
    /// the draw to prevent wrong-blood-in-tube.
    pub patient_identifier: String,
    /// The label on the tube. Nothing else ever set `lab_orders.sample_barcode`,
    /// which is what every downstream analyzer match keys on.
    pub sample_barcode: Option<String>,
}

/// Advance an order to `sample_collected`, with positive patient identification.
///
/// Shared by the ward/OPD path and the home-collection path, because
/// identifying the patient is a property of putting a needle into somebody,
/// not of which screen the phlebotomist opened. The home path -- the draw
/// where no colleague is present and no wristband exists on a ward rail --
/// had no identity check at all.
///
/// Returns `None` when the order was not `ordered`, so a repeated submission
/// is a no-op rather than a second collection.
async fn mark_order_collected(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    order_id: Uuid,
    patient_identifier: &str,
    sample_barcode: Option<&str>,
) -> Result<Option<LabOrder>, AppError> {
    let provided = patient_identifier.trim();
    if provided.is_empty() {
        return Err(AppError::BadRequest(
            "Confirm the patient's identity (scan the wristband or key the UHID) before \
             collecting the sample."
                .to_owned(),
        ));
    }

    // Positive patient identification at the draw (NABH/CAP/IPSG.1) -- the single biggest defence
    // against wrong-blood-in-tube. The provided identifier must match the order's patient UHID
    // before the sample can be marked collected; a mismatch blocks collection.
    let order_patient = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM lab_orders \
         WHERE id = $1 AND tenant_id = $2 AND status = 'ordered'::lab_order_status",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(patient_id) = order_patient else {
        return Err(AppError::NotFound);
    };
    let uhid = sqlx::query_scalar::<_, Option<String>>("SELECT uhid FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_optional(&mut **tx)
        .await?
        .flatten();
    if !uhid.as_deref().is_some_and(|u| u.trim().eq_ignore_ascii_case(provided)) {
        return Err(AppError::BadRequest(
            "The scanned ID does not match this order's patient - do NOT collect. Re-check the \
             identification against the order."
                .to_owned(),
        ));
    }

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         status = 'sample_collected'::lab_order_status, \
         collected_at = now(), collected_by = $1, \
         sample_barcode = COALESCE($4, sample_barcode), \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND status = 'ordered'::lab_order_status \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(order_id)
    .bind(claims.tenant_id)
    .bind(sample_barcode)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(ref o) = order {
        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::LabSampleCollected,
            o.id,
            claims.sub,
            serde_json::json!({
                "order_id": o.id,
                "patient_id": o.patient_id,
                "encounter_id": o.encounter_id,
                "test_id": o.test_id,
                "priority": format!("{:?}", o.priority).to_lowercase(),
                "sample_barcode": o.sample_barcode.as_deref(),
                "collected_at": o.collected_at.as_ref(),
            }),
        )
        .with_patient(o.patient_id)
        .with_encounter(o.encounter_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(tx, &event).await?;
    }

    Ok(order)
}

pub async fn collect_sample(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CollectSampleRequest>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::results::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = mark_order_collected(
        &mut tx,
        &claims,
        id,
        &body.patient_identifier,
        body.sample_barcode.as_deref(),
    )
    .await?;

    tx.commit().await?;
    order.map_or_else(|| Err(AppError::NotFound), |o| Ok(Json(o)))
}

pub async fn start_processing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::results::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         status = 'processing'::lab_order_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status = 'sample_collected'::lab_order_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    order.map_or_else(|| Err(AppError::NotFound), |o| Ok(Json(o)))
}

pub async fn complete_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::results::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         status = 'completed'::lab_order_status, \
         completed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status = 'processing'::lab_order_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(ref o) = order {
        auto_bill_lab_order_in_tx(&mut tx, &claims, o).await?;

        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::LabOrderCompleted,
            o.id,
            claims.sub,
            serde_json::json!({
                "order_id": o.id,
                "patient_id": o.patient_id,
                "encounter_id": o.encounter_id,
                "test_id": o.test_id,
                "priority": format!("{:?}", o.priority).to_lowercase(),
            }),
        )
        .with_patient(o.patient_id)
        .with_encounter(o.encounter_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;

    // Emit integration event
    if let Some(ref o) = order {
        // Enrich payload with names for orchestration
        let patient_info = sqlx::query_as::<_, (String, String)>(
            "SELECT first_name || ' ' || last_name, uhid FROM patients WHERE id = $1",
        )
        .bind(o.patient_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        let (patient_name, uhid) =
            patient_info.unwrap_or_else(|| ("Unknown".to_owned(), "N/A".to_owned()));

        let doctor_name =
            sqlx::query_scalar::<_, String>("SELECT full_name FROM users WHERE id = $1")
                .bind(o.ordered_by)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "Unknown".to_owned());

        let tests_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM lab_results WHERE order_id = $1 AND tenant_id = $2",
        )
        .bind(o.id)
        .bind(claims.tenant_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or(0);

        let _ = medbrains_workflow::orchestration::lifecycle::emit_after_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            "lab.order.completed",
            serde_json::json!({
                "order_id": o.id,
                "patient_id": o.patient_id,
                "patient_name": patient_name,
                "uhid": uhid,
                "doctor_id": o.ordered_by,
                "doctor_name": doctor_name,
                "test_id": o.test_id,
                "tests_count": tests_count,
                "priority": format!("{:?}", o.priority).to_lowercase(),
            }),
        )
        .await;
    }

    order.map_or_else(|| Err(AppError::NotFound), |o| Ok(Json(o)))
}

pub async fn verify_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LabOrder>, AppError> {
    // Still `UPDATE`, which is the same code that enters and edits a value --
    // so the account that types a result also releases it. Splitting that
    // needs a new `lab.results.verify` constant in `medbrains-core`, and that
    // file currently carries another change in progress; the split lands on
    // its own once that is in.
    require_permission(&claims, permissions::lab::results::UPDATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Releasing is a clinical signature, not a status change, and the status
    // was the only thing being checked. An order could travel
    // ordered → collected → processing → completed → verified carrying no
    // results at all and be printed as a verified report.
    let result_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM lab_results \
         WHERE order_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if result_count == 0 {
        return Err(AppError::BadRequest(
            "This order has no results to release. Enter the results first.".to_owned(),
        ));
    }

    // A critical value can currently be released and printed while its alert
    // is still unacknowledged and mid-escalation, which is the one case where
    // the report reaching the clinician first actively hides that nobody has
    // been telephoned yet.
    let unacknowledged = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM lab_critical_alerts \
         WHERE order_id = $1 AND tenant_id = $2 \
           AND acknowledged_at IS NULL AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if unacknowledged > 0 {
        return Err(AppError::BadRequest(
            "A critical value on this order has not been acknowledged yet. Complete the read-back \
             with the treating doctor before releasing the report."
                .to_owned(),
        ));
    }

    // Quality control has to have passed for the test being released.
    //
    // `create_qc_result` could already set a run to `rejected` and nothing
    // anywhere consulted it: an instrument failing its controls went on
    // reporting patient results, which is the one thing running controls is
    // for. ISO 15189 puts it plainly -- results from an analytical run whose
    // QC failed are not reported.
    //
    // Only the most recent run for this test counts, and only while nobody has
    // reviewed it. A supervisor who looks at a failed run and signs it off --
    // the control vial was old, the wrong level was loaded -- releases the
    // hold, which is why the review route exists alongside this.
    let blocking_qc = sqlx::query_scalar::<_, bool>(
        "SELECT q.status::text = 'rejected' AND q.reviewed_by IS NULL \
           FROM lab_qc_results q \
           JOIN lab_orders lo ON lo.test_id = q.test_id AND lo.tenant_id = q.tenant_id \
          WHERE lo.id = $1 AND q.tenant_id = $2 AND q.deleted_at IS NULL \
          ORDER BY q.run_date DESC NULLS LAST, q.run_time DESC \
          LIMIT 1",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(false);
    if blocking_qc {
        return Err(AppError::BadRequest(
            "Quality control for this test was rejected and has not been reviewed. Repeat the \
             controls, or have a supervisor review the failed run, before releasing results."
                .to_owned(),
        ));
    }

    // Second pair of eyes, on the results where it matters.
    //
    // A blanket rule would be wrong here: there is one lab role in this
    // system, so on a single-technologist night shift it would stop the lab
    // reporting anything at all -- delayed results being their own patient
    // harm, and a broader one. A critical value is the result that kills
    // somebody when it is wrong, so that is where the second person is
    // required, and only there.
    let released_own_critical = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM lab_results \
          WHERE order_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND entered_by = $3 \
            AND flag IN ('critical_low'::lab_result_flag, 'critical_high'::lab_result_flag))",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    if released_own_critical {
        return Err(AppError::BadRequest(
            "A critical result cannot be released by the person who entered it. Ask a colleague \
             to verify this report."
                .to_owned(),
        ));
    }

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         status = 'verified'::lab_order_status, \
         verified_by = $1, verified_at = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
           AND status = 'completed'::lab_order_status \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(ref o) = order {
        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::LabResultVerified,
            o.id,
            claims.sub,
            serde_json::json!({
                "order_id": o.id,
                "patient_id": o.patient_id,
                "encounter_id": o.encounter_id,
                "test_id": o.test_id,
                "verified_at": o.verified_at,
            }),
        )
        .with_patient(o.patient_id)
        .with_encounter(o.encounter_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

        // Close the loop back to the ordering clinician: signal that verified results
        // are ready to review. Routine (non-critical) results otherwise gave the doctor
        // NO signal — only critical values notified at result entry. Same recipient rule
        // as the critical alert (encounter doctor, else ordering provider); skip the
        // notification when the verifier is that clinician (no self-noise).
        let recipient: Uuid = sqlx::query_scalar(
            "SELECT COALESCE( \
               (SELECT doctor_id FROM encounters WHERE id = $1 AND tenant_id = $2), $3)",
        )
        .bind(o.encounter_id)
        .bind(claims.tenant_id)
        .bind(o.ordered_by)
        .fetch_one(&mut *tx)
        .await?;
        if recipient != claims.sub {
            create_notification(
                &mut tx,
                claims.tenant_id,
                NewNotification {
                    user_id: recipient,
                    kind: "info",
                    title: "Lab results ready",
                    body: None,
                    category: Some("Lab"),
                    entity_type: Some("lab_order"),
                    entity_id: Some(o.id),
                    action_url: Some("/lab"),
                },
            )
            .await?;
        }
    }

    tx.commit().await?;
    if let Some(ref o) = order {
        medbrains_notifications::publish_surface_board_signal(
            &state,
            claims.tenant_id,
            "lab",
            ClinicalEventName::LabResultVerified.as_str(),
            "lab_order",
            o.id,
        );
    }
    order.map_or_else(|| Err(AppError::NotFound), |o| Ok(Json(o)))
}

pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         status = 'cancelled'::lab_order_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('ordered'::lab_order_status, 'sample_collected'::lab_order_status) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    if order.is_some() {
        medbrains_server_services::billing::reverse_auto_charge_for_source(
            &mut tx,
            &claims.tenant_id,
            "lab",
            id,
            claims.sub,
            "Lab order cancelled",
        )
        .await?;
    }

    tx.commit().await?;
    order.map_or_else(|| Err(AppError::NotFound), |o| Ok(Json(o)))
}

// ══════════════════════════════════════════════════════════
//  Results
// ══════════════════════════════════════════════════════════

/// The patient's lab reference band ("neonate" | "infant" | "child" |
/// "adult_m" | "adult_f" | "elderly_m" | "elderly_f"), from age + biological
/// sex. ≥65y → elderly (falls back to the adult band when no elderly range).
/// Defaults to adult by sex.
/// The band for the reference table, plus the age and sex a tenant's own
/// `critical_value_rules` scope on.
struct PatientLabContext {
    band: String,
    age_years: Option<i32>,
    sex: Option<String>,
}

async fn patient_lab_band(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientLabContext, AppError> {
    let row = sqlx::query_as::<_, (Option<NaiveDate>, Option<String>)>(
        "SELECT date_of_birth, biological_sex::text FROM patients \
         WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?;
    let (dob, sex) = row.unwrap_or((None, None));
    let adult = if sex.as_deref() == Some("female") { "adult_f" } else { "adult_m" };
    let Some(dob) = dob else {
        return Ok(PatientLabContext { band: adult.to_owned(), age_years: None, sex });
    };
    let age_days = chrono::Utc::now().date_naive().signed_duration_since(dob).num_days();
    let elderly = if sex.as_deref() == Some("female") { "elderly_f" } else { "elderly_m" };
    let band = if age_days < 28 {
        "neonate"
    } else if age_days < 365 {
        "infant"
    } else if age_days < 365 * 12 {
        "child"
    } else if age_days >= 365 * 65 {
        elderly
    } else {
        adult
    };
    Ok(PatientLabContext {
        band: band.to_owned(),
        age_years: i32::try_from(age_days / 365).ok(),
        sex,
    })
}

/// What the tenant's own critical rules say about a value.
enum TenantCritical {
    /// Outside a limit this hospital wrote down.
    Flagged(&'static str),
    /// A rule applies and the value is inside it. The shared thresholds must
    /// then stay out of the way.
    WithinLimits,
    /// This hospital has no rule for this analyte and this patient.
    NoRule,
}

/// Evaluate `critical_value_rules` -- the table with a full settings screen
/// that nothing has ever read.
///
/// A hospital configures a paediatric potassium limit here and it changes
/// nothing about what gets flagged, silently, because result entry consults
/// only the global `cds_lab_reference`. That table has no tenant, and no age
/// or sex scoping beyond its fixed bands, which is usually the reason somebody
/// wrote a rule of their own.
///
/// Rules are matched most specific first: a rule naming an age range or a sex
/// beats a blanket one, so a paediatric limit wins for a child without having
/// to disable the adult rule beside it.
/// The casts on `$3` and `$4` are load-bearing. `$3 IS NOT NULL` gives the
/// planner nothing to infer a type from, and sqlx parses with unspecified
/// parameter types, so without them the server answers "could not determine
/// data type of parameter $3" and the query fails every time it is run.
async fn tenant_critical(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    parameter_name: &str,
    value: f64,
    ctx: &PatientLabContext,
) -> Result<TenantCritical, AppError> {
    let rule = sqlx::query_as::<_, (Option<f64>, Option<f64>)>(
        "SELECT low_critical::float8, high_critical::float8 \
           FROM critical_value_rules \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND (lower(test_code) = lower($2) OR lower(test_name) = lower($2)) \
            AND (age_min IS NULL OR ($3::int IS NOT NULL AND $3::int >= age_min)) \
            AND (age_max IS NULL OR ($3::int IS NOT NULL AND $3::int <= age_max)) \
            AND (gender IS NULL OR gender = $4::text) \
          ORDER BY (gender IS NOT NULL) DESC, \
                   (age_min IS NOT NULL OR age_max IS NOT NULL) DESC \
          LIMIT 1",
    )
    .bind(tenant_id)
    .bind(parameter_name.trim())
    .bind(ctx.age_years)
    .bind(ctx.sex.as_deref())
    .fetch_optional(&mut **tx)
    .await?;

    let Some((low, high)) = rule else {
        return Ok(TenantCritical::NoRule);
    };
    if low.is_some_and(|limit| value < limit) {
        return Ok(TenantCritical::Flagged("critical_low"));
    }
    if high.is_some_and(|limit| value > limit) {
        return Ok(TenantCritical::Flagged("critical_high"));
    }
    // A rule with neither limit set decides nothing, so it must not silence
    // the shared thresholds either.
    if low.is_none() && high.is_none() {
        return Ok(TenantCritical::NoRule);
    }
    Ok(TenantCritical::WithinLimits)
}


/// Judge a result against the global `cds_lab_reference`.
///
/// Three outcomes, not two -- see `reference_range`. A value this table cannot
/// judge comes back `Unknown`, and `Unknown` is never normality.
async fn auto_flag(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    parameter_name: &str,
    value: &str,
    ctx: &PatientLabContext,
) -> Result<RefVerdict, AppError> {
    // Not a number: a culture, a serology, a description. The numeric bands
    // say nothing about it, and silence is not a pass.
    let Ok(numeric) = value.trim().parse::<f64>() else {
        return Ok(RefVerdict::Unknown);
    };

    // The hospital's own limits are asked first, and win.
    let tenant = tenant_critical(tx, tenant_id, parameter_name, numeric, ctx).await?;
    if let TenantCritical::Flagged(flag) = tenant {
        return Ok(RefVerdict::Flagged(flag));
    }
    let criticals_decided = matches!(tenant, TenantCritical::WithinLimits);

    let row = sqlx::query_as::<_, LabRefRow>(
        "SELECT normal_low::float8, normal_high::float8, \
                critical_low::float8, critical_high::float8, \
                neonate_low::float8, neonate_high::float8, infant_low::float8, infant_high::float8, \
                child_low::float8, child_high::float8, adult_m_low::float8, adult_m_high::float8, \
                adult_f_low::float8, adult_f_high::float8, \
                elderly_low::float8, elderly_high::float8 \
         FROM cds_lab_reference WHERE lower(analyte) = lower($1) OR lower(test) = lower($1) LIMIT 1",
    )
    .bind(parameter_name.trim())
    .fetch_optional(&mut **tx)
    .await?;
    // The analyte is not in the reference table at all.
    let Some(row) = row else {
        // No shared reference either. If the tenant ruled the value inside its
        // own limits that is a real judgement about criticality, but it says
        // nothing about the normal range, so this is still Unknown.
        return Ok(RefVerdict::Unknown);
    };
    Ok(judge(&row, numeric, &ctx.band, criticals_decided))
}

pub async fn add_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<AddResultsRequest>,
) -> Result<Json<Vec<LabResult>>, AppError> {
    require_permission(&claims, permissions::lab::results::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch the order to get patient_id and test_id for delta checks
    let order =
        sqlx::query_as::<_, LabOrder>("SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2")
            .bind(order_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    // Never enter raw results against a closed order: a cancelled order has no valid sample, and a
    // verified (authorised) report must be corrected through an amendment, not silently overwritten.
    let closed_reason = match order.status {
        medbrains_core::lab::LabOrderStatus::Cancelled => {
            Some("cancelled — its sample is not valid for results")
        }
        medbrains_core::lab::LabOrderStatus::Verified => {
            Some("already verified — correct a value through an amendment instead")
        }
        _ => None,
    };
    if let Some(reason) = closed_reason {
        return Err(AppError::Conflict(format!(
            "Results cannot be entered: this lab order is {reason}."
        )));
    }

    // Patient age/sex band for reference-range auto-flagging.
    let lab_band = patient_lab_band(&mut tx, claims.tenant_id, order.patient_id).await?;

    // Fetch test catalog for delta check threshold
    #[derive(sqlx::FromRow)]
    struct TestConfig {
        delta_check_percent: Option<Decimal>,
    }
    let test_config = sqlx::query_as::<_, TestConfig>(
        "SELECT delta_check_percent \
         FROM lab_test_catalog WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order.test_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let mut results = Vec::with_capacity(body.results.len());
    let mut critical_count = 0_usize;
    for r in &body.results {
        // Auto-detect a critical value from the global CDS lab reference when
        // the technician hasn't already flagged one (NABL critical-value
        // reporting — a value out of the critical range is never missed).
        let verdict =
            auto_flag(&mut tx, claims.tenant_id, &r.parameter_name, &r.value, &lab_band).await?;
        // The table only overrides the technologist when it actually judged
        // the value; otherwise their own flag stands.
        let effective_flag = match &verdict {
            RefVerdict::Flagged(flag) => Some((*flag).to_owned()),
            RefVerdict::InRange | RefVerdict::Unknown => r.flag.clone(),
        };

        // Delta check: find previous result for same patient + parameter
        #[derive(sqlx::FromRow)]
        struct PrevResult {
            value: String,
        }
        let prev = sqlx::query_as::<_, PrevResult>(
            "SELECT lr.value FROM lab_results lr \
             JOIN lab_orders lo ON lr.order_id = lo.id \
             WHERE lo.patient_id = $1 AND lo.test_id = $2 \
               AND lr.parameter_name = $3 AND lo.tenant_id = $4 \
               AND lo.id != $5 \
             ORDER BY lr.created_at DESC LIMIT 1",
        )
        .bind(order.patient_id)
        .bind(order.test_id)
        .bind(&r.parameter_name)
        .bind(claims.tenant_id)
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await?;

        let previous_value = prev.as_ref().map(|p| p.value.clone());

        // Calculate delta percent
        let mut delta_percent: Option<Decimal> = None;
        let mut is_delta_flagged = false;
        if let (Some(pv), Ok(new_val)) = (&previous_value, r.value.parse::<Decimal>()) {
            if let Ok(old_val) = pv.parse::<Decimal>() {
                if old_val != Decimal::ZERO {
                    let dp = ((new_val - old_val).abs() / old_val.abs()) * Decimal::from(100);
                    delta_percent = Some(dp);
                    if let Some(ref tc) = test_config {
                        if let Some(threshold) = tc.delta_check_percent {
                            if dp > threshold {
                                is_delta_flagged = true;
                            }
                        }
                    }
                }
            }
        }

        // Auto-validate only what is affirmatively known to be in range.
        //
        // The `else` branch here used to read "no flag = normal", which made an
        // empty flag mean normality. An empty flag is what you get when the
        // analyte is not in the reference table, when the patient's age band is
        // unpopulated, and when the value is not a number at all -- so a
        // culture growing a resistant organism was auto-validated. This flag is
        // carried into the signed report payload, so a wrong stamp is a false
        // assertion inside a signed record.
        let is_auto_validated = !is_delta_flagged
            && match effective_flag.as_deref() {
                // A technologist marking it normal is the human judgement that
                // autoverification stands in for, so it still counts.
                Some("normal") => true,
                None => verdict == RefVerdict::InRange,
                Some(_) => false,
            };

        let result = sqlx::query_as::<_, LabResult>(
            "INSERT INTO lab_results \
             (tenant_id, order_id, parameter_name, value, unit, \
              normal_range, flag, notes, entered_by, \
              previous_value, delta_percent, is_delta_flagged, is_auto_validated) \
             VALUES ($1, $2, $3, $4, $5, $6, $7::lab_result_flag, $8, $9, \
                     $10, $11, $12, $13) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(order_id)
        .bind(&r.parameter_name)
        .bind(&r.value)
        .bind(&r.unit)
        .bind(&r.normal_range)
        .bind(&effective_flag)
        .bind(&r.notes)
        .bind(claims.sub)
        .bind(&previous_value)
        .bind(delta_percent)
        .bind(is_delta_flagged)
        .bind(is_auto_validated)
        .fetch_one(&mut *tx)
        .await?;

        // Generate critical alert if flag is critical
        if let Some(ref flag_str) = effective_flag {
            if flag_str == "critical_low" || flag_str == "critical_high" {
                critical_count += 1;
                // notified_to drives the SMS + escalation chain: the
                // encounter's doctor when set, else whoever ordered.
                sqlx::query(
                    "INSERT INTO lab_critical_alerts \
                     (tenant_id, order_id, result_id, patient_id, \
                      parameter_name, value, flag, notified_to, notified_at) \
                     VALUES ($1, $2, $3, $4, $5, $6, $7::lab_result_flag, \
                       COALESCE( \
                         (SELECT doctor_id FROM encounters WHERE id = $8 AND tenant_id = $1), \
                         $9), \
                       now())",
                )
                .bind(claims.tenant_id)
                .bind(order_id)
                .bind(result.id)
                .bind(order.patient_id)
                .bind(&r.parameter_name)
                .bind(&r.value)
                .bind(flag_str)
                .bind(order.encounter_id)
                .bind(order.ordered_by)
                .execute(&mut *tx)
                .await?;

                // In-app notification to the responsible clinician (encounter
                // doctor, else the ordering provider) — same recipient rule as
                // the alert, atomic with it.
                let recipient: Uuid = sqlx::query_scalar(
                    "SELECT COALESCE( \
                       (SELECT doctor_id FROM encounters WHERE id = $1 AND tenant_id = $2), $3)",
                )
                .bind(order.encounter_id)
                .bind(claims.tenant_id)
                .bind(order.ordered_by)
                .fetch_one(&mut *tx)
                .await?;
                // `alert_message` is the third dead column on
                // `critical_value_rules`: a hospital writes the instruction it
                // wants its clinicians to see -- "Repeat before treating",
                // "Call the on-call nephrologist" -- and nothing has ever
                // shown it. Only looked up when a critical actually fires.
                let tenant_message = sqlx::query_scalar::<_, String>(
                    "SELECT alert_message FROM critical_value_rules \
                      WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
                        AND (lower(test_code) = lower($2) OR lower(test_name) = lower($2)) \
                      ORDER BY (gender IS NOT NULL) DESC, \
                               (age_min IS NOT NULL OR age_max IS NOT NULL) DESC \
                      LIMIT 1",
                )
                .bind(claims.tenant_id)
                .bind(r.parameter_name.trim())
                .fetch_optional(&mut *tx)
                .await?
                .filter(|message| !message.trim().is_empty());

                let measurement = format!("{}: {} ({})", r.parameter_name, r.value, flag_str);
                let body = tenant_message
                    .map_or_else(|| measurement.clone(), |m| format!("{measurement} — {m}"));
                create_notification(
                    &mut tx,
                    claims.tenant_id,
                    NewNotification {
                        user_id: recipient,
                        kind: "danger",
                        title: "Critical lab value",
                        body: Some(&body),
                        category: Some("Lab"),
                        entity_type: Some("lab_order"),
                        entity_id: Some(order_id),
                        action_url: Some("/lab"),
                    },
                )
                .await?;
            }
        }

        results.push(result);
    }

    if !results.is_empty() {
        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::LabResultPosted,
            order.id,
            claims.sub,
            serde_json::json!({
                "order_id": order.id,
                "patient_id": order.patient_id,
                "encounter_id": order.encounter_id,
                "test_id": order.test_id,
                "ordering_provider_id": order.ordered_by,
                "result_count": results.len(),
                "critical_count": critical_count,
            }),
        )
        .with_patient(order.patient_id)
        .with_encounter(order.encounter_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;

    // Post-commit: nudge the lab board so a posted result shows up when it is
    // posted, not up to ten seconds later on the next poll.
    if !results.is_empty() {
        medbrains_notifications::publish_surface_board_signal(
            &state,
            claims.tenant_id,
            "lab",
            ClinicalEventName::LabResultPosted.as_str(),
            "lab_order",
            order.id,
        );
    }

    Ok(Json(results))
}

pub async fn list_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Vec<LabResult>>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabResult>(
        "SELECT * FROM lab_results WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Test Catalog CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabTestCatalog>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::lab::orders::LIST,
            permissions::lab::orders::CREATE,
            permissions::camp::lab::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabTestCatalog>(
        "SELECT * FROM lab_test_catalog WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_catalog_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCatalogRequest>,
) -> Result<Json<LabTestCatalog>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabTestCatalog>(
        "INSERT INTO lab_test_catalog \
         (tenant_id, code, name, department_id, sample_type, \
          normal_range, unit, price, tat_hours, \
          loinc_code, method, specimen_volume, \
          critical_low, critical_high, delta_check_percent, \
          auto_validation_rules, allows_add_on, \
          container, fasting_required, fasting_hours) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, \
                 $10, $11, $12, $13, $14, $15, $16, \
                 COALESCE($17, false), $18, COALESCE($19, false), $20) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.department_id)
    .bind(&body.sample_type)
    .bind(&body.normal_range)
    .bind(&body.unit)
    .bind(body.price)
    .bind(body.tat_hours)
    .bind(&body.loinc_code)
    .bind(&body.method)
    .bind(&body.specimen_volume)
    .bind(body.critical_low)
    .bind(body.critical_high)
    .bind(body.delta_check_percent)
    .bind(&body.auto_validation_rules)
    .bind(body.allows_add_on)
    .bind(&body.container)
    .bind(body.fasting_required)
    .bind(body.fasting_hours)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_catalog_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCatalogRequest>,
) -> Result<Json<LabTestCatalog>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabTestCatalog>(
        "UPDATE lab_test_catalog SET \
         name = COALESCE($1, name), \
         department_id = COALESCE($2, department_id), \
         sample_type = COALESCE($3, sample_type), \
         normal_range = COALESCE($4, normal_range), \
         unit = COALESCE($5, unit), \
         price = COALESCE($6, price), \
         tat_hours = COALESCE($7, tat_hours), \
         is_active = COALESCE($8, is_active), \
         loinc_code = COALESCE($9, loinc_code), \
         method = COALESCE($10, method), \
         specimen_volume = COALESCE($11, specimen_volume), \
         critical_low = COALESCE($12, critical_low), \
         critical_high = COALESCE($13, critical_high), \
         delta_check_percent = COALESCE($14, delta_check_percent), \
         auto_validation_rules = COALESCE($15, auto_validation_rules), \
         allows_add_on = COALESCE($16, allows_add_on), \
         container = COALESCE($17, container), \
         fasting_required = COALESCE($18, fasting_required), \
         fasting_hours = COALESCE($19, fasting_hours), \
         updated_at = now() \
         WHERE id = $20 AND tenant_id = $21 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(body.department_id)
    .bind(&body.sample_type)
    .bind(&body.normal_range)
    .bind(&body.unit)
    .bind(body.price)
    .bind(body.tat_hours)
    .bind(body.is_active)
    .bind(&body.loinc_code)
    .bind(&body.method)
    .bind(&body.specimen_volume)
    .bind(body.critical_low)
    .bind(body.critical_high)
    .bind(body.delta_check_percent)
    .bind(&body.auto_validation_rules)
    .bind(body.allows_add_on)
    .bind(&body.container)
    .bind(body.fasting_required)
    .bind(body.fasting_hours)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Test Panels CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_panels(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabTestPanel>>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabTestPanel>(
        "SELECT * FROM lab_test_panels WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_panel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PanelDetailResponse>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let panel = sqlx::query_as::<_, LabTestPanel>(
        "SELECT * FROM lab_test_panels WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let tests = sqlx::query_as::<_, LabPanelTest>(
        "SELECT * FROM lab_panel_tests WHERE panel_id = $1 AND tenant_id = $2 \
         ORDER BY sort_order LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PanelDetailResponse { panel, tests }))
}

pub async fn create_panel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePanelRequest>,
) -> Result<Json<PanelDetailResponse>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let panel = sqlx::query_as::<_, LabTestPanel>(
        "INSERT INTO lab_test_panels \
         (tenant_id, code, name, description, price) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.price)
    .fetch_one(&mut *tx)
    .await?;

    let mut tests = Vec::with_capacity(body.test_ids.len());
    for (i, test_id) in body.test_ids.iter().enumerate() {
        let pt = sqlx::query_as::<_, LabPanelTest>(
            "INSERT INTO lab_panel_tests \
             (tenant_id, panel_id, test_id, sort_order) \
             VALUES ($1, $2, $3, $4) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(panel.id)
        .bind(test_id)
        .bind(i as i32)
        .fetch_one(&mut *tx)
        .await?;
        tests.push(pt);
    }

    tx.commit().await?;
    Ok(Json(PanelDetailResponse { panel, tests }))
}

pub async fn update_panel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePanelRequest>,
) -> Result<Json<PanelDetailResponse>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let panel = sqlx::query_as::<_, LabTestPanel>(
        "UPDATE lab_test_panels SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         price = COALESCE($3, price), \
         is_active = COALESCE($4, is_active), \
         updated_at = now() \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.price)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Replace test list if provided
    if let Some(ref test_ids) = body.test_ids {
        sqlx::query("DELETE FROM lab_panel_tests WHERE panel_id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

        for (i, test_id) in test_ids.iter().enumerate() {
            sqlx::query(
                "INSERT INTO lab_panel_tests \
                 (tenant_id, panel_id, test_id, sort_order) \
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(claims.tenant_id)
            .bind(id)
            .bind(test_id)
            .bind(i as i32)
            .execute(&mut *tx)
            .await?;
        }
    }

    let tests = sqlx::query_as::<_, LabPanelTest>(
        "SELECT * FROM lab_panel_tests WHERE panel_id = $1 AND tenant_id = $2 \
         ORDER BY sort_order LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PanelDetailResponse { panel, tests }))
}

pub async fn delete_panel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM lab_test_panels WHERE id = $1 AND tenant_id = $2")
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
//  Sample Rejection
// ══════════════════════════════════════════════════════════

pub async fn reject_sample(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RejectSampleRequest>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::results::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Back to `ordered`, not `cancelled`.
    //
    // Rejecting a specimen says the tube was unusable -- haemolysed, clotted,
    // underfilled, mislabelled -- not that the test is no longer wanted. The
    // doctor still wants it. Cancelling is a different act and already has its
    // own handler, and `cancelled` is terminal: nothing transitions out of it,
    // `collect_sample` only accepts `ordered`, and no route clones a rejected
    // order. So a haemolysed tube used to end the test permanently and the
    // order simply vanished, recoverable only by somebody noticing a result
    // that never came and hand-raising a new one.
    //
    // Returning it to `ordered` puts it back on the collection list, where the
    // rejection row and `rejection_reason` say why it is there again. No new
    // status value is invented for this: `lab_order_status` is matched
    // exhaustively by hardcoded lists in billing, quality and print, and a new
    // member would go missing from several of them.
    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         status = 'ordered'::lab_order_status, \
         rejection_reason = $1, \
         collected_at = NULL, collected_by = NULL, sample_barcode = NULL, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
           AND status IN ('ordered'::lab_order_status, 'sample_collected'::lab_order_status) \
         RETURNING *",
    )
    .bind(&body.rejection_reason)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Record rejection details
    sqlx::query(
        "INSERT INTO lab_sample_rejections \
         (tenant_id, order_id, rejected_by, rejection_reason) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(&body.rejection_reason)
    .execute(&mut *tx)
    .await?;

    // Put the reason where the person redrawing will actually be looking.
    //
    // The order goes back on the collection list, and the phlebotomist works
    // from the phlebotomy queue rather than the order screen. Without this the
    // reason sits one click away on a screen they have no reason to open, and
    // an unmarked re-draw repeats the collection error that caused the
    // rejection -- the same wrong tube, the same insufficient volume, a second
    // needle in the same patient for nothing.
    sqlx::query(
        "UPDATE lab_phlebotomy_queue SET \
         status = 'waiting'::lab_phlebotomy_status, \
         notes = $1, \
         started_at = NULL, completed_at = NULL, updated_at = now() \
         WHERE order_id = $2 AND tenant_id = $3 AND deleted_at IS NULL",
    )
    .bind(format!("Re-draw — previous sample rejected: {}", body.rejection_reason))
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Somebody has to be told, because somebody has to go and stick the
    // patient again. Every other consequential act in this file notifies the
    // responsible clinician -- verification, amendment, a critical value --
    // and rejection, the one event that requires a person to physically act,
    // was silent. The ward found out when a result never arrived.
    let recipient: Uuid = sqlx::query_scalar(
        "SELECT COALESCE( \
           (SELECT doctor_id FROM encounters WHERE id = $1 AND tenant_id = $2), $3)",
    )
    .bind(order.encounter_id)
    .bind(claims.tenant_id)
    .bind(order.ordered_by)
    .fetch_one(&mut *tx)
    .await?;
    let body_text = format!(
        "{} - a fresh sample is needed. The order is back on the collection list.",
        body.rejection_reason
    );
    create_notification(
        &mut tx,
        claims.tenant_id,
        NewNotification {
            user_id: recipient,
            kind: "warning",
            title: "Lab sample rejected",
            body: Some(&body_text),
            category: Some("Lab"),
            entity_type: Some("lab_order"),
            entity_id: Some(id),
            action_url: Some("/lab"),
        },
    )
    .await?;

    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::LabSampleRejected,
        order.id,
        claims.sub,
        serde_json::json!({
            "order_id": order.id,
            "patient_id": order.patient_id,
            "encounter_id": order.encounter_id,
            "test_id": order.test_id,
            "rejection_reason": body.rejection_reason,
        }),
    )
    .with_patient(order.patient_id)
    .with_encounter(order.encounter_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Amendments
// ══════════════════════════════════════════════════════════

pub async fn amend_result(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<AmendResultRequest>,
) -> Result<Json<LabResultAmendment>, AppError> {
    require_permission(&claims, permissions::lab::results::AMEND)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    // NABL/CAP: every amendment to a reported diagnostic value must carry a documented
    // reason — a lab result cannot be silently changed.
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest(
            "A reason is required to amend a lab result.".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Check report not locked
    let order =
        sqlx::query_as::<_, LabOrder>("SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2")
            .bind(order_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    if order.is_report_locked {
        return Err(AppError::Conflict("Report is locked".to_owned()));
    }

    // A cancelled order's results are void and must not be amended — mirrors the guard on
    // result entry (add_results). A verified result IS the expected amendment target, so it
    // stays allowed.
    if matches!(order.status, medbrains_core::lab::LabOrderStatus::Cancelled) {
        return Err(AppError::Conflict(
            "This lab order is cancelled — its results are void and cannot be amended.".to_owned(),
        ));
    }

    // Get original result
    let original = sqlx::query_as::<_, LabResult>(
        "SELECT * FROM lab_results WHERE id = $1 AND order_id = $2 AND tenant_id = $3",
    )
    .bind(body.result_id)
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Create amendment record
    let amendment = sqlx::query_as::<_, LabResultAmendment>(
        "INSERT INTO lab_result_amendments \
         (tenant_id, result_id, order_id, original_value, amended_value, \
          original_flag, amended_flag, reason, amended_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::lab_result_flag, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.result_id)
    .bind(order_id)
    .bind(&original.value)
    .bind(&body.amended_value)
    .bind(
        original
            .flag
            .as_ref()
            .map(|f| format!("{f:?}").to_lowercase()),
    )
    .bind(&body.amended_flag)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Update the result itself
    sqlx::query(
        "UPDATE lab_results SET value = $1, flag = $2::lab_result_flag \
         WHERE id = $3 AND tenant_id = $4",
    )
    .bind(&body.amended_value)
    .bind(&body.amended_flag)
    .bind(body.result_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Set report status to amended
    sqlx::query(
        "UPDATE lab_orders SET report_status = 'amended'::lab_report_status, \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // A corrected report must be communicated to the clinician who may have already acted on the
    // wrong value (CAP/NABL corrected-report reporting). Notify the responsible clinician (encounter
    // doctor, else ordering provider); skip when the amender is that clinician (no self-noise).
    let recipient: Uuid = sqlx::query_scalar(
        "SELECT COALESCE( \
           (SELECT doctor_id FROM encounters WHERE id = $1 AND tenant_id = $2), $3)",
    )
    .bind(order.encounter_id)
    .bind(claims.tenant_id)
    .bind(order.ordered_by)
    .fetch_one(&mut *tx)
    .await?;
    let corrected_body =
        format!("{} was amended — review the corrected report.", original.parameter_name);
    if recipient != claims.sub {
        create_notification(
            &mut tx,
            claims.tenant_id,
            NewNotification {
                user_id: recipient,
                kind: "warning",
                title: "Lab result corrected",
                body: Some(&corrected_body),
                category: Some("Lab"),
                entity_type: Some("lab_order"),
                entity_id: Some(order_id),
                action_url: Some("/lab"),
            },
        )
        .await?;
    }

    // If the amendment makes the value critical, re-fire the critical-results loop so the corrected
    // critical value is acknowledged/escalated like any other — an amendment must not let a critical
    // value slip through unacknowledged.
    let amended_is_critical = body
        .amended_flag
        .as_deref()
        .is_some_and(|f| f == "critical_low" || f == "critical_high");
    if amended_is_critical {
        sqlx::query(
            "INSERT INTO lab_critical_alerts \
             (tenant_id, order_id, result_id, patient_id, parameter_name, value, flag, \
              notified_to, notified_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7::lab_result_flag, $8, now())",
        )
        .bind(claims.tenant_id)
        .bind(order_id)
        .bind(body.result_id)
        .bind(order.patient_id)
        .bind(&original.parameter_name)
        .bind(&body.amended_value)
        .bind(body.amended_flag.as_deref())
        .bind(recipient)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(amendment))
}

pub async fn list_amendments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Vec<LabResultAmendment>>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabResultAmendment>(
        "SELECT * FROM lab_result_amendments \
         WHERE order_id = $1 AND tenant_id = $2 ORDER BY amended_at DESC LIMIT 5000",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Critical Alerts
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CriticalAlertQuery {
    pub order_id: Option<Uuid>,
    /// `false` asks for the ones still outstanding, which is what every
    /// caller actually wants.
    pub acknowledged: Option<bool>,
}

/// The outstanding critical values.
///
/// This returned the last hundred alerts in the tenant, acknowledged or not,
/// including soft-deleted ones -- and `trg_lab_critical_alerts_soft_delete`
/// means rows never leave the table, so the window fills with dead ones. Both
/// callers then filtered in the browser: the ward banner dropped the
/// acknowledged, and the order screen kept only its own order's.
///
/// A filter applied after a LIMIT is not a filter. An unacknowledged
/// potassium from yesterday falls out of the hundred as soon as the
/// laboratory logs a hundred more, and the screen then says there are no
/// critical values -- which is a statement about the window, printed as a
/// statement about the patient.
pub async fn list_critical_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<CriticalAlertQuery>,
) -> Result<Json<Vec<LabCriticalAlert>>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabCriticalAlert>(
        "SELECT * FROM lab_critical_alerts \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND ($2::uuid IS NULL OR order_id = $2::uuid) \
            AND ($3::bool IS NULL OR (acknowledged_at IS NOT NULL) = $3::bool) \
          ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(params.order_id)
    .bind(params.acknowledged)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AcknowledgeCriticalAlertRequest {
    /// The value the clinician reads back — must match the reported result (NABL closed-loop).
    pub readback_value: String,
}

pub async fn acknowledge_critical_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(alert_id): Path<Uuid>,
    Json(body): Json<AcknowledgeCriticalAlertRequest>,
) -> Result<Json<LabCriticalAlert>, AppError> {
    require_permission(&claims, permissions::lab::results::UPDATE)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_CRITICAL_ALERT,
        alert_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing = sqlx::query_as::<_, LabCriticalAlert>(
        "SELECT * FROM lab_critical_alerts \
         WHERE id = $1 AND tenant_id = $2 AND acknowledged_at IS NULL FOR UPDATE",
    )
    .bind(alert_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // NABL read-back: the acknowledging clinician must re-state the exact reported value.
    let readback = body.readback_value.trim();
    if readback.is_empty() {
        return Err(AppError::BadRequest(
            "Read-back value is required to acknowledge a critical result.".to_owned(),
        ));
    }
    if !readback.eq_ignore_ascii_case(existing.value.trim()) {
        return Err(AppError::BadRequest(format!(
            "Read-back mismatch — you entered '{readback}' but the reported result is '{}'. \
             Confirm the value before acknowledging.",
            existing.value.trim()
        )));
    }

    let alert = sqlx::query_as::<_, LabCriticalAlert>(
        "UPDATE lab_critical_alerts SET \
         acknowledged_by = $1, acknowledged_at = now(), \
         readback_value = $4, readback_verified = true \
         WHERE id = $2 AND tenant_id = $3 AND acknowledged_at IS NULL \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(alert_id)
    .bind(claims.tenant_id)
    .bind(readback)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(alert))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Report Status & Lock
// ══════════════════════════════════════════════════════════

pub async fn update_report_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<UpdateReportStatusRequest>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::results::UPDATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         report_status = $1::lab_report_status, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND is_report_locked = false \
         RETURNING *",
    )
    .bind(&body.report_status)
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(order))
}

pub async fn lock_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::results::UPDATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET \
         is_report_locked = true, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND is_report_locked = false \
         RETURNING *",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    match order {
        Some(o) => {
            tx.commit().await?;
            Ok(Json(o))
        }
        None => Err(AppError::BadRequest(
            "Report already locked or not found".to_owned(),
        )),
    }
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Cumulative Report & TAT Monitoring
// ══════════════════════════════════════════════════════════

pub async fn get_cumulative_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, test_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<CumulativeReportResponse>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;
    // The path names the patient outright, and this is their whole trend for one
    // test — fifty results over time. `lab.reports.view` said the caller may read
    // lab reports, not whose.
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CumulativeResultRow>(
        "SELECT lr.order_id, lr.parameter_name, lr.value, \
         lr.flag::text AS flag, lr.created_at \
         FROM lab_results lr \
         JOIN lab_orders lo ON lr.order_id = lo.id AND lo.tenant_id = lr.tenant_id \
         WHERE lo.patient_id = $1 AND lo.test_id = $2 AND lo.tenant_id = $3 \
           AND lr.deleted_at IS NULL AND lo.deleted_at IS NULL \
         ORDER BY lr.created_at DESC LIMIT 50",
    )
    .bind(patient_id)
    .bind(test_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(CumulativeReportResponse {
        patient_id,
        test_id,
        results: rows,
    }))
}

pub async fn get_tat_monitoring(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TatMonitoringRow>>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TatMonitoringRow>(
        "SELECT id AS order_id, test_id, patient_id, \
         expected_tat_minutes, \
         EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - created_at))::bigint / 60 \
           AS actual_minutes, \
         CASE WHEN expected_tat_minutes IS NOT NULL \
              AND EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - created_at)) / 60 \
                  > expected_tat_minutes \
              THEN true ELSE false END AS is_breached, \
         created_at AS ordered_at, \
         completed_at \
         FROM lab_orders WHERE tenant_id = $1 \
           AND status NOT IN ('cancelled'::lab_order_status) \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Reagent Lots
// ══════════════════════════════════════════════════════════

pub async fn list_reagent_lots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabReagentLot>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabReagentLot>(
        "SELECT * FROM lab_reagent_lots WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_reagent_lot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReagentLotRequest>,
) -> Result<Json<LabReagentLot>, AppError> {
    require_permission(&claims, permissions::lab::qc::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabReagentLot>(
        "INSERT INTO lab_reagent_lots \
         (tenant_id, reagent_name, lot_number, manufacturer, test_id, \
          received_date, expiry_date, quantity, quantity_unit, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.reagent_name)
    .bind(&body.lot_number)
    .bind(&body.manufacturer)
    .bind(body.test_id)
    .bind(body.received_date)
    .bind(body.expiry_date)
    .bind(body.quantity)
    .bind(&body.quantity_unit)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_reagent_lot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReagentLotRequest>,
) -> Result<Json<LabReagentLot>, AppError> {
    require_permission(&claims, permissions::lab::qc::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabReagentLot>(
        "UPDATE lab_reagent_lots SET \
         reagent_name = COALESCE($1, reagent_name), \
         manufacturer = COALESCE($2, manufacturer), \
         test_id = COALESCE($3, test_id), \
         expiry_date = COALESCE($4, expiry_date), \
         quantity = COALESCE($5, quantity), \
         quantity_unit = COALESCE($6, quantity_unit), \
         is_active = COALESCE($7, is_active), \
         notes = COALESCE($8, notes) \
         WHERE id = $9 AND tenant_id = $10 \
         RETURNING *",
    )
    .bind(&body.reagent_name)
    .bind(&body.manufacturer)
    .bind(body.test_id)
    .bind(body.expiry_date)
    .bind(body.quantity)
    .bind(&body.quantity_unit)
    .bind(body.is_active)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — QC Results
// ══════════════════════════════════════════════════════════

pub async fn list_qc_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFilterQuery>,
) -> Result<Json<Vec<LabQcResult>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(test_id) = params.test_id {
        sqlx::query_as::<_, LabQcResult>(
            "SELECT * FROM lab_qc_results WHERE tenant_id = $1 AND test_id = $2 \
             ORDER BY run_time DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .bind(test_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LabQcResult>(
            "SELECT * FROM lab_qc_results WHERE tenant_id = $1 \
             ORDER BY run_time DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ReviewQcResultRequest {
    /// Required, and not optional as it first shipped.
    ///
    /// This review releases patient results against a control run that
    /// failed. NABL and ISO 15189 want the reason evidenced, and an optional
    /// field that falls back to whatever was typed when the run was created
    /// -- usually nothing, for a rejected run -- is not evidence of anything.
    pub reviewer_notes: String,
}

/// Record that a supervisor has looked at a QC run.
///
/// `reviewed_by` had no writer anywhere and there was no route to set it, so
/// supervisory review of quality control was unrecorded -- which NABL and
/// ISO 15189 both expect to see evidenced.
///
/// It is also the release valve for the check in `verify_results`: a rejected
/// run holds every result for that test until somebody with `lab.qc.manage`
/// has looked at it and said why it is acceptable to proceed. Without this the
/// hold would have no way out but a database edit.
pub async fn review_qc_result(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewQcResultRequest>,
) -> Result<Json<LabQcResult>, AppError> {
    require_permission(&claims, permissions::lab::qc::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The reviewer is not the person who ran the control. Reviewing one's own
    // failed run is the same signature twice.
    let reason = body.reviewer_notes.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Say why this failed run is acceptable to proceed on. The reason is the record that \
             the results released against it were released deliberately."
                .to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, LabQcResult>(
        "UPDATE lab_qc_results SET \
         reviewed_by = $1, \
         reviewer_notes = $2 \
         WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL \
           AND performed_by IS DISTINCT FROM $1 \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(reason)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(row) = row else {
        // Either it is not there, or the caller ran it themselves. Both are
        // refusals a reviewer can act on without being told which.
        return Err(AppError::BadRequest(
            "This QC run cannot be reviewed by you. A run is reviewed by somebody other than the \
             person who performed it."
                .to_owned(),
        ));
    };

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_qc_result(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateQcResultRequest>,
) -> Result<Json<LabQcResult>, AppError> {
    require_permission(&claims, permissions::lab::qc::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut sd_index: Option<Decimal> = None;
    let mut status = westgard::ACCEPTED;
    let mut westgard_violations: Vec<String> = Vec::new();

    if let (Some(mean), Some(sd), Some(obs)) =
        (body.target_mean, body.target_sd, body.observed_value)
    {
        if sd != Decimal::ZERO {
            let sdi = (obs - mean) / sd;
            sd_index = Some(sdi);

            // The runs before this one, for the same test, lot and level.
            // Four of the six rules are about a sequence, and nothing used to
            // fetch it, so they could never fire.
            //
            // Nine is the most any rule needs -- 10x counts this run plus
            // nine -- so the query is bounded there rather than reading a
            // lot's whole history to look at its tail.
            let history = sqlx::query_scalar::<_, Option<f64>>(
                "SELECT sd_index::float8 FROM lab_qc_results \
                  WHERE tenant_id = $1 AND test_id = $2 AND lot_id = $3 AND level = $4 \
                    AND sd_index IS NOT NULL AND deleted_at IS NULL \
                  ORDER BY run_date DESC NULLS LAST, run_time DESC \
                  LIMIT 9",
            )
            .bind(claims.tenant_id)
            .bind(body.test_id)
            .bind(body.lot_id)
            .bind(&body.level)
            .fetch_all(&mut *tx)
            .await?
            .into_iter()
            .flatten()
            .collect::<Vec<f64>>();

            let sdi_f64 = f64::try_from(sdi).unwrap_or(0.0);
            let evaluation = westgard::evaluate(sdi_f64, &history);
            status = evaluation.status;
            westgard_violations = evaluation
                .violations
                .into_iter()
                .map(ToOwned::to_owned)
                .collect();
        }
    }

    let violations_val: Option<Vec<String>> = if westgard_violations.is_empty() {
        None
    } else {
        Some(westgard_violations)
    };

    let row = sqlx::query_as::<_, LabQcResult>(
        "INSERT INTO lab_qc_results \
         (tenant_id, test_id, lot_id, level, target_mean, target_sd, \
          observed_value, sd_index, status, \
          westgard_violations, run_date, performed_by, reviewer_notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \
                 $9::lab_qc_status, \
                 $10::lab_westgard_rule[], $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.test_id)
    .bind(body.lot_id)
    .bind(&body.level)
    .bind(body.target_mean)
    .bind(body.target_sd)
    .bind(body.observed_value)
    .bind(sd_index)
    .bind(status)
    .bind(violations_val.as_deref())
    .bind(body.run_date)
    .bind(claims.sub)
    .bind(&body.reviewer_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Calibrations
// ══════════════════════════════════════════════════════════

pub async fn list_calibrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabCalibration>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabCalibration>(
        "SELECT * FROM lab_calibrations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_calibration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCalibrationRequest>,
) -> Result<Json<LabCalibration>, AppError> {
    require_permission(&claims, permissions::lab::qc::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabCalibration>(
        "INSERT INTO lab_calibrations \
         (tenant_id, test_id, instrument_name, calibrator_lot, \
          calibration_date, next_calibration_date, result_summary, \
          is_passed, performed_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, false), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.test_id)
    .bind(&body.instrument_name)
    .bind(&body.calibrator_lot)
    .bind(body.calibration_date)
    .bind(body.next_calibration_date)
    .bind(&body.result_summary)
    .bind(body.is_passed)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Phlebotomy Queue
// ══════════════════════════════════════════════════════════

pub async fn list_phlebotomy_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabPhlebotomyQueue>>, AppError> {
    require_permission(&claims, permissions::lab::phlebotomy::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabPhlebotomyQueue>(
        "SELECT * FROM lab_phlebotomy_queue WHERE tenant_id = $1 \
         ORDER BY \
           CASE priority WHEN 'stat'::lab_priority THEN 0 \
                         WHEN 'urgent'::lab_priority THEN 1 \
                         ELSE 2 END, \
           queued_at ASC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_phlebotomy_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePhlebotomyEntryRequest>,
) -> Result<Json<LabPhlebotomyQueue>, AppError> {
    require_permission(&claims, permissions::lab::phlebotomy::MANAGE)?;
    // This crate already checks the patient on nineteen other paths; these
    // four were the ones that did not.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;

    let priority = normalize_lab_priority(body.priority.as_deref())?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabPhlebotomyQueue>(
        "INSERT INTO lab_phlebotomy_queue \
         (tenant_id, order_id, patient_id, priority, location_id, notes) \
         VALUES ($1, $2, $3, $4::lab_priority, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(priority)
    .bind(body.location_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_phlebotomy_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePhlebotomyStatusRequest>,
) -> Result<Json<LabPhlebotomyQueue>, AppError> {
    require_permission(&claims, permissions::lab::phlebotomy::MANAGE)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_PHLEBOTOMY_QUEUE,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Set started_at/completed_at/assigned_to based on status transition
    let row = match body.status.as_str() {
        "in_progress" => {
            sqlx::query_as::<_, LabPhlebotomyQueue>(
                "UPDATE lab_phlebotomy_queue SET \
                 status = 'in_progress'::lab_phlebotomy_status, \
                 assigned_to = $1, started_at = now() \
                 WHERE id = $2 AND tenant_id = $3 \
                   AND status = 'waiting'::lab_phlebotomy_status \
                 RETURNING *",
            )
            .bind(claims.sub)
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
        }
        "completed" => {
            sqlx::query_as::<_, LabPhlebotomyQueue>(
                "UPDATE lab_phlebotomy_queue SET \
                 status = 'completed'::lab_phlebotomy_status, \
                 completed_at = now() \
                 WHERE id = $1 AND tenant_id = $2 \
                   AND status = 'in_progress'::lab_phlebotomy_status \
                 RETURNING *",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
        }
        "skipped" => {
            sqlx::query_as::<_, LabPhlebotomyQueue>(
                "UPDATE lab_phlebotomy_queue SET \
                 status = 'skipped'::lab_phlebotomy_status \
                 WHERE id = $1 AND tenant_id = $2 \
                   AND status IN ('waiting'::lab_phlebotomy_status, \
                                  'in_progress'::lab_phlebotomy_status) \
                 RETURNING *",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
        }
        _ => return Err(AppError::BadRequest("Invalid status".to_owned())),
    };

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Outsourced Orders
// ══════════════════════════════════════════════════════════

pub async fn list_outsourced_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabOutsourcedOrder>>, AppError> {
    require_permission(&claims, permissions::lab::outsourced::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LabOutsourcedOrder>(
        "SELECT * FROM lab_outsourced_orders WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_outsourced_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOutsourcedOrderRequest>,
) -> Result<Json<LabOutsourcedOrder>, AppError> {
    require_permission(&claims, permissions::lab::outsourced::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Mark the lab order as outsourced
    sqlx::query(
        "UPDATE lab_orders SET is_outsourced = true, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, LabOutsourcedOrder>(
        "INSERT INTO lab_outsourced_orders \
         (tenant_id, order_id, external_lab_name, external_lab_code, \
          sent_date, expected_return_date, cost, notes, sent_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(&body.external_lab_name)
    .bind(&body.external_lab_code)
    .bind(body.sent_date)
    .bind(body.expected_return_date)
    .bind(body.cost)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_outsourced_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOutsourcedOrderRequest>,
) -> Result<Json<LabOutsourcedOrder>, AppError> {
    require_permission(&claims, permissions::lab::outsourced::MANAGE)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_OUTSOURCED_ORDER,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabOutsourcedOrder>(
        "UPDATE lab_outsourced_orders SET \
         status = COALESCE($1::lab_outsource_status, status), \
         actual_return_date = COALESCE($2, actual_return_date), \
         external_ref_number = COALESCE($3, external_ref_number), \
         cost = COALESCE($4, cost), \
         notes = COALESCE($5, notes), \
         received_by = CASE WHEN $1 = 'result_received' THEN $6 ELSE received_by END \
         WHERE id = $7 AND tenant_id = $8 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(body.actual_return_date)
    .bind(&body.external_ref_number)
    .bind(body.cost)
    .bind(&body.notes)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Add-on Test
// ══════════════════════════════════════════════════════════

pub async fn add_on_test(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(parent_order_id): Path<Uuid>,
    Json(body): Json<AddOnTestRequest>,
) -> Result<Json<LabOrder>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        parent_order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get parent order
    let parent =
        sqlx::query_as::<_, LabOrder>("SELECT * FROM lab_orders WHERE id = $1 AND tenant_id = $2")
            .bind(parent_order_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    // Cannot add-on to a cancelled order
    if parent.status == medbrains_core::lab::LabOrderStatus::Cancelled {
        return Err(AppError::BadRequest(
            "Cannot add-on to cancelled order".to_owned(),
        ));
    }

    let priority = normalize_lab_priority(body.priority.as_deref())?;

    let order = sqlx::query_as::<_, LabOrder>(
        "INSERT INTO lab_orders \
         (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
          status, priority, notes, parent_order_id) \
         VALUES ($1, $2, $3, $4, $5, 'ordered'::lab_order_status, \
                 $6::lab_priority, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(parent.encounter_id)
    .bind(parent.patient_id)
    .bind(body.test_id)
    .bind(claims.sub)
    .bind(priority)
    .bind(&body.notes)
    .bind(parent_order_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    grant_lab_order_creator_viewer(&state, &claims, order.id, "lab_add_on_order_created").await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateHomeCollectionRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub scheduled_date: NaiveDate,
    pub scheduled_time_slot: Option<String>,
    pub address_line: String,
    pub city: Option<String>,
    pub pincode: Option<String>,
    pub contact_phone: Option<String>,
    pub special_instructions: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHomeCollectionRequest {
    pub assigned_phlebotomist: Option<Uuid>,
    pub scheduled_date: Option<NaiveDate>,
    pub scheduled_time_slot: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HomeCollectionStatusRequest {
    pub status: String,
    /// Required when moving to `collected`: the same positive identification
    /// the ward draw demands. Optional in the type only because the other
    /// status transitions -- scheduling, cancelling -- are not a draw.
    pub patient_identifier: Option<String>,
    /// The label on the tube. The phlebotomist's app has always scanned this
    /// and then thrown it away.
    pub sample_barcode: Option<String>,
    /// The app has always sent this and the handler has always dropped it.
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HomeCollectionQuery {
    pub status: Option<String>,
    pub date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCollectionCenterRequest {
    pub code: String,
    pub name: String,
    pub center_type: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub contact_person: Option<String>,
    pub operating_hours: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCollectionCenterRequest {
    pub name: Option<String>,
    pub center_type: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub contact_person: Option<String>,
    pub is_active: Option<bool>,
    pub operating_hours: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSampleArchiveRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub sample_barcode: Option<String>,
    pub storage_location: Option<String>,
    pub disposal_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SampleArchiveQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportDispatchRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub dispatch_method: String,
    pub dispatched_to: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportDispatchQuery {
    pub order_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportTemplateRequest {
    pub department_id: Option<Uuid>,
    pub template_name: String,
    pub header_html: Option<String>,
    pub footer_html: Option<String>,
    pub logo_url: Option<String>,
    pub report_format: Option<serde_json::Value>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReportTemplateRequest {
    pub template_name: Option<String>,
    pub header_html: Option<String>,
    pub footer_html: Option<String>,
    pub logo_url: Option<String>,
    pub report_format: Option<serde_json::Value>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ReportTemplateQuery {
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEqasRequest {
    pub program_name: String,
    pub provider: Option<String>,
    pub test_id: Uuid,
    pub cycle: Option<String>,
    pub sample_number: Option<String>,
    pub expected_value: Option<Decimal>,
    pub reported_value: Option<Decimal>,
    pub evaluation: Option<String>,
    pub bias_percent: Option<Decimal>,
    pub z_score: Option<Decimal>,
    pub report_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEqasRequest {
    pub evaluation: Option<String>,
    pub reported_value: Option<Decimal>,
    pub bias_percent: Option<Decimal>,
    pub z_score: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EqasQuery {
    pub test_id: Option<Uuid>,
    pub program: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProficiencyTestRequest {
    pub program: String,
    pub test_id: Uuid,
    pub survey_round: Option<String>,
    pub sample_id: Option<String>,
    pub assigned_value: Option<Decimal>,
    pub reported_value: Option<Decimal>,
    pub acceptable_range_low: Option<Decimal>,
    pub acceptable_range_high: Option<Decimal>,
    pub is_acceptable: Option<bool>,
    pub evaluation_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNablDocumentRequest {
    pub document_type: String,
    pub document_number: String,
    pub title: String,
    pub version: Option<String>,
    pub effective_date: Option<NaiveDate>,
    pub review_date: Option<NaiveDate>,
    pub file_path: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNablDocumentRequest {
    pub title: Option<String>,
    pub version: Option<String>,
    pub effective_date: Option<NaiveDate>,
    pub review_date: Option<NaiveDate>,
    pub file_path: Option<String>,
    pub is_current: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NablDocumentQuery {
    pub document_type: Option<String>,
    pub current_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHistopathRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub specimen_type: Option<String>,
    pub clinical_history: Option<String>,
    pub gross_description: Option<String>,
    pub microscopy_findings: Option<String>,
    pub special_stains: Option<serde_json::Value>,
    pub immunohistochemistry: Option<serde_json::Value>,
    pub synoptic_data: Option<serde_json::Value>,
    pub diagnosis: Option<String>,
    pub icd_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCytologyRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub specimen_type: Option<String>,
    pub clinical_indication: Option<String>,
    pub adequacy: Option<String>,
    pub screening_findings: Option<String>,
    pub diagnosis: Option<String>,
    pub bethesda_category: Option<String>,
    pub icd_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMolecularRequest {
    pub order_id: Uuid,
    pub patient_id: Uuid,
    pub test_method: Option<String>,
    pub target_gene: Option<String>,
    pub primer_details: Option<String>,
    pub amplification_data: Option<serde_json::Value>,
    pub ct_value: Option<Decimal>,
    pub result_interpretation: Option<String>,
    pub quantitative_value: Option<Decimal>,
    pub quantitative_unit: Option<String>,
    pub kit_name: Option<String>,
    pub kit_lot: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateB2bClientRequest {
    pub code: String,
    pub name: String,
    pub client_type: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub contact_person: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub payment_terms_days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateB2bClientRequest {
    pub name: Option<String>,
    pub client_type: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub contact_person: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub payment_terms_days: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateB2bRateRequest {
    pub test_id: Uuid,
    pub agreed_price: Option<Decimal>,
    pub discount_percent: Option<Decimal>,
    pub effective_from: Option<NaiveDate>,
    pub effective_to: Option<NaiveDate>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeCollectionStatsRow {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReagentConsumptionRow {
    pub id: Uuid,
    pub reagent_name: String,
    pub lot_number: String,
    pub quantity: Option<Decimal>,
    pub quantity_unit: Option<String>,
    pub reorder_level: Option<Decimal>,
    pub consumption_per_test: Option<Decimal>,
    pub expiry_date: Option<NaiveDate>,
    pub is_active: bool,
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Home Collections
// ══════════════════════════════════════════════════════════

pub async fn list_home_collections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<HomeCollectionQuery>,
) -> Result<Json<Vec<LabHomeCollection>>, AppError> {
    require_permission(&claims, permissions::lab::samples::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, LabHomeCollection>(
            "SELECT * FROM lab_home_collections \
             WHERE tenant_id = $1 AND status::text = $2 \
             ORDER BY scheduled_date, created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(date) = params.date {
        sqlx::query_as::<_, LabHomeCollection>(
            "SELECT * FROM lab_home_collections \
             WHERE tenant_id = $1 AND scheduled_date = $2 \
             ORDER BY created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(date)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LabHomeCollection>(
            "SELECT * FROM lab_home_collections WHERE tenant_id = $1 \
             ORDER BY scheduled_date DESC, created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_home_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHomeCollectionRequest>,
) -> Result<Json<LabHomeCollection>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabHomeCollection>(
        "INSERT INTO lab_home_collections \
         (tenant_id, order_id, patient_id, scheduled_date, scheduled_time_slot, \
          address_line, city, pincode, contact_phone, special_instructions) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(body.scheduled_date)
    .bind(&body.scheduled_time_slot)
    .bind(&body.address_line)
    .bind(&body.city)
    .bind(&body.pincode)
    .bind(&body.contact_phone)
    .bind(&body.special_instructions)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_home_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateHomeCollectionRequest>,
) -> Result<Json<LabHomeCollection>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_HOME_COLLECTION,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabHomeCollection>(
        "UPDATE lab_home_collections SET \
         assigned_phlebotomist = COALESCE($1, assigned_phlebotomist), \
         scheduled_date = COALESCE($2, scheduled_date), \
         scheduled_time_slot = COALESCE($3, scheduled_time_slot), \
         notes = COALESCE($4, notes) \
         WHERE id = $5 AND tenant_id = $6 RETURNING *",
    )
    .bind(body.assigned_phlebotomist)
    .bind(body.scheduled_date)
    .bind(&body.scheduled_time_slot)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_home_collection_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<HomeCollectionStatusRequest>,
) -> Result<Json<LabHomeCollection>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;

    // The draw at somebody's address is still a clinical act on their record.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_HOME_COLLECTION,
        id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let is_collection = body.status == "collected";
    let collected_at = if is_collection { "now()" } else { "collected_at" };
    let sql = format!(
        "UPDATE lab_home_collections SET \
         status = $1::lab_home_collection_status, collected_at = {collected_at}, \
         notes = COALESCE($4, notes), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 RETURNING *"
    );
    let row = sqlx::query_as::<_, LabHomeCollection>(&sql)
        .bind(&body.status)
        .bind(id)
        .bind(claims.tenant_id)
        .bind(&body.notes)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    // The order itself was never touched here. A home draw left `lab_orders`
    // sitting at `ordered` for ever -- never collected, never processed,
    // never reportable -- while the visit record said the sample was taken,
    // and the tube's barcode, which every analyzer match keys on, was
    // discarded by the app that scanned it.
    if is_collection {
        mark_order_collected(
            &mut tx,
            &claims,
            row.order_id,
            body.patient_identifier.as_deref().unwrap_or_default(),
            body.sample_barcode.as_deref(),
        )
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_home_collection_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HomeCollectionStatsRow>>, AppError> {
    require_permission(&claims, permissions::lab::samples::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, HomeCollectionStatsRow>(
        "SELECT status::text AS status, COUNT(*) AS count \
         FROM lab_home_collections WHERE tenant_id = $1 \
         GROUP BY status ORDER BY status LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Collection Centers
// ══════════════════════════════════════════════════════════

pub async fn list_collection_centers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabCollectionCenter>>, AppError> {
    require_permission(&claims, permissions::lab::samples::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LabCollectionCenter>(
        "SELECT * FROM lab_collection_centers WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_collection_center(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCollectionCenterRequest>,
) -> Result<Json<LabCollectionCenter>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;
    let center_type = body.center_type.as_deref().unwrap_or("hospital");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabCollectionCenter>(
        "INSERT INTO lab_collection_centers \
         (tenant_id, code, name, center_type, address, city, phone, \
          contact_person, operating_hours, notes) \
         VALUES ($1,$2,$3,$4::lab_collection_center_type,$5,$6,$7,$8,$9,$10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(center_type)
    .bind(&body.address)
    .bind(&body.city)
    .bind(&body.phone)
    .bind(&body.contact_person)
    .bind(&body.operating_hours)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_collection_center(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCollectionCenterRequest>,
) -> Result<Json<LabCollectionCenter>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabCollectionCenter>(
        "UPDATE lab_collection_centers SET \
         name = COALESCE($1, name), \
         center_type = COALESCE($2::lab_collection_center_type, center_type), \
         address = COALESCE($3, address), city = COALESCE($4, city), \
         phone = COALESCE($5, phone), contact_person = COALESCE($6, contact_person), \
         is_active = COALESCE($7, is_active), \
         operating_hours = COALESCE($8, operating_hours), notes = COALESCE($9, notes) \
         WHERE id = $10 AND tenant_id = $11 RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.center_type)
    .bind(&body.address)
    .bind(&body.city)
    .bind(&body.phone)
    .bind(&body.contact_person)
    .bind(body.is_active)
    .bind(&body.operating_hours)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Sample Archive
// ══════════════════════════════════════════════════════════

pub async fn list_sample_archive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SampleArchiveQuery>,
) -> Result<Json<Vec<LabSampleArchive>>, AppError> {
    require_permission(&claims, permissions::lab::samples::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, LabSampleArchive>(
            "SELECT * FROM lab_sample_archive WHERE tenant_id = $1 AND status::text = $2 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LabSampleArchive>(
            "SELECT * FROM lab_sample_archive WHERE tenant_id = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_sample_archive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSampleArchiveRequest>,
) -> Result<Json<LabSampleArchive>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabSampleArchive>(
        "INSERT INTO lab_sample_archive \
         (tenant_id, order_id, patient_id, sample_barcode, \
          storage_location, archived_by, disposal_date, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(&body.sample_barcode)
    .bind(&body.storage_location)
    .bind(claims.sub)
    .bind(body.disposal_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn retrieve_sample_archive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LabSampleArchive>, AppError> {
    require_permission(&claims, permissions::lab::samples::MANAGE)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_SAMPLE_ARCHIVE,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabSampleArchive>(
        "UPDATE lab_sample_archive SET \
         status = 'retrieved'::lab_sample_archive_status, \
         retrieved_at = now(), retrieved_by = $1 \
         WHERE id = $2 AND tenant_id = $3 \
           AND status = 'stored'::lab_sample_archive_status RETURNING *",
    )
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Report Dispatches
// ══════════════════════════════════════════════════════════

pub async fn list_report_dispatches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDispatchQuery>,
) -> Result<Json<Vec<LabReportDispatch>>, AppError> {
    require_permission(&claims, permissions::lab::dispatch::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = if let Some(order_id) = params.order_id {
        sqlx::query_as::<_, LabReportDispatch>(
            "SELECT * FROM lab_report_dispatches WHERE tenant_id = $1 AND order_id = $2 \
             ORDER BY dispatched_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(order_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LabReportDispatch>(
            "SELECT * FROM lab_report_dispatches WHERE tenant_id = $1 \
             ORDER BY dispatched_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_report_dispatch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReportDispatchRequest>,
) -> Result<Json<LabReportDispatch>, AppError> {
    require_permission(&claims, permissions::lab::dispatch::MANAGE)?;
    // A dispatch names the patient whose report is being sent out.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabReportDispatch>(
        "INSERT INTO lab_report_dispatches \
         (tenant_id, order_id, patient_id, dispatch_method, dispatched_to, dispatched_by, notes) \
         VALUES ($1,$2,$3,$4::lab_dispatch_method,$5,$6,$7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(&body.dispatch_method)
    .bind(&body.dispatched_to)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn confirm_report_dispatch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<LabReportDispatch>, AppError> {
    require_permission(&claims, permissions::lab::dispatch::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabReportDispatch>(
        "UPDATE lab_report_dispatches SET received_confirmation = true, confirmed_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Report Templates
// ══════════════════════════════════════════════════════════

pub async fn list_report_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportTemplateQuery>,
) -> Result<Json<Vec<LabReportTemplateListItem>>, AppError> {
    require_permission(&claims, permissions::lab::dispatch::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // List omits header_html/footer_html/report_format — fetched by id when editing.
    const LIST_COLS: &str = "id, tenant_id, department_id, template_name, logo_url, is_default, \
                             is_active, created_at, updated_at";
    let rows = if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, LabReportTemplateListItem>(&format!(
            "SELECT {LIST_COLS} FROM lab_report_templates WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY template_name LIMIT 5000"
        ))
        .bind(claims.tenant_id)
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LabReportTemplateListItem>(&format!(
            "SELECT {LIST_COLS} FROM lab_report_templates WHERE tenant_id = $1 ORDER BY template_name LIMIT 5000"
        ))
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_report_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReportTemplateRequest>,
) -> Result<Json<LabReportTemplate>, AppError> {
    require_permission(&claims, permissions::lab::dispatch::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabReportTemplate>(
        "INSERT INTO lab_report_templates \
         (tenant_id, department_id, template_name, header_html, footer_html, \
          logo_url, report_format, is_default) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, false)) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(&body.template_name)
    .bind(&body.header_html)
    .bind(&body.footer_html)
    .bind(&body.logo_url)
    .bind(&body.report_format)
    .bind(body.is_default)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_report_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReportTemplateRequest>,
) -> Result<Json<LabReportTemplate>, AppError> {
    require_permission(&claims, permissions::lab::dispatch::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabReportTemplate>(
        "UPDATE lab_report_templates SET \
         template_name = COALESCE($1, template_name), \
         header_html = COALESCE($2, header_html), footer_html = COALESCE($3, footer_html), \
         logo_url = COALESCE($4, logo_url), report_format = COALESCE($5, report_format), \
         is_default = COALESCE($6, is_default), is_active = COALESCE($7, is_active) \
         WHERE id = $8 AND tenant_id = $9 RETURNING *",
    )
    .bind(&body.template_name)
    .bind(&body.header_html)
    .bind(&body.footer_html)
    .bind(&body.logo_url)
    .bind(&body.report_format)
    .bind(body.is_default)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — STAT Orders
// ══════════════════════════════════════════════════════════

pub async fn list_stat_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TatMonitoringRow>>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, TatMonitoringRow>(
        "SELECT id AS order_id, test_id, patient_id, expected_tat_minutes, \
         EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - created_at))::bigint / 60 \
           AS actual_minutes, \
         CASE WHEN expected_tat_minutes IS NOT NULL \
              AND EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - created_at)) / 60 \
                  > expected_tat_minutes THEN true ELSE false END AS is_breached, \
         created_at AS ordered_at, completed_at \
         FROM lab_orders WHERE tenant_id = $1 \
           AND (is_stat = true OR priority = 'stat'::lab_priority \
                OR priority = 'urgent'::lab_priority) \
           AND status NOT IN ('cancelled'::lab_order_status) \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — EQAS
// ══════════════════════════════════════════════════════════

pub async fn list_eqas(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<EqasQuery>,
) -> Result<Json<Vec<LabEqasResult>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = if let Some(test_id) = params.test_id {
        sqlx::query_as::<_, LabEqasResult>(
            "SELECT * FROM lab_eqas_results WHERE tenant_id = $1 AND test_id = $2 \
             ORDER BY created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(test_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, LabEqasResult>(
            "SELECT * FROM lab_eqas_results WHERE tenant_id = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_eqas(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEqasRequest>,
) -> Result<Json<LabEqasResult>, AppError> {
    require_permission(&claims, permissions::lab::qc::CREATE)?;
    let evaluation = body.evaluation.as_deref().unwrap_or("pending");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabEqasResult>(
        "INSERT INTO lab_eqas_results \
         (tenant_id, program_name, provider, test_id, cycle, sample_number, \
          expected_value, reported_value, evaluation, bias_percent, z_score, \
          report_date, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::lab_eqas_evaluation,$10,$11,$12,$13) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.program_name)
    .bind(&body.provider)
    .bind(body.test_id)
    .bind(&body.cycle)
    .bind(&body.sample_number)
    .bind(body.expected_value)
    .bind(body.reported_value)
    .bind(evaluation)
    .bind(body.bias_percent)
    .bind(body.z_score)
    .bind(body.report_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_eqas(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEqasRequest>,
) -> Result<Json<LabEqasResult>, AppError> {
    require_permission(&claims, permissions::lab::qc::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabEqasResult>(
        "UPDATE lab_eqas_results SET \
         evaluation = COALESCE($1::lab_eqas_evaluation, evaluation), \
         reported_value = COALESCE($2, reported_value), \
         bias_percent = COALESCE($3, bias_percent), \
         z_score = COALESCE($4, z_score), notes = COALESCE($5, notes) \
         WHERE id = $6 AND tenant_id = $7 RETURNING *",
    )
    .bind(&body.evaluation)
    .bind(body.reported_value)
    .bind(body.bias_percent)
    .bind(body.z_score)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Proficiency Testing
// ══════════════════════════════════════════════════════════

pub async fn list_proficiency_tests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabProficiencyTest>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LabProficiencyTest>(
        "SELECT * FROM lab_proficiency_tests WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_proficiency_test(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateProficiencyTestRequest>,
) -> Result<Json<LabProficiencyTest>, AppError> {
    require_permission(&claims, permissions::lab::qc::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabProficiencyTest>(
        "INSERT INTO lab_proficiency_tests \
         (tenant_id, program, test_id, survey_round, sample_id, assigned_value, \
          reported_value, acceptable_range_low, acceptable_range_high, \
          is_acceptable, evaluation_date, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.program)
    .bind(body.test_id)
    .bind(&body.survey_round)
    .bind(&body.sample_id)
    .bind(body.assigned_value)
    .bind(body.reported_value)
    .bind(body.acceptable_range_low)
    .bind(body.acceptable_range_high)
    .bind(body.is_acceptable)
    .bind(body.evaluation_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — NABL Documents
// ══════════════════════════════════════════════════════════

pub async fn list_nabl_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<NablDocumentQuery>,
) -> Result<Json<Vec<LabNablDocument>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current_only = params.current_only.unwrap_or(false);
    let rows = match (&params.document_type, current_only) {
        (Some(doc_type), true) => {
            sqlx::query_as::<_, LabNablDocument>(
                "SELECT * FROM lab_nabl_documents \
                 WHERE tenant_id = $1 AND document_type = $2 AND is_current = true \
                 ORDER BY effective_date DESC LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .bind(doc_type)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(doc_type), false) => {
            sqlx::query_as::<_, LabNablDocument>(
                "SELECT * FROM lab_nabl_documents \
                 WHERE tenant_id = $1 AND document_type = $2 ORDER BY effective_date DESC LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .bind(doc_type)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, true) => {
            sqlx::query_as::<_, LabNablDocument>(
                "SELECT * FROM lab_nabl_documents \
                 WHERE tenant_id = $1 AND is_current = true \
                 ORDER BY document_type, effective_date DESC LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, false) => {
            sqlx::query_as::<_, LabNablDocument>(
                "SELECT * FROM lab_nabl_documents WHERE tenant_id = $1 \
                 ORDER BY document_type, effective_date DESC LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_nabl_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNablDocumentRequest>,
) -> Result<Json<LabNablDocument>, AppError> {
    require_permission(&claims, permissions::lab::qc::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabNablDocument>(
        "INSERT INTO lab_nabl_documents \
         (tenant_id, document_type, document_number, title, version, \
          effective_date, review_date, approved_by, file_path, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.document_type)
    .bind(&body.document_number)
    .bind(&body.title)
    .bind(&body.version)
    .bind(body.effective_date)
    .bind(body.review_date)
    .bind(claims.sub)
    .bind(&body.file_path)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_nabl_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNablDocumentRequest>,
) -> Result<Json<LabNablDocument>, AppError> {
    require_permission(&claims, permissions::lab::qc::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabNablDocument>(
        "UPDATE lab_nabl_documents SET \
         title = COALESCE($1, title), version = COALESCE($2, version), \
         effective_date = COALESCE($3, effective_date), \
         review_date = COALESCE($4, review_date), \
         file_path = COALESCE($5, file_path), \
         is_current = COALESCE($6, is_current), notes = COALESCE($7, notes) \
         WHERE id = $8 AND tenant_id = $9 RETURNING *",
    )
    .bind(&body.title)
    .bind(&body.version)
    .bind(body.effective_date)
    .bind(body.review_date)
    .bind(&body.file_path)
    .bind(body.is_current)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Reagent Consumption Report
// ══════════════════════════════════════════════════════════

pub async fn get_reagent_consumption(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ReagentConsumptionRow>>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ReagentConsumptionRow>(
        "SELECT id, reagent_name, lot_number, quantity, quantity_unit, \
         reorder_level, consumption_per_test, expiry_date, is_active \
         FROM lab_reagent_lots WHERE tenant_id = $1 AND is_active = true \
         ORDER BY reagent_name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Specialized Reports (Histopath / Cytology / Molecular)
// ══════════════════════════════════════════════════════════

pub async fn get_histopath_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabHistopathReport>, AppError> {
    require_permission(&claims, permissions::lab::specialized::LIST)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabHistopathReport>(
        "SELECT * FROM lab_histopath_reports WHERE order_id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_histopath_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHistopathRequest>,
) -> Result<Json<LabHistopathReport>, AppError> {
    require_permission(&claims, permissions::lab::specialized::CREATE)?;
    // A pathology report is a diagnosis written onto somebody's record, and the
    // patient came from the request body. `lab.specialized.create` said the
    // caller may write specialised reports, not for whom.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabHistopathReport>(
        "INSERT INTO lab_histopath_reports \
         (tenant_id, order_id, patient_id, specimen_type, clinical_history, \
          gross_description, microscopy_findings, special_stains, \
          immunohistochemistry, synoptic_data, diagnosis, icd_code, \
          pathologist_id, reported_at, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),$14) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(&body.specimen_type)
    .bind(&body.clinical_history)
    .bind(&body.gross_description)
    .bind(&body.microscopy_findings)
    .bind(&body.special_stains)
    .bind(&body.immunohistochemistry)
    .bind(&body.synoptic_data)
    .bind(&body.diagnosis)
    .bind(&body.icd_code)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_cytology_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabCytologyReport>, AppError> {
    require_permission(&claims, permissions::lab::specialized::LIST)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabCytologyReport>(
        "SELECT * FROM lab_cytology_reports WHERE order_id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_cytology_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCytologyRequest>,
) -> Result<Json<LabCytologyReport>, AppError> {
    require_permission(&claims, permissions::lab::specialized::CREATE)?;
    // A pathology report is a diagnosis written onto somebody's record, and the
    // patient came from the request body. `lab.specialized.create` said the
    // caller may write specialised reports, not for whom.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabCytologyReport>(
        "INSERT INTO lab_cytology_reports \
         (tenant_id, order_id, patient_id, specimen_type, clinical_indication, \
          adequacy, screening_findings, diagnosis, bethesda_category, \
          cytopathologist_id, reported_at, icd_code, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(&body.specimen_type)
    .bind(&body.clinical_indication)
    .bind(&body.adequacy)
    .bind(&body.screening_findings)
    .bind(&body.diagnosis)
    .bind(&body.bethesda_category)
    .bind(claims.sub)
    .bind(&body.icd_code)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_molecular_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabMolecularReport>, AppError> {
    require_permission(&claims, permissions::lab::specialized::LIST)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabMolecularReport>(
        "SELECT * FROM lab_molecular_reports WHERE order_id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_molecular_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMolecularRequest>,
) -> Result<Json<LabMolecularReport>, AppError> {
    require_permission(&claims, permissions::lab::specialized::CREATE)?;
    // A pathology report is a diagnosis written onto somebody's record, and the
    // patient came from the request body. `lab.specialized.create` said the
    // caller may write specialised reports, not for whom.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabMolecularReport>(
        "INSERT INTO lab_molecular_reports \
         (tenant_id, order_id, patient_id, test_method, target_gene, primer_details, \
          amplification_data, ct_value, result_interpretation, quantitative_value, \
          quantitative_unit, kit_name, kit_lot, performed_by, reported_at, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(body.patient_id)
    .bind(&body.test_method)
    .bind(&body.target_gene)
    .bind(&body.primer_details)
    .bind(&body.amplification_data)
    .bind(body.ct_value)
    .bind(&body.result_interpretation)
    .bind(body.quantitative_value)
    .bind(&body.quantitative_unit)
    .bind(&body.kit_name)
    .bind(&body.kit_lot)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — B2B Clients & Rates
// ══════════════════════════════════════════════════════════

pub async fn list_b2b_clients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LabB2bClient>>, AppError> {
    require_permission(&claims, permissions::lab::b2b::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LabB2bClient>(
        "SELECT * FROM lab_b2b_clients WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_b2b_client(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateB2bClientRequest>,
) -> Result<Json<LabB2bClient>, AppError> {
    require_permission(&claims, permissions::lab::b2b::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabB2bClient>(
        "INSERT INTO lab_b2b_clients \
         (tenant_id, code, name, client_type, address, city, phone, \
          email, contact_person, credit_limit, payment_terms_days) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, 30)) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.client_type)
    .bind(&body.address)
    .bind(&body.city)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.contact_person)
    .bind(body.credit_limit)
    .bind(body.payment_terms_days)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_b2b_client(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateB2bClientRequest>,
) -> Result<Json<LabB2bClient>, AppError> {
    require_permission(&claims, permissions::lab::b2b::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabB2bClient>(
        "UPDATE lab_b2b_clients SET \
         name = COALESCE($1, name), client_type = COALESCE($2, client_type), \
         address = COALESCE($3, address), city = COALESCE($4, city), \
         phone = COALESCE($5, phone), email = COALESCE($6, email), \
         contact_person = COALESCE($7, contact_person), \
         credit_limit = COALESCE($8, credit_limit), \
         payment_terms_days = COALESCE($9, payment_terms_days), \
         is_active = COALESCE($10, is_active) \
         WHERE id = $11 AND tenant_id = $12 RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.client_type)
    .bind(&body.address)
    .bind(&body.city)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.contact_person)
    .bind(body.credit_limit)
    .bind(body.payment_terms_days)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_b2b_rates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(client_id): Path<Uuid>,
) -> Result<Json<Vec<LabB2bRate>>, AppError> {
    require_permission(&claims, permissions::lab::b2b::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LabB2bRate>(
        "SELECT * FROM lab_b2b_rates WHERE tenant_id = $1 AND client_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(client_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_b2b_rate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(client_id): Path<Uuid>,
    Json(body): Json<CreateB2bRateRequest>,
) -> Result<Json<LabB2bRate>, AppError> {
    require_permission(&claims, permissions::lab::b2b::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, LabB2bRate>(
        "INSERT INTO lab_b2b_rates \
         (tenant_id, client_id, test_id, agreed_price, discount_percent, \
          effective_from, effective_to) \
         VALUES ($1,$2,$3,$4,$5,$6,$7) \
         ON CONFLICT (tenant_id, client_id, test_id) \
         DO UPDATE SET agreed_price = EXCLUDED.agreed_price, \
           discount_percent = EXCLUDED.discount_percent, \
           effective_from = EXCLUDED.effective_from, \
           effective_to = EXCLUDED.effective_to, updated_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(client_id)
    .bind(body.test_id)
    .bind(body.agreed_price)
    .bind(body.discount_percent)
    .bind(body.effective_from)
    .bind(body.effective_to)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Auto-Validation
// ══════════════════════════════════════════════════════════

pub async fn auto_validate_result(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::results::CREATE)?;
    // Releasing a result is a clinical act on somebody's record. The patient is
    // two hops off the path id — result, order, patient.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_RESULT,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query_as::<_, LabResult>("SELECT * FROM lab_results WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let order = sqlx::query_as::<_, LabOrder>("SELECT * FROM lab_orders WHERE id = $1")
        .bind(result.order_id)
        .fetch_one(&mut *tx)
        .await?;

    // Judged exactly as `add_results` judges it at entry.
    //
    // This used to test the value against `lab_test_catalog.critical_low ..
    // critical_high` -- the panic bounds, not the reference range -- and call
    // anything between them validated. A potassium of 6.4 against a critical
    // high of 6.5 is grossly abnormal, and was auto-validated here while the
    // entry path flagged it: the same column meant two different things
    // depending on which code last wrote it. Most of the catalog carries no
    // critical bounds at all, so for most tests this answered a flat no.
    let band = patient_lab_band(&mut tx, claims.tenant_id, order.patient_id).await?;
    let verdict =
        auto_flag(&mut tx, claims.tenant_id, &result.parameter_name, &result.value, &band).await?;

    // A technologist's own flag still stands: the reference table is a second
    // opinion, never an override of the person who looked at the sample.
    let flag_permits = matches!(result.flag, None | Some(LabResultFlag::Normal));
    let is_valid = flag_permits && !result.is_delta_flagged && verdict == RefVerdict::InRange;

    if is_valid {
        sqlx::query("UPDATE lab_results SET is_auto_validated = true WHERE id = $1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "result_id": id,
        "auto_validated": is_valid,
        "message": if is_valid {
            "Result auto-validated against the reference range"
        } else if verdict == RefVerdict::Unknown {
            "No reference range covers this result - manual review required"
        } else {
            "Result outside the reference range - manual review required"
        }
    })))
}

// ══════════════════════════════════════════════════════════
//  Doctor Critical Alerts
// ══════════════════════════════════════════════════════════

pub async fn list_doctor_critical_alerts(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(doctor_id): Path<Uuid>,
) -> Result<Json<Vec<LabCriticalAlert>>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;

    // The path names whose list this is, and it was not checked against who
    // was asking. Any holder of `lab.orders.list` -- a receptionist, a
    // technologist -- could pass any doctor's id and read that doctor's
    // patients' panic values, names and results included.
    //
    // 404 rather than 403: a refusal that distinguishes "not allowed" from
    // "no such doctor" is an existence oracle.
    if doctor_id != claims.sub && !is_bypass_role(&claims) {
        return Err(AppError::NotFound);
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Every join is tenant-scoped explicitly. The tenant context is set, so
    // RLS should already contain this, but this query named no tenant on any
    // of its three tables and a table whose policy is missing would have
    // leaked across the whole deployment rather than one doctor.
    let rows = sqlx::query_as::<_, LabCriticalAlert>(
        "SELECT ca.* FROM lab_critical_alerts ca \
         JOIN lab_orders lo ON lo.id = ca.order_id AND lo.tenant_id = ca.tenant_id \
         JOIN encounters e ON e.id = lo.encounter_id AND e.tenant_id = lo.tenant_id \
         WHERE ca.tenant_id = $2 AND e.doctor_id = $1 \
           AND ca.deleted_at IS NULL \
         ORDER BY ca.created_at DESC \
         LIMIT 50",
    )
    .bind(doctor_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TatAnalyticsRow {
    pub test_name: String,
    pub total_orders: i64,
    pub avg_tat_minutes: Option<f64>,
    pub p95_tat_minutes: Option<f64>,
    pub within_sla: i64,
}

pub async fn get_tat_analytics(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<TatAnalyticsRow>>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TatAnalyticsRow>(
        "SELECT tc.name AS test_name, \
                COUNT(*)::bigint AS total_orders, \
                AVG(EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60.0)::float8 \
                    AS avg_tat_minutes, \
                PERCENTILE_CONT(0.95) WITHIN GROUP \
                    (ORDER BY EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60.0)::float8 \
                    AS p95_tat_minutes, \
                COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (lo.completed_at - lo.created_at)) / 60.0 \
                    <= COALESCE(tc.tat_hours * 60, 120))::bigint AS within_sla \
         FROM lab_orders lo \
         JOIN lab_test_catalog tc ON tc.id = lo.test_id \
         WHERE lo.completed_at IS NOT NULL \
           AND lo.completed_at >= CURRENT_DATE - INTERVAL '30 days' \
         GROUP BY tc.name \
         ORDER BY total_orders DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Order Cross-match Link
// ══════════════════════════════════════════════════════════

pub async fn get_order_crossmatch(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;

    // The URL names a child record; the care relationship is one hop away on
    // its parent. Resolve then authorize — see medbrains_authz_gate::links.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, LabOrder>("SELECT * FROM lab_orders WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let crossmatches = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json) FROM ( \
         SELECT cr.id, cr.component_id, \
            cr.result::text, cr.status::text, cr.created_at \
         FROM crossmatch_requests cr \
         WHERE cr.patient_id = $1 \
         ) r",
    )
    .bind(order.patient_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "order_id": id,
        "patient_id": order.patient_id,
        "crossmatch_requests": crossmatches
    })))
}

// ══════════════════════════════════════════════════════════
//  Phase 4: Analyzer Worklist, Referral, B2B Credit, Bulk Print
// ══════════════════════════════════════════════════════════

/// GET /api/lab/analyzer-worklist — pending orders formatted for analyzer consumption
pub async fn get_analyzer_worklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyzerWorklistQuery>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    // lab.orders.list is held by audit_officer, doctor, lab_technician,
    // nurse and quality_officer — and quality_officer does not hold
    // patients.view. A bench worklist needs the barcode and the order, not
    // the name, so the name is blanked for whoever cannot see one anywhere
    // else. Checked against roles.rs rather than assumed: a redaction whose
    // gate no caller can fail is decoration, and this crate has one of
    // those in list_rx_queue's neighbour module.
    let can_view_patient_identity =
        claims_have_any_permission(&claims, &[permissions::patients::VIEW]);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Department scoping is taken from the encounter, not the lab order
    // (lab_orders has no direct department_id). Optional filter joins
    // through encounters when a department is provided.
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Option<String>,
            String,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        "SELECT lo.id, lo.patient_id, lo.sample_barcode, \
         COALESCE(p.first_name || ' ' || p.last_name, p.first_name), lo.created_at \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id \
         LEFT JOIN encounters e ON e.id = lo.encounter_id AND e.tenant_id = lo.tenant_id \
         WHERE lo.tenant_id = $2 \
           AND lo.status IN ('ordered', 'sample_collected') \
           AND ($1::uuid IS NULL OR e.department_id = $1) \
         ORDER BY lo.priority DESC, lo.created_at ASC \
         LIMIT 100",
    )
    .bind(params.department_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let worklist: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "order_id": r.0,
                "patient_id": r.1,
                "sample_barcode": r.2.as_deref().unwrap_or(""),
                "patient_name": if can_view_patient_identity {
                    r.3.clone()
                } else {
                    "Restricted".to_owned()
                },
                "ordered_at": r.4,
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(worklist))
}

#[derive(Debug, serde::Deserialize)]
pub struct AnalyzerWorklistQuery {
    pub department_id: Option<Uuid>,
}

/// PUT /api/lab/phlebotomy/{id}/assign — assign phlebotomist
pub async fn assign_phlebotomist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignPhlebotomistRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::phlebotomy::MANAGE)?;

    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_PHLEBOTOMY_QUEUE,
        id,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("UPDATE lab_phlebotomy_queue SET assigned_to = $2 WHERE id = $1")
        .bind(id)
        .bind(body.assigned_to)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"status": "assigned"})))
}

#[derive(Debug, serde::Deserialize)]
pub struct AssignPhlebotomistRequest {
    pub assigned_to: Uuid,
}

/// POST /api/lab/reports/bulk-print — batch print multiple reports
pub async fn bulk_print_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BulkPrintRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut dispatched = 0;
    for order_id in &body.order_ids {
        sqlx::query(
            "INSERT INTO lab_report_dispatches (tenant_id, order_id, dispatch_method, dispatched_at, dispatched_by) \
             VALUES ($1, $2, 'counter', now(), $3) ON CONFLICT DO NOTHING",
        )
        .bind(claims.tenant_id).bind(order_id).bind(claims.sub)
        .execute(&mut *tx).await?;
        dispatched += 1;
    }

    tx.commit().await?;
    Ok(Json(
        serde_json::json!({"dispatched": dispatched, "total": body.order_ids.len()}),
    ))
}

#[derive(Debug, serde::Deserialize)]
pub struct BulkPrintRequest {
    pub order_ids: Vec<Uuid>,
}

/// GET /api/lab/report-delivery-config
pub async fn get_report_delivery_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let config: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id=$1 AND category='lab' AND key='report_delivery_config'",
    ).bind(claims.tenant_id).fetch_optional(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(config.unwrap_or(serde_json::json!({
        "sms_enabled": false, "whatsapp_enabled": false, "email_enabled": false,
        "auto_dispatch": false, "default_method": "counter"
    }))))
}

/// PUT /api/lab/report-delivery-config
pub async fn update_report_delivery_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO tenant_settings (id,tenant_id,category,key,value) \
         VALUES (gen_random_uuid(),$1,'lab','report_delivery_config',$2) \
         ON CONFLICT (tenant_id,category,key) DO UPDATE SET value=$2,updated_at=now()",
    )
    .bind(claims.tenant_id)
    .bind(&body)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(body))
}

/// GET /api/lab/referral-doctors
pub async fn list_referral_doctors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::lab::b2b::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<f64>,
            bool,
        ),
    >(
        // Tenant-scoped explicitly. These three carried no tenant predicate at
        // all and leaned entirely on RLS; on a table whose policy is missing
        // that is a cross-tenant read of who refers to whom and what they are
        // paid for it.
        "SELECT id, name, phone, specialization, hospital_name, commission_pct, is_active \
         FROM lab_referral_doctors WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let result: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0, "name": r.1, "phone": r.2, "specialization": r.3,
                "hospital_name": r.4, "commission_pct": r.5, "is_active": r.6
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

/// POST /api/lab/referral-doctors
pub async fn create_referral_doctor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::b2b::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO lab_referral_doctors (tenant_id, name, phone, specialization, hospital_name, commission_pct) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body["name"].as_str().unwrap_or(""))
    .bind(body["phone"].as_str())
    .bind(body["specialization"].as_str())
    .bind(body["hospital_name"].as_str())
    .bind(body["commission_pct"].as_f64())
    .fetch_one(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"id": id, "status": "created"})))
}

/// PUT /api/lab/referral-doctors/{id}
pub async fn update_referral_doctor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::b2b::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE lab_referral_doctors SET \
         name=COALESCE($2,name), phone=COALESCE($3,phone), \
         specialization=COALESCE($4,specialization), hospital_name=COALESCE($5,hospital_name), \
         commission_pct=COALESCE($6,commission_pct), is_active=COALESCE($7,is_active) \
         WHERE id=$1",
    )
    .bind(id)
    .bind(body["name"].as_str())
    .bind(body["phone"].as_str())
    .bind(body["specialization"].as_str())
    .bind(body["hospital_name"].as_str())
    .bind(body["commission_pct"].as_f64())
    .bind(body["is_active"].as_bool())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"id": id, "status": "updated"})))
}

/// GET /api/lab/referral-payouts
pub async fn list_referral_payouts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::lab::b2b::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            NaiveDate,
            NaiveDate,
            i32,
            Decimal,
            Decimal,
            String,
        ),
    >(
        "SELECT p.id, p.referral_doctor_id, p.period_start, p.period_end, \
         p.order_count, p.total_revenue, p.commission_amount, p.status::text \
         FROM lab_referral_payouts p WHERE p.tenant_id = $1 \
         ORDER BY p.period_end DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let result: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0, "referral_doctor_id": r.1, "period_start": r.2, "period_end": r.3,
                "order_count": r.4, "total_revenue": r.5, "commission_amount": r.6, "status": r.7
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

/// POST /api/lab/referral-payouts
pub async fn create_referral_payout(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::lab::b2b::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO lab_referral_payouts (tenant_id, referral_doctor_id, period_start, period_end, order_count, total_revenue, commission_amount) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body["referral_doctor_id"].as_str().and_then(|s| Uuid::parse_str(s).ok()))
    .bind(body["period_start"].as_str().and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()))
    .bind(body["period_end"].as_str().and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()))
    .bind(body["order_count"].as_i64().unwrap_or(0) as i32)
    .bind(body["total_revenue"].as_f64().unwrap_or(0.0))
    .bind(body["commission_amount"].as_f64().unwrap_or(0.0))
    .fetch_one(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"id": id, "status": "created"})))
}

/// GET /api/lab/b2b-credit-summary
pub async fn get_b2b_credit_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::lab::b2b::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, (Uuid, String, Option<Decimal>, Option<Decimal>, Option<i32>)>(
        "SELECT id, name, credit_limit, credit_used, payment_terms_days \
         FROM lab_b2b_clients WHERE tenant_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let result: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0, "name": r.1, "credit_limit": r.2, "credit_used": r.3,
                "credit_available": r.2.unwrap_or_default() - r.3.unwrap_or_default(),
                "payment_terms_days": r.4
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

/// Laboratory (orders, samples, results, catalog, QC) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/lab/home-collections",
            get(list_home_collections).post(create_home_collection),
        )
        .route(
            "/api/lab/home-collections/stats",
            get(get_home_collection_stats),
        )
        .route(
            "/api/lab/home-collections/{id}",
            put(update_home_collection),
        )
        .route(
            "/api/lab/home-collections/{id}/status",
            post(update_home_collection_status),
        )
        .route(
            "/api/lab/collection-centers",
            get(list_collection_centers).post(create_collection_center),
        )
        .route(
            "/api/lab/collection-centers/{id}",
            put(update_collection_center),
        )
        .route(
            "/api/lab/sample-archive",
            get(list_sample_archive).post(create_sample_archive),
        )
        .route(
            "/api/lab/sample-archive/{id}/retrieve",
            post(retrieve_sample_archive),
        )
        .route(
            "/api/lab/report-dispatches",
            get(list_report_dispatches).post(create_report_dispatch),
        )
        .route(
            "/api/lab/report-dispatches/{id}/confirm",
            post(confirm_report_dispatch),
        )
        .route(
            "/api/lab/report-templates",
            get(list_report_templates).post(create_report_template),
        )
        .route(
            "/api/lab/report-templates/{id}",
            put(update_report_template),
        )
        .route(
            "/api/lab/stat-orders",
            get(list_stat_orders),
        )
        .route(
            "/api/lab/eqas",
            get(list_eqas).post(create_eqas),
        )
        .route(
            "/api/lab/eqas/{id}",
            put(update_eqas),
        )
        .route(
            "/api/lab/proficiency-tests",
            get(list_proficiency_tests).post(create_proficiency_test),
        )
        .route(
            "/api/lab/nabl-documents",
            get(list_nabl_documents).post(create_nabl_document),
        )
        .route(
            "/api/lab/nabl-documents/{id}",
            put(update_nabl_document),
        )
        .route(
            "/api/lab/reagent-consumption",
            get(get_reagent_consumption),
        )
        .route(
            "/api/lab/histopath/{order_id}",
            get(get_histopath_report),
        )
        .route(
            "/api/lab/histopath",
            post(create_histopath_report),
        )
        .route(
            "/api/lab/cytology/{order_id}",
            get(get_cytology_report),
        )
        .route(
            "/api/lab/cytology",
            post(create_cytology_report),
        )
        .route(
            "/api/lab/molecular/{order_id}",
            get(get_molecular_report),
        )
        .route(
            "/api/lab/molecular",
            post(create_molecular_report),
        )
        .route(
            "/api/lab/b2b-clients",
            get(list_b2b_clients).post(create_b2b_client),
        )
        .route(
            "/api/lab/b2b-clients/{id}",
            put(update_b2b_client),
        )
        .route(
            "/api/lab/b2b-clients/{id}/rates",
            get(list_b2b_rates).post(create_b2b_rate),
        )
        // Phase 2 static routes (MUST be before /orders/{id})
        .route(
            "/api/lab/critical-alerts",
            get(list_critical_alerts),
        )
        .route(
            "/api/lab/critical-alerts/{id}/acknowledge",
            put(acknowledge_critical_alert),
        )
        .route(
            "/api/lab/tat-monitoring",
            get(get_tat_monitoring),
        )
        .route(
            "/api/lab/reagent-lots",
            get(list_reagent_lots).post(create_reagent_lot),
        )
        .route(
            "/api/lab/reagent-lots/{id}",
            put(update_reagent_lot),
        )
        .route(
            "/api/lab/qc-results",
            get(list_qc_results).post(create_qc_result),
        )
        .route("/api/lab/qc-results/{id}/review", put(review_qc_result))
        .route(
            "/api/lab/calibrations",
            get(list_calibrations).post(create_calibration),
        )
        .route(
            "/api/lab/phlebotomy-queue",
            get(list_phlebotomy_queue).post(create_phlebotomy_entry),
        )
        .route(
            "/api/lab/phlebotomy-queue/{id}/status",
            put(update_phlebotomy_status),
        )
        .route(
            "/api/lab/outsourced",
            get(list_outsourced_orders).post(create_outsourced_order),
        )
        .route(
            "/api/lab/outsourced/{id}",
            put(update_outsourced_order),
        )
        .route(
            "/api/lab/patients/{pid}/cumulative/{test_id}",
            get(get_cumulative_report),
        )
        // Phase 4 Lab routes
        .route("/api/lab/analyzer-worklist", get(get_analyzer_worklist))
        .route("/api/lab/phlebotomy/{id}/assign", put(assign_phlebotomist))
        .route("/api/lab/reports/bulk-print", post(bulk_print_reports))
        .route("/api/lab/report-delivery-config", get(get_report_delivery_config).put(update_report_delivery_config))
        .route("/api/lab/referral-doctors", get(list_referral_doctors).post(create_referral_doctor))
        .route("/api/lab/referral-doctors/{id}", put(update_referral_doctor))
        .route("/api/lab/referral-payouts", get(list_referral_payouts).post(create_referral_payout))
        .route("/api/lab/b2b-credit-summary", get(get_b2b_credit_summary))
        // Phase 1 Lab routes
        .route(
            "/api/lab/orders",
            get(list_orders).post(create_order),
        )
        .route(
            "/api/lab/orders/{id}",
            get(get_order),
        )
        .route(
            "/api/lab/orders/{id}/collect",
            put(collect_sample),
        )
        .route(
            "/api/lab/orders/{id}/process",
            put(start_processing),
        )
        .route(
            "/api/lab/orders/{id}/complete",
            put(complete_order),
        )
        .route(
            "/api/lab/orders/{id}/verify",
            put(verify_results),
        )
        .route(
            "/api/lab/orders/{id}/cancel",
            put(cancel_order),
        )
        .route(
            "/api/lab/orders/{id}/results",
            get(list_results).post(add_results),
        )
        .route(
            "/api/lab/orders/{id}/results/amend",
            post(amend_result),
        )
        .route(
            "/api/lab/orders/{id}/amendments",
            get(list_amendments),
        )
        .route(
            "/api/lab/orders/{id}/report-status",
            put(update_report_status),
        )
        .route(
            "/api/lab/orders/{id}/lock-report",
            put(lock_report),
        )
        .route(
            "/api/lab/orders/{id}/add-on",
            post(add_on_test),
        )
        .route(
            "/api/lab/orders/{id}/reject",
            put(reject_sample),
        )
        .route(
            "/api/lab/catalog",
            get(list_catalog).post(create_catalog_entry),
        )
        .route(
            "/api/lab/catalog/{id}",
            put(update_catalog_entry),
        )
        .route(
            "/api/lab/panels",
            get(list_panels).post(create_panel),
        )
        .route(
            "/api/lab/panels/{id}",
            get(get_panel).put(update_panel).delete(delete_panel),
        )
        .route(
            "/api/lab/results/{id}/auto-validate",
            post(auto_validate_result),
        )
        .route(
            "/api/lab/critical-alerts/doctor/{doctor_id}",
            get(list_doctor_critical_alerts),
        )
        .route(
            "/api/lab/analytics/tat",
            get(get_tat_analytics),
        )
        .route(
            "/api/lab/orders/{id}/crossmatch",
            get(get_order_crossmatch),
        )
}
