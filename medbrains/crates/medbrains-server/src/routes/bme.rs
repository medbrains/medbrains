#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::bme::{
    BmeBreakdown, BmeCalibration, BmeContract, BmeEquipment, BmePmSchedule, BmeVendorEvaluation,
    BmeWorkOrder,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Equipment ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEquipmentQuery {
    pub status: Option<String>,
    pub department_id: Option<Uuid>,
    pub risk_category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEquipmentRequest {
    pub name: String,
    pub make: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub asset_tag: Option<String>,
    pub barcode_value: Option<String>,
    pub category: Option<String>,
    pub sub_category: Option<String>,
    pub risk_category: Option<String>,
    pub is_critical: Option<bool>,
    pub department_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub facility_id: Option<Uuid>,
    pub status: Option<String>,
    pub purchase_date: Option<NaiveDate>,
    pub purchase_cost: Option<Decimal>,
    pub installation_date: Option<NaiveDate>,
    pub commissioned_date: Option<NaiveDate>,
    pub installed_by: Option<String>,
    pub commissioning_notes: Option<String>,
    pub expected_life_years: Option<i32>,
    pub warranty_start_date: Option<NaiveDate>,
    pub warranty_end_date: Option<NaiveDate>,
    pub warranty_terms: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub manufacturer_contact: Option<String>,
    pub specifications: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEquipmentRequest {
    pub name: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub asset_tag: Option<String>,
    pub barcode_value: Option<String>,
    pub category: Option<String>,
    pub sub_category: Option<String>,
    pub risk_category: Option<String>,
    pub is_critical: Option<bool>,
    pub department_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub facility_id: Option<Uuid>,
    pub status: Option<String>,
    pub purchase_date: Option<NaiveDate>,
    pub purchase_cost: Option<Decimal>,
    pub installation_date: Option<NaiveDate>,
    pub commissioned_date: Option<NaiveDate>,
    pub installed_by: Option<String>,
    pub commissioning_notes: Option<String>,
    pub expected_life_years: Option<i32>,
    pub condemned_date: Option<NaiveDate>,
    pub disposal_date: Option<NaiveDate>,
    pub disposal_method: Option<String>,
    pub warranty_start_date: Option<NaiveDate>,
    pub warranty_end_date: Option<NaiveDate>,
    pub warranty_terms: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub manufacturer_contact: Option<String>,
    pub specifications: Option<serde_json::Value>,
    pub notes: Option<String>,
}

// ── PM Schedules ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPmSchedulesQuery {
    pub equipment_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePmScheduleRequest {
    pub equipment_id: Uuid,
    pub frequency: String,
    pub checklist: Option<serde_json::Value>,
    pub next_due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePmScheduleRequest {
    pub frequency: Option<String>,
    pub checklist: Option<serde_json::Value>,
    pub next_due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

// ── Work Orders ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListWorkOrdersQuery {
    pub equipment_id: Option<Uuid>,
    pub status: Option<String>,
    pub order_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkOrderRequest {
    pub equipment_id: Uuid,
    pub order_type: String,
    pub priority: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub scheduled_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub pm_schedule_id: Option<Uuid>,
    pub breakdown_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkOrderStatusRequest {
    pub status: String,
    pub findings: Option<String>,
    pub actions_taken: Option<String>,
    pub checklist_results: Option<serde_json::Value>,
    pub labor_cost: Option<Decimal>,
    pub parts_cost: Option<Decimal>,
    pub vendor_cost: Option<Decimal>,
    pub total_cost: Option<Decimal>,
}

// ── Calibrations ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCalibrationsQuery {
    pub equipment_id: Option<Uuid>,
    pub calibration_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCalibrationRequest {
    pub equipment_id: Uuid,
    pub calibration_status: Option<String>,
    pub frequency: Option<String>,
    pub last_calibrated_date: Option<NaiveDate>,
    pub next_due_date: Option<NaiveDate>,
    pub calibrated_by: Option<String>,
    pub calibration_vendor_id: Option<Uuid>,
    pub certificate_number: Option<String>,
    pub certificate_url: Option<String>,
    pub is_in_tolerance: Option<bool>,
    pub deviation_notes: Option<String>,
    pub reference_standard: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCalibrationRequest {
    pub calibration_status: Option<String>,
    pub frequency: Option<String>,
    pub last_calibrated_date: Option<NaiveDate>,
    pub next_due_date: Option<NaiveDate>,
    pub calibrated_by: Option<String>,
    pub calibration_vendor_id: Option<Uuid>,
    pub certificate_number: Option<String>,
    pub certificate_url: Option<String>,
    pub is_in_tolerance: Option<bool>,
    pub deviation_notes: Option<String>,
    pub reference_standard: Option<String>,
    pub is_locked: Option<bool>,
    pub locked_reason: Option<String>,
    pub notes: Option<String>,
}

// ── Contracts ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListContractsQuery {
    pub equipment_id: Option<Uuid>,
    pub contract_type: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateContractRequest {
    pub contract_number: String,
    pub equipment_id: Uuid,
    pub contract_type: String,
    pub vendor_id: Uuid,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub contract_value: Option<Decimal>,
    pub payment_terms: Option<String>,
    pub coverage_details: Option<String>,
    pub exclusions: Option<String>,
    pub sla_response_hours: Option<i32>,
    pub sla_resolution_hours: Option<i32>,
    pub renewal_alert_days: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateContractRequest {
    pub contract_type: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub contract_value: Option<Decimal>,
    pub payment_terms: Option<String>,
    pub coverage_details: Option<String>,
    pub exclusions: Option<String>,
    pub sla_response_hours: Option<i32>,
    pub sla_resolution_hours: Option<i32>,
    pub renewal_alert_days: Option<i32>,
    pub is_renewed: Option<bool>,
    pub renewed_contract_id: Option<Uuid>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

// ── Breakdowns ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListBreakdownsQuery {
    pub equipment_id: Option<Uuid>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBreakdownRequest {
    pub equipment_id: Uuid,
    pub department_id: Option<Uuid>,
    pub priority: Option<String>,
    pub description: String,
    pub downtime_start: Option<String>,
    pub vendor_visit_required: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBreakdownStatusRequest {
    pub status: String,
    pub resolution_notes: Option<String>,
    pub downtime_end: Option<String>,
    pub spare_parts_used: Option<String>,
    pub spare_parts_cost: Option<Decimal>,
    pub vendor_id: Option<Uuid>,
    pub vendor_cost: Option<Decimal>,
    pub total_repair_cost: Option<Decimal>,
}

// ── Vendor Evaluations ────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListVendorEvaluationsQuery {
    pub vendor_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVendorEvaluationRequest {
    pub vendor_id: Uuid,
    pub contract_id: Option<Uuid>,
    pub evaluation_date: NaiveDate,
    pub period_from: Option<NaiveDate>,
    pub period_to: Option<NaiveDate>,
    pub response_time_score: Option<i32>,
    pub resolution_quality_score: Option<i32>,
    pub spare_parts_availability_score: Option<i32>,
    pub professionalism_score: Option<i32>,
    pub overall_score: Option<Decimal>,
    pub total_calls: Option<i32>,
    pub calls_within_sla: Option<i32>,
    pub comments: Option<String>,
}

// ── Stats response ────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BmeStatsResponse {
    pub total_equipment: i64,
    pub active_equipment: i64,
    pub pm_overdue: i64,
    pub calibration_overdue: i64,
    pub open_breakdowns: i64,
    pub expiring_contracts: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Equipment
// ══════════════════════════════════════════════════════════

pub async fn list_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEquipmentQuery>,
) -> Result<Json<Vec<BmeEquipment>>, AppError> {
    require_permission(&claims, permissions::bme::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, BmeEquipment>(
            "SELECT * FROM bme_equipment WHERE department_id = $1 \
             ORDER BY name",
        )
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(status) = params.status {
        sqlx::query_as::<_, BmeEquipment>(
            "SELECT * FROM bme_equipment WHERE status::text = $1 \
             ORDER BY name",
        )
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(risk) = params.risk_category {
        sqlx::query_as::<_, BmeEquipment>(
            "SELECT * FROM bme_equipment WHERE risk_category::text = $1 \
             ORDER BY name",
        )
        .bind(risk)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmeEquipment>(
            "SELECT * FROM bme_equipment ORDER BY name LIMIT 500",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BmeEquipment>, AppError> {
    require_permission(&claims, permissions::bme::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeEquipment>(
        "SELECT * FROM bme_equipment WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEquipmentRequest>,
) -> Result<Json<BmeEquipment>, AppError> {
    require_permission(&claims, permissions::bme::equipment::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeEquipment>(
        "INSERT INTO bme_equipment \
         (tenant_id, name, make, model, serial_number, asset_tag, barcode_value, \
          category, sub_category, risk_category, is_critical, department_id, \
          location_description, facility_id, status, purchase_date, purchase_cost, \
          installation_date, commissioned_date, installed_by, commissioning_notes, \
          expected_life_years, warranty_start_date, warranty_end_date, warranty_terms, \
          vendor_id, manufacturer_contact, specifications, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, \
                 COALESCE($10, 'medium')::bme_risk_category, COALESCE($11, false), $12, \
                 $13, $14, COALESCE($15, 'active')::bme_equipment_status, \
                 $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, \
                 COALESCE($28, '{}'::jsonb), $29, $30) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.make)
    .bind(&body.model)
    .bind(&body.serial_number)
    .bind(&body.asset_tag)
    .bind(&body.barcode_value)
    .bind(&body.category)
    .bind(&body.sub_category)
    .bind(&body.risk_category)
    .bind(body.is_critical)
    .bind(body.department_id)
    .bind(&body.location_description)
    .bind(body.facility_id)
    .bind(&body.status)
    .bind(body.purchase_date)
    .bind(body.purchase_cost)
    .bind(body.installation_date)
    .bind(body.commissioned_date)
    .bind(&body.installed_by)
    .bind(&body.commissioning_notes)
    .bind(body.expected_life_years)
    .bind(body.warranty_start_date)
    .bind(body.warranty_end_date)
    .bind(&body.warranty_terms)
    .bind(body.vendor_id)
    .bind(&body.manufacturer_contact)
    .bind(&body.specifications)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEquipmentRequest>,
) -> Result<Json<BmeEquipment>, AppError> {
    require_permission(&claims, permissions::bme::equipment::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeEquipment>(
        "UPDATE bme_equipment SET \
         name = COALESCE($2, name), make = COALESCE($3, make), \
         model = COALESCE($4, model), serial_number = COALESCE($5, serial_number), \
         asset_tag = COALESCE($6, asset_tag), barcode_value = COALESCE($7, barcode_value), \
         category = COALESCE($8, category), sub_category = COALESCE($9, sub_category), \
         risk_category = COALESCE($10::bme_risk_category, risk_category), \
         is_critical = COALESCE($11, is_critical), \
         department_id = COALESCE($12, department_id), \
         location_description = COALESCE($13, location_description), \
         facility_id = COALESCE($14, facility_id), \
         status = COALESCE($15::bme_equipment_status, status), \
         purchase_date = COALESCE($16, purchase_date), \
         purchase_cost = COALESCE($17, purchase_cost), \
         installation_date = COALESCE($18, installation_date), \
         commissioned_date = COALESCE($19, commissioned_date), \
         installed_by = COALESCE($20, installed_by), \
         commissioning_notes = COALESCE($21, commissioning_notes), \
         expected_life_years = COALESCE($22, expected_life_years), \
         condemned_date = COALESCE($23, condemned_date), \
         disposal_date = COALESCE($24, disposal_date), \
         disposal_method = COALESCE($25, disposal_method), \
         warranty_start_date = COALESCE($26, warranty_start_date), \
         warranty_end_date = COALESCE($27, warranty_end_date), \
         warranty_terms = COALESCE($28, warranty_terms), \
         vendor_id = COALESCE($29, vendor_id), \
         manufacturer_contact = COALESCE($30, manufacturer_contact), \
         specifications = COALESCE($31, specifications), \
         notes = COALESCE($32, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.make)
    .bind(&body.model)
    .bind(&body.serial_number)
    .bind(&body.asset_tag)
    .bind(&body.barcode_value)
    .bind(&body.category)
    .bind(&body.sub_category)
    .bind(&body.risk_category)
    .bind(body.is_critical)
    .bind(body.department_id)
    .bind(&body.location_description)
    .bind(body.facility_id)
    .bind(&body.status)
    .bind(body.purchase_date)
    .bind(body.purchase_cost)
    .bind(body.installation_date)
    .bind(body.commissioned_date)
    .bind(&body.installed_by)
    .bind(&body.commissioning_notes)
    .bind(body.expected_life_years)
    .bind(body.condemned_date)
    .bind(body.disposal_date)
    .bind(&body.disposal_method)
    .bind(body.warranty_start_date)
    .bind(body.warranty_end_date)
    .bind(&body.warranty_terms)
    .bind(body.vendor_id)
    .bind(&body.manufacturer_contact)
    .bind(&body.specifications)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — PM Schedules
// ══════════════════════════════════════════════════════════

pub async fn list_pm_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPmSchedulesQuery>,
) -> Result<Json<Vec<BmePmSchedule>>, AppError> {
    require_permission(&claims, permissions::bme::pm::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(equip_id) = params.equipment_id {
        sqlx::query_as::<_, BmePmSchedule>(
            "SELECT * FROM bme_pm_schedules WHERE equipment_id = $1 \
             ORDER BY next_due_date NULLS LAST",
        )
        .bind(equip_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmePmSchedule>(
            "SELECT * FROM bme_pm_schedules WHERE is_active = COALESCE($1, true) \
             ORDER BY next_due_date NULLS LAST",
        )
        .bind(params.is_active)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_pm_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePmScheduleRequest>,
) -> Result<Json<BmePmSchedule>, AppError> {
    require_permission(&claims, permissions::bme::pm::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmePmSchedule>(
        "INSERT INTO bme_pm_schedules \
         (tenant_id, equipment_id, frequency, checklist, next_due_date, \
          assigned_to, notes) \
         VALUES ($1, $2, $3::bme_pm_frequency, COALESCE($4, '[]'::jsonb), $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.equipment_id)
    .bind(&body.frequency)
    .bind(&body.checklist)
    .bind(body.next_due_date)
    .bind(body.assigned_to)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_pm_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePmScheduleRequest>,
) -> Result<Json<BmePmSchedule>, AppError> {
    require_permission(&claims, permissions::bme::pm::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmePmSchedule>(
        "UPDATE bme_pm_schedules SET \
         frequency = COALESCE($2::bme_pm_frequency, frequency), \
         checklist = COALESCE($3, checklist), \
         next_due_date = COALESCE($4, next_due_date), \
         assigned_to = COALESCE($5, assigned_to), \
         is_active = COALESCE($6, is_active), \
         notes = COALESCE($7, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.frequency)
    .bind(&body.checklist)
    .bind(body.next_due_date)
    .bind(body.assigned_to)
    .bind(body.is_active)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Work Orders
// ══════════════════════════════════════════════════════════

pub async fn list_work_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListWorkOrdersQuery>,
) -> Result<Json<Vec<BmeWorkOrder>>, AppError> {
    require_permission(&claims, permissions::bme::pm::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(equip_id) = params.equipment_id {
        sqlx::query_as::<_, BmeWorkOrder>(
            "SELECT * FROM bme_work_orders WHERE equipment_id = $1 \
             ORDER BY created_at DESC",
        )
        .bind(equip_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(status) = params.status {
        sqlx::query_as::<_, BmeWorkOrder>(
            "SELECT * FROM bme_work_orders WHERE status::text = $1 \
             ORDER BY created_at DESC",
        )
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(order_type) = params.order_type {
        sqlx::query_as::<_, BmeWorkOrder>(
            "SELECT * FROM bme_work_orders WHERE order_type::text = $1 \
             ORDER BY created_at DESC",
        )
        .bind(order_type)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmeWorkOrder>(
            "SELECT * FROM bme_work_orders ORDER BY created_at DESC LIMIT 300",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_work_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BmeWorkOrder>, AppError> {
    require_permission(&claims, permissions::bme::pm::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeWorkOrder>(
        "SELECT * FROM bme_work_orders WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_work_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWorkOrderRequest>,
) -> Result<Json<BmeWorkOrder>, AppError> {
    require_permission(&claims, permissions::bme::pm::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let wo_number = format!(
        "WO-{}-{}",
        chrono::Utc::now().format("%Y%m%d%H%M"),
        &Uuid::new_v4().to_string()[..6]
    );

    let row = sqlx::query_as::<_, BmeWorkOrder>(
        "INSERT INTO bme_work_orders \
         (tenant_id, work_order_number, equipment_id, order_type, priority, \
          assigned_to, assigned_at, scheduled_date, description, \
          pm_schedule_id, breakdown_id, notes, created_by) \
         VALUES ($1, $2, $3, $4::bme_work_order_type, \
                 COALESCE($5, 'medium')::bme_breakdown_priority, \
                 $6, CASE WHEN $6 IS NOT NULL THEN now() ELSE NULL END, \
                 $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&wo_number)
    .bind(body.equipment_id)
    .bind(&body.order_type)
    .bind(&body.priority)
    .bind(body.assigned_to)
    .bind(body.scheduled_date)
    .bind(&body.description)
    .bind(body.pm_schedule_id)
    .bind(body.breakdown_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_work_order_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWorkOrderStatusRequest>,
) -> Result<Json<BmeWorkOrder>, AppError> {
    require_permission(&claims, permissions::bme::pm::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeWorkOrder>(
        "UPDATE bme_work_orders SET \
         status = $2::bme_work_order_status, \
         findings = COALESCE($3, findings), \
         actions_taken = COALESCE($4, actions_taken), \
         checklist_results = COALESCE($5, checklist_results), \
         labor_cost = COALESCE($6, labor_cost), \
         parts_cost = COALESCE($7, parts_cost), \
         vendor_cost = COALESCE($8, vendor_cost), \
         total_cost = COALESCE($9, total_cost), \
         started_at = CASE WHEN $2 = 'in_progress' AND started_at IS NULL THEN now() \
                      ELSE started_at END, \
         completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END, \
         technician_sign_off_by = CASE WHEN $2 = 'completed' THEN $10 \
                                  ELSE technician_sign_off_by END, \
         technician_sign_off_at = CASE WHEN $2 = 'completed' THEN now() \
                                  ELSE technician_sign_off_at END \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.findings)
    .bind(&body.actions_taken)
    .bind(&body.checklist_results)
    .bind(body.labor_cost)
    .bind(body.parts_cost)
    .bind(body.vendor_cost)
    .bind(body.total_cost)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // When a PM work order completes, update the PM schedule
    if body.status == "completed" {
        if let Some(pm_id) = row.pm_schedule_id {
            sqlx::query(
                "UPDATE bme_pm_schedules SET \
                 last_completed_date = CURRENT_DATE, \
                 next_due_date = CURRENT_DATE + CASE frequency \
                     WHEN 'monthly' THEN INTERVAL '1 month' \
                     WHEN 'quarterly' THEN INTERVAL '3 months' \
                     WHEN 'semi_annual' THEN INTERVAL '6 months' \
                     WHEN 'annual' THEN INTERVAL '1 year' \
                 END \
                 WHERE id = $1",
            )
            .bind(pm_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Calibrations
// ══════════════════════════════════════════════════════════

pub async fn list_calibrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCalibrationsQuery>,
) -> Result<Json<Vec<BmeCalibration>>, AppError> {
    require_permission(&claims, permissions::bme::calibration::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(equip_id) = params.equipment_id {
        sqlx::query_as::<_, BmeCalibration>(
            "SELECT * FROM bme_calibrations WHERE equipment_id = $1 \
             ORDER BY next_due_date NULLS LAST",
        )
        .bind(equip_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(status) = params.calibration_status {
        sqlx::query_as::<_, BmeCalibration>(
            "SELECT * FROM bme_calibrations WHERE calibration_status::text = $1 \
             ORDER BY next_due_date NULLS LAST",
        )
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmeCalibration>(
            "SELECT * FROM bme_calibrations ORDER BY next_due_date NULLS LAST LIMIT 500",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_calibration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCalibrationRequest>,
) -> Result<Json<BmeCalibration>, AppError> {
    require_permission(&claims, permissions::bme::calibration::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeCalibration>(
        "INSERT INTO bme_calibrations \
         (tenant_id, equipment_id, calibration_status, frequency, \
          last_calibrated_date, next_due_date, calibrated_by, calibration_vendor_id, \
          certificate_number, certificate_url, is_in_tolerance, deviation_notes, \
          reference_standard, notes, created_by) \
         VALUES ($1, $2, COALESCE($3, 'due')::bme_calibration_status, \
                 COALESCE($4, 'annual')::bme_pm_frequency, \
                 $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.equipment_id)
    .bind(&body.calibration_status)
    .bind(&body.frequency)
    .bind(body.last_calibrated_date)
    .bind(body.next_due_date)
    .bind(&body.calibrated_by)
    .bind(body.calibration_vendor_id)
    .bind(&body.certificate_number)
    .bind(&body.certificate_url)
    .bind(body.is_in_tolerance)
    .bind(&body.deviation_notes)
    .bind(&body.reference_standard)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_calibration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCalibrationRequest>,
) -> Result<Json<BmeCalibration>, AppError> {
    require_permission(&claims, permissions::bme::calibration::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeCalibration>(
        "UPDATE bme_calibrations SET \
         calibration_status = COALESCE($2::bme_calibration_status, calibration_status), \
         frequency = COALESCE($3::bme_pm_frequency, frequency), \
         last_calibrated_date = COALESCE($4, last_calibrated_date), \
         next_due_date = COALESCE($5, next_due_date), \
         calibrated_by = COALESCE($6, calibrated_by), \
         calibration_vendor_id = COALESCE($7, calibration_vendor_id), \
         certificate_number = COALESCE($8, certificate_number), \
         certificate_url = COALESCE($9, certificate_url), \
         is_in_tolerance = COALESCE($10, is_in_tolerance), \
         deviation_notes = COALESCE($11, deviation_notes), \
         reference_standard = COALESCE($12, reference_standard), \
         is_locked = COALESCE($13, is_locked), \
         locked_at = CASE WHEN $13 = true THEN now() ELSE locked_at END, \
         locked_reason = COALESCE($14, locked_reason), \
         notes = COALESCE($15, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.calibration_status)
    .bind(&body.frequency)
    .bind(body.last_calibrated_date)
    .bind(body.next_due_date)
    .bind(&body.calibrated_by)
    .bind(body.calibration_vendor_id)
    .bind(&body.certificate_number)
    .bind(&body.certificate_url)
    .bind(body.is_in_tolerance)
    .bind(&body.deviation_notes)
    .bind(&body.reference_standard)
    .bind(body.is_locked)
    .bind(&body.locked_reason)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-lock equipment if out of tolerance
    if body.is_in_tolerance == Some(false) {
        sqlx::query(
            "UPDATE bme_equipment SET status = 'out_of_service'::bme_equipment_status \
             WHERE id = (SELECT equipment_id FROM bme_calibrations WHERE id = $1)",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Contracts
// ══════════════════════════════════════════════════════════

pub async fn list_contracts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListContractsQuery>,
) -> Result<Json<Vec<BmeContract>>, AppError> {
    require_permission(&claims, permissions::bme::contracts::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(equip_id) = params.equipment_id {
        sqlx::query_as::<_, BmeContract>(
            "SELECT * FROM bme_contracts WHERE equipment_id = $1 \
             ORDER BY end_date",
        )
        .bind(equip_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ct) = params.contract_type {
        sqlx::query_as::<_, BmeContract>(
            "SELECT * FROM bme_contracts WHERE contract_type::text = $1 \
             ORDER BY end_date",
        )
        .bind(ct)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmeContract>(
            "SELECT * FROM bme_contracts \
             WHERE is_active = COALESCE($1, true) \
             ORDER BY end_date LIMIT 500",
        )
        .bind(params.is_active)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_contract(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateContractRequest>,
) -> Result<Json<BmeContract>, AppError> {
    require_permission(&claims, permissions::bme::contracts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeContract>(
        "INSERT INTO bme_contracts \
         (tenant_id, contract_number, equipment_id, contract_type, vendor_id, \
          start_date, end_date, contract_value, payment_terms, coverage_details, \
          exclusions, sla_response_hours, sla_resolution_hours, renewal_alert_days, \
          notes, created_by) \
         VALUES ($1, $2, $3, $4::bme_contract_type, $5, $6, $7, $8, $9, $10, \
                 $11, $12, $13, COALESCE($14, 60), $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.contract_number)
    .bind(body.equipment_id)
    .bind(&body.contract_type)
    .bind(body.vendor_id)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(body.contract_value)
    .bind(&body.payment_terms)
    .bind(&body.coverage_details)
    .bind(&body.exclusions)
    .bind(body.sla_response_hours)
    .bind(body.sla_resolution_hours)
    .bind(body.renewal_alert_days)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_contract(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateContractRequest>,
) -> Result<Json<BmeContract>, AppError> {
    require_permission(&claims, permissions::bme::contracts::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeContract>(
        "UPDATE bme_contracts SET \
         contract_type = COALESCE($2::bme_contract_type, contract_type), \
         vendor_id = COALESCE($3, vendor_id), \
         start_date = COALESCE($4, start_date), \
         end_date = COALESCE($5, end_date), \
         contract_value = COALESCE($6, contract_value), \
         payment_terms = COALESCE($7, payment_terms), \
         coverage_details = COALESCE($8, coverage_details), \
         exclusions = COALESCE($9, exclusions), \
         sla_response_hours = COALESCE($10, sla_response_hours), \
         sla_resolution_hours = COALESCE($11, sla_resolution_hours), \
         renewal_alert_days = COALESCE($12, renewal_alert_days), \
         is_renewed = COALESCE($13, is_renewed), \
         renewed_contract_id = COALESCE($14, renewed_contract_id), \
         is_active = COALESCE($15, is_active), \
         notes = COALESCE($16, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.contract_type)
    .bind(body.vendor_id)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(body.contract_value)
    .bind(&body.payment_terms)
    .bind(&body.coverage_details)
    .bind(&body.exclusions)
    .bind(body.sla_response_hours)
    .bind(body.sla_resolution_hours)
    .bind(body.renewal_alert_days)
    .bind(body.is_renewed)
    .bind(body.renewed_contract_id)
    .bind(body.is_active)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Breakdowns
// ══════════════════════════════════════════════════════════

pub async fn list_breakdowns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBreakdownsQuery>,
) -> Result<Json<Vec<BmeBreakdown>>, AppError> {
    require_permission(&claims, permissions::bme::breakdowns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(equip_id) = params.equipment_id {
        sqlx::query_as::<_, BmeBreakdown>(
            "SELECT * FROM bme_breakdowns WHERE equipment_id = $1 \
             ORDER BY reported_at DESC",
        )
        .bind(equip_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(status) = params.status {
        sqlx::query_as::<_, BmeBreakdown>(
            "SELECT * FROM bme_breakdowns WHERE status::text = $1 \
             ORDER BY reported_at DESC",
        )
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(priority) = params.priority {
        sqlx::query_as::<_, BmeBreakdown>(
            "SELECT * FROM bme_breakdowns WHERE priority::text = $1 \
             ORDER BY reported_at DESC",
        )
        .bind(priority)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmeBreakdown>(
            "SELECT * FROM bme_breakdowns ORDER BY reported_at DESC LIMIT 300",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_breakdown(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBreakdownRequest>,
) -> Result<Json<BmeBreakdown>, AppError> {
    require_permission(&claims, permissions::bme::breakdowns::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeBreakdown>(
        "INSERT INTO bme_breakdowns \
         (tenant_id, equipment_id, reported_by, department_id, priority, \
          description, downtime_start, vendor_visit_required, notes) \
         VALUES ($1, $2, $3, $4, \
                 COALESCE($5, 'medium')::bme_breakdown_priority, \
                 $6, $7::timestamptz, COALESCE($8, false), $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.equipment_id)
    .bind(claims.sub)
    .bind(body.department_id)
    .bind(&body.priority)
    .bind(&body.description)
    .bind(&body.downtime_start)
    .bind(body.vendor_visit_required)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_breakdown_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBreakdownStatusRequest>,
) -> Result<Json<BmeBreakdown>, AppError> {
    require_permission(&claims, permissions::bme::breakdowns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeBreakdown>(
        "UPDATE bme_breakdowns SET \
         status = $2::bme_breakdown_status, \
         acknowledged_at = CASE WHEN $2 = 'acknowledged' AND acknowledged_at IS NULL \
                           THEN now() ELSE acknowledged_at END, \
         acknowledged_by = CASE WHEN $2 = 'acknowledged' AND acknowledged_by IS NULL \
                           THEN $10 ELSE acknowledged_by END, \
         resolution_started_at = CASE WHEN $2 = 'in_progress' AND resolution_started_at IS NULL \
                                 THEN now() ELSE resolution_started_at END, \
         resolved_at = CASE WHEN $2 IN ('resolved', 'closed') AND resolved_at IS NULL \
                       THEN now() ELSE resolved_at END, \
         resolved_by = CASE WHEN $2 IN ('resolved', 'closed') AND resolved_by IS NULL \
                       THEN $10 ELSE resolved_by END, \
         resolution_notes = COALESCE($3, resolution_notes), \
         downtime_end = COALESCE($4::timestamptz, downtime_end), \
         downtime_minutes = CASE \
             WHEN $2 IN ('resolved', 'closed') AND downtime_start IS NOT NULL \
             THEN EXTRACT(EPOCH FROM (COALESCE($4::timestamptz, now()) - downtime_start))::int / 60 \
             ELSE downtime_minutes END, \
         spare_parts_used = COALESCE($5, spare_parts_used), \
         spare_parts_cost = COALESCE($6, spare_parts_cost), \
         vendor_id = COALESCE($7, vendor_id), \
         vendor_cost = COALESCE($8, vendor_cost), \
         total_repair_cost = COALESCE($9, total_repair_cost) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.resolution_notes)
    .bind(&body.downtime_end)
    .bind(&body.spare_parts_used)
    .bind(body.spare_parts_cost)
    .bind(body.vendor_id)
    .bind(body.vendor_cost)
    .bind(body.total_repair_cost)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Vendor Evaluations
// ══════════════════════════════════════════════════════════

pub async fn list_vendor_evaluations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListVendorEvaluationsQuery>,
) -> Result<Json<Vec<BmeVendorEvaluation>>, AppError> {
    require_permission(&claims, permissions::bme::contracts::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(vendor_id) = params.vendor_id {
        sqlx::query_as::<_, BmeVendorEvaluation>(
            "SELECT * FROM bme_vendor_evaluations WHERE vendor_id = $1 \
             ORDER BY evaluation_date DESC",
        )
        .bind(vendor_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BmeVendorEvaluation>(
            "SELECT * FROM bme_vendor_evaluations ORDER BY evaluation_date DESC LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_vendor_evaluation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVendorEvaluationRequest>,
) -> Result<Json<BmeVendorEvaluation>, AppError> {
    require_permission(&claims, permissions::bme::evaluations::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BmeVendorEvaluation>(
        "INSERT INTO bme_vendor_evaluations \
         (tenant_id, vendor_id, contract_id, evaluation_date, period_from, period_to, \
          response_time_score, resolution_quality_score, spare_parts_availability_score, \
          professionalism_score, overall_score, total_calls, calls_within_sla, \
          comments, evaluated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.vendor_id)
    .bind(body.contract_id)
    .bind(body.evaluation_date)
    .bind(body.period_from)
    .bind(body.period_to)
    .bind(body.response_time_score)
    .bind(body.resolution_quality_score)
    .bind(body.spare_parts_availability_score)
    .bind(body.professionalism_score)
    .bind(body.overall_score)
    .bind(body.total_calls)
    .bind(body.calls_within_sla)
    .bind(&body.comments)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handler — Stats (dashboard summary)
// ══════════════════════════════════════════════════════════

pub async fn get_bme_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<BmeStatsResponse>, AppError> {
    require_permission(&claims, permissions::bme::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM bme_equipment",
    )
    .fetch_one(&mut *tx)
    .await?;

    let active = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM bme_equipment WHERE status = 'active'",
    )
    .fetch_one(&mut *tx)
    .await?;

    let pm_overdue = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM bme_pm_schedules \
         WHERE is_active = true AND next_due_date < CURRENT_DATE",
    )
    .fetch_one(&mut *tx)
    .await?;

    let cal_overdue = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM bme_calibrations \
         WHERE calibration_status IN ('due', 'overdue') AND next_due_date < CURRENT_DATE",
    )
    .fetch_one(&mut *tx)
    .await?;

    let open_bd = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM bme_breakdowns \
         WHERE status NOT IN ('resolved', 'closed')",
    )
    .fetch_one(&mut *tx)
    .await?;

    let expiring = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM bme_contracts \
         WHERE is_active = true AND end_date <= CURRENT_DATE + INTERVAL '90 days'",
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(BmeStatsResponse {
        total_equipment: total.count.unwrap_or(0),
        active_equipment: active.count.unwrap_or(0),
        pm_overdue: pm_overdue.count.unwrap_or(0),
        calibration_overdue: cal_overdue.count.unwrap_or(0),
        open_breakdowns: open_bd.count.unwrap_or(0),
        expiring_contracts: expiring.count.unwrap_or(0),
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MtbfRow {
    pub equipment_id: Uuid,
    pub equipment_name: String,
    pub total_operating_hours: Option<f64>,
    pub breakdown_count: i64,
    pub mtbf_hours: Option<f64>,
}

pub async fn get_mtbf_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MtbfRow>>, AppError> {
    require_permission(&claims, permissions::bme::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MtbfRow>(
        "SELECT e.id AS equipment_id, \
                e.name AS equipment_name, \
                EXTRACT(EPOCH FROM (NOW() - e.installation_date)) / 3600.0 \
                    AS total_operating_hours, \
                COUNT(b.id)::bigint AS breakdown_count, \
                CASE WHEN COUNT(b.id) > 0 \
                     THEN EXTRACT(EPOCH FROM (NOW() - e.installation_date)) \
                          / 3600.0 / COUNT(b.id)::float \
                     ELSE NULL END AS mtbf_hours \
         FROM bme_equipment e \
         LEFT JOIN bme_breakdowns b ON b.equipment_id = e.id \
         WHERE e.status = 'active' \
         GROUP BY e.id, e.name, e.installation_date \
         ORDER BY breakdown_count DESC \
         LIMIT 50",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UptimeRow {
    pub equipment_id: Uuid,
    pub equipment_name: String,
    pub total_days: Option<f64>,
    pub downtime_days: Option<f64>,
    pub uptime_percent: Option<f64>,
}

pub async fn get_uptime_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UptimeRow>>, AppError> {
    require_permission(&claims, permissions::bme::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UptimeRow>(
        "SELECT e.id AS equipment_id, \
                e.name AS equipment_name, \
                EXTRACT(EPOCH FROM (NOW() - e.installation_date)) / 86400.0 \
                    AS total_days, \
                COALESCE(SUM(EXTRACT(EPOCH FROM \
                    (COALESCE(b.resolved_at, NOW()) - b.reported_at)) / 86400.0), 0.0) \
                    AS downtime_days, \
                CASE WHEN EXTRACT(EPOCH FROM (NOW() - e.installation_date)) > 0 \
                     THEN (1.0 - COALESCE(SUM(EXTRACT(EPOCH FROM \
                          (COALESCE(b.resolved_at, NOW()) - b.reported_at))), 0) \
                          / EXTRACT(EPOCH FROM (NOW() - e.installation_date))) * 100.0 \
                     ELSE 100.0 END AS uptime_percent \
         FROM bme_equipment e \
         LEFT JOIN bme_breakdowns b ON b.equipment_id = e.id \
         WHERE e.status = 'active' \
         GROUP BY e.id, e.name, e.installation_date \
         ORDER BY uptime_percent ASC NULLS LAST \
         LIMIT 50",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
