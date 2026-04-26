#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::facilities_mgmt::{
    FmsEnergyReading, FmsFireDrill, FmsFireEquipment, FmsFireInspection, FmsFireNoc,
    FmsGasCompliance, FmsGasReading, FmsWaterSchedule, FmsWaterTest, FmsWorkOrder,
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
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Gas Readings ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListGasReadingsQuery {
    pub gas_type: Option<String>,
    pub source_type: Option<String>,
    pub location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGasReadingRequest {
    pub gas_type: String,
    pub source_type: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub purity_percent: Option<Decimal>,
    pub pressure_bar: Option<Decimal>,
    pub flow_lpm: Option<Decimal>,
    pub temperature_c: Option<Decimal>,
    pub tank_level_percent: Option<Decimal>,
    pub cylinder_count: Option<i32>,
    pub manifold_side: Option<String>,
    pub is_alarm: Option<bool>,
    pub alarm_reason: Option<String>,
    pub reading_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

// ── Gas Compliance ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateGasComplianceRequest {
    pub facility_id: Option<Uuid>,
    pub gas_type: String,
    pub peso_license_number: Option<String>,
    pub peso_valid_from: Option<NaiveDate>,
    pub peso_valid_to: Option<NaiveDate>,
    pub drug_license_number: Option<String>,
    pub drug_license_valid_to: Option<NaiveDate>,
    pub last_inspection_date: Option<NaiveDate>,
    pub next_inspection_date: Option<NaiveDate>,
    pub inspector_name: Option<String>,
    pub compliance_status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGasComplianceRequest {
    pub peso_license_number: Option<String>,
    pub peso_valid_from: Option<NaiveDate>,
    pub peso_valid_to: Option<NaiveDate>,
    pub drug_license_number: Option<String>,
    pub drug_license_valid_to: Option<NaiveDate>,
    pub last_inspection_date: Option<NaiveDate>,
    pub next_inspection_date: Option<NaiveDate>,
    pub inspector_name: Option<String>,
    pub compliance_status: Option<String>,
    pub notes: Option<String>,
}

// ── Fire Equipment ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListFireEquipmentQuery {
    pub equipment_type: Option<String>,
    pub location_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFireEquipmentRequest {
    pub name: String,
    pub equipment_type: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub serial_number: Option<String>,
    pub make: Option<String>,
    pub capacity: Option<String>,
    pub installation_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub last_refill_date: Option<NaiveDate>,
    pub next_refill_date: Option<NaiveDate>,
    pub barcode_value: Option<String>,
    pub qr_code_value: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFireEquipmentRequest {
    pub name: Option<String>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub serial_number: Option<String>,
    pub make: Option<String>,
    pub capacity: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub last_refill_date: Option<NaiveDate>,
    pub next_refill_date: Option<NaiveDate>,
    pub barcode_value: Option<String>,
    pub qr_code_value: Option<String>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

// ── Fire Inspections ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListFireInspectionsQuery {
    pub equipment_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFireInspectionRequest {
    pub equipment_id: Uuid,
    pub inspection_date: NaiveDate,
    pub is_functional: bool,
    pub findings: Option<String>,
    pub corrective_action: Option<String>,
    pub next_inspection_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

// ── Fire Drills ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateFireDrillRequest {
    pub drill_type: String,
    pub facility_id: Option<Uuid>,
    pub drill_date: NaiveDate,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub zones_covered: Option<Vec<String>>,
    pub participants_count: Option<i32>,
    pub scenario_description: Option<String>,
    pub evacuation_time_seconds: Option<i32>,
    pub response_time_seconds: Option<i32>,
    pub findings: Option<String>,
    pub improvement_actions: Option<String>,
    pub drill_report_url: Option<String>,
    pub approved_by: Option<Uuid>,
    pub next_drill_due: Option<NaiveDate>,
    pub notes: Option<String>,
}

// ── Fire NOC ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateFireNocRequest {
    pub facility_id: Option<Uuid>,
    pub noc_number: String,
    pub issuing_authority: Option<String>,
    pub issue_date: Option<NaiveDate>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub renewal_alert_days: Option<i32>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFireNocRequest {
    pub issuing_authority: Option<String>,
    pub issue_date: Option<NaiveDate>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub renewal_alert_days: Option<i32>,
    pub is_active: Option<bool>,
    pub document_url: Option<String>,
    pub notes: Option<String>,
}

// ── Water Tests ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListWaterTestsQuery {
    pub source_type: Option<String>,
    pub test_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWaterTestRequest {
    pub source_type: String,
    pub test_type: String,
    pub location_id: Option<Uuid>,
    pub sample_date: NaiveDate,
    pub result_date: Option<NaiveDate>,
    pub parameter_name: String,
    pub result_value: Option<Decimal>,
    pub unit: Option<String>,
    pub acceptable_min: Option<Decimal>,
    pub acceptable_max: Option<Decimal>,
    pub is_within_limits: Option<bool>,
    pub corrective_action: Option<String>,
    pub tested_by: Option<String>,
    pub lab_name: Option<String>,
    pub certificate_number: Option<String>,
    pub notes: Option<String>,
}

// ── Water Schedules ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateWaterScheduleRequest {
    pub location_id: Option<Uuid>,
    pub schedule_type: String,
    pub frequency: String,
    pub last_completed_date: Option<NaiveDate>,
    pub next_due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWaterScheduleRequest {
    pub last_completed_date: Option<NaiveDate>,
    pub next_due_date: Option<NaiveDate>,
    pub assigned_to: Option<Uuid>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

// ── Energy Readings ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEnergyReadingsQuery {
    pub source_type: Option<String>,
    pub location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnergyReadingRequest {
    pub source_type: String,
    pub location_id: Option<Uuid>,
    pub equipment_name: Option<String>,
    pub reading_at: Option<DateTime<Utc>>,
    pub voltage: Option<Decimal>,
    pub current_amps: Option<Decimal>,
    pub power_kw: Option<Decimal>,
    pub power_factor: Option<Decimal>,
    pub frequency_hz: Option<Decimal>,
    pub fuel_level_percent: Option<Decimal>,
    pub runtime_hours: Option<Decimal>,
    pub load_percent: Option<Decimal>,
    pub battery_voltage: Option<Decimal>,
    pub battery_health_percent: Option<Decimal>,
    pub backup_minutes: Option<i32>,
    pub switchover_time_seconds: Option<Decimal>,
    pub is_alarm: Option<bool>,
    pub alarm_reason: Option<String>,
    pub notes: Option<String>,
}

// ── Work Orders ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListWorkOrdersQuery {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub department_id: Option<Uuid>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkOrderRequest {
    pub category: Option<String>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub priority: Option<String>,
    pub description: String,
    pub assigned_to: Option<Uuid>,
    pub vendor_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkOrderStatusRequest {
    pub status: String,
    pub assigned_to: Option<Uuid>,
    pub findings: Option<String>,
    pub actions_taken: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub vendor_report: Option<String>,
    pub vendor_cost: Option<Decimal>,
    pub material_cost: Option<Decimal>,
    pub labor_cost: Option<Decimal>,
    pub notes: Option<String>,
}

// ── Stats ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct FmsStatsResponse {
    pub overdue_fire_inspections: i64,
    pub gas_compliance_expiring: i64,
    pub water_tests_due: i64,
    pub open_work_orders: i64,
    pub energy_alarms: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Gas Readings
// ══════════════════════════════════════════════════════════

pub async fn list_gas_readings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListGasReadingsQuery>,
) -> Result<Json<Vec<FmsGasReading>>, AppError> {
    require_permission(&claims, permissions::facilities::gas::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsGasReading>(
        "SELECT * FROM fms_gas_readings \
         WHERE ($1::text IS NULL OR gas_type::text = $1) \
         AND ($2::text IS NULL OR source_type::text = $2) \
         AND ($3::uuid IS NULL OR location_id = $3) \
         ORDER BY reading_at DESC LIMIT 200",
    )
    .bind(&params.gas_type)
    .bind(&params.source_type)
    .bind(params.location_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_gas_reading(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGasReadingRequest>,
) -> Result<Json<FmsGasReading>, AppError> {
    require_permission(&claims, permissions::facilities::gas::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsGasReading>(
        "INSERT INTO fms_gas_readings \
         (tenant_id, gas_type, source_type, location_id, department_id, \
          purity_percent, pressure_bar, flow_lpm, temperature_c, \
          tank_level_percent, cylinder_count, manifold_side, \
          is_alarm, alarm_reason, reading_at, recorded_by, notes) \
         VALUES ($1, $2::fms_gas_type, $3::fms_gas_source_type, $4, $5, \
                 $6, $7, $8, $9, $10, $11, $12, \
                 COALESCE($13, false), $14, COALESCE($15, now()), $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.gas_type)
    .bind(&body.source_type)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(body.purity_percent)
    .bind(body.pressure_bar)
    .bind(body.flow_lpm)
    .bind(body.temperature_c)
    .bind(body.tank_level_percent)
    .bind(body.cylinder_count)
    .bind(&body.manifold_side)
    .bind(body.is_alarm)
    .bind(&body.alarm_reason)
    .bind(body.reading_at)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Gas Compliance
// ══════════════════════════════════════════════════════════

pub async fn list_gas_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FmsGasCompliance>>, AppError> {
    require_permission(&claims, permissions::facilities::compliance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsGasCompliance>(
        "SELECT * FROM fms_gas_compliance ORDER BY gas_type, facility_id",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_gas_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGasComplianceRequest>,
) -> Result<Json<FmsGasCompliance>, AppError> {
    require_permission(&claims, permissions::facilities::compliance::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsGasCompliance>(
        "INSERT INTO fms_gas_compliance \
         (tenant_id, facility_id, gas_type, peso_license_number, \
          peso_valid_from, peso_valid_to, drug_license_number, drug_license_valid_to, \
          last_inspection_date, next_inspection_date, inspector_name, \
          compliance_status, notes) \
         VALUES ($1, $2, $3::fms_gas_type, $4, $5, $6, $7, $8, $9, $10, $11, \
                 COALESCE($12, 'compliant'), $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.facility_id)
    .bind(&body.gas_type)
    .bind(&body.peso_license_number)
    .bind(body.peso_valid_from)
    .bind(body.peso_valid_to)
    .bind(&body.drug_license_number)
    .bind(body.drug_license_valid_to)
    .bind(body.last_inspection_date)
    .bind(body.next_inspection_date)
    .bind(&body.inspector_name)
    .bind(&body.compliance_status)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_gas_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateGasComplianceRequest>,
) -> Result<Json<FmsGasCompliance>, AppError> {
    require_permission(&claims, permissions::facilities::compliance::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsGasCompliance>(
        "UPDATE fms_gas_compliance SET \
         peso_license_number = COALESCE($2, peso_license_number), \
         peso_valid_from = COALESCE($3, peso_valid_from), \
         peso_valid_to = COALESCE($4, peso_valid_to), \
         drug_license_number = COALESCE($5, drug_license_number), \
         drug_license_valid_to = COALESCE($6, drug_license_valid_to), \
         last_inspection_date = COALESCE($7, last_inspection_date), \
         next_inspection_date = COALESCE($8, next_inspection_date), \
         inspector_name = COALESCE($9, inspector_name), \
         compliance_status = COALESCE($10, compliance_status), \
         notes = COALESCE($11, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.peso_license_number)
    .bind(body.peso_valid_from)
    .bind(body.peso_valid_to)
    .bind(&body.drug_license_number)
    .bind(body.drug_license_valid_to)
    .bind(body.last_inspection_date)
    .bind(body.next_inspection_date)
    .bind(&body.inspector_name)
    .bind(&body.compliance_status)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Fire Equipment
// ══════════════════════════════════════════════════════════

pub async fn list_fire_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFireEquipmentQuery>,
) -> Result<Json<Vec<FmsFireEquipment>>, AppError> {
    require_permission(&claims, permissions::facilities::fire::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsFireEquipment>(
        "SELECT * FROM fms_fire_equipment \
         WHERE ($1::text IS NULL OR equipment_type::text = $1) \
         AND ($2::uuid IS NULL OR location_id = $2) \
         AND ($3::bool IS NULL OR is_active = $3) \
         ORDER BY name",
    )
    .bind(&params.equipment_type)
    .bind(params.location_id)
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_fire_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFireEquipmentRequest>,
) -> Result<Json<FmsFireEquipment>, AppError> {
    require_permission(&claims, permissions::facilities::fire::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsFireEquipment>(
        "INSERT INTO fms_fire_equipment \
         (tenant_id, name, equipment_type, location_id, department_id, \
          serial_number, make, capacity, installation_date, expiry_date, \
          last_refill_date, next_refill_date, barcode_value, qr_code_value, notes) \
         VALUES ($1, $2, $3::fms_fire_equipment_type, $4, $5, \
                 $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.equipment_type)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.serial_number)
    .bind(&body.make)
    .bind(&body.capacity)
    .bind(body.installation_date)
    .bind(body.expiry_date)
    .bind(body.last_refill_date)
    .bind(body.next_refill_date)
    .bind(&body.barcode_value)
    .bind(&body.qr_code_value)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_fire_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFireEquipmentRequest>,
) -> Result<Json<FmsFireEquipment>, AppError> {
    require_permission(&claims, permissions::facilities::fire::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsFireEquipment>(
        "UPDATE fms_fire_equipment SET \
         name = COALESCE($2, name), \
         location_id = COALESCE($3, location_id), \
         department_id = COALESCE($4, department_id), \
         serial_number = COALESCE($5, serial_number), \
         make = COALESCE($6, make), \
         capacity = COALESCE($7, capacity), \
         expiry_date = COALESCE($8, expiry_date), \
         last_refill_date = COALESCE($9, last_refill_date), \
         next_refill_date = COALESCE($10, next_refill_date), \
         barcode_value = COALESCE($11, barcode_value), \
         qr_code_value = COALESCE($12, qr_code_value), \
         is_active = COALESCE($13, is_active), \
         notes = COALESCE($14, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.serial_number)
    .bind(&body.make)
    .bind(&body.capacity)
    .bind(body.expiry_date)
    .bind(body.last_refill_date)
    .bind(body.next_refill_date)
    .bind(&body.barcode_value)
    .bind(&body.qr_code_value)
    .bind(body.is_active)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Fire Inspections
// ══════════════════════════════════════════════════════════

pub async fn list_fire_inspections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFireInspectionsQuery>,
) -> Result<Json<Vec<FmsFireInspection>>, AppError> {
    require_permission(&claims, permissions::facilities::fire::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsFireInspection>(
        "SELECT * FROM fms_fire_inspections \
         WHERE ($1::uuid IS NULL OR equipment_id = $1) \
         ORDER BY inspection_date DESC LIMIT 200",
    )
    .bind(params.equipment_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_fire_inspection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFireInspectionRequest>,
) -> Result<Json<FmsFireInspection>, AppError> {
    require_permission(&claims, permissions::facilities::fire::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsFireInspection>(
        "INSERT INTO fms_fire_inspections \
         (tenant_id, equipment_id, inspection_date, is_functional, findings, \
          corrective_action, inspected_by, next_inspection_date, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.equipment_id)
    .bind(body.inspection_date)
    .bind(body.is_functional)
    .bind(&body.findings)
    .bind(&body.corrective_action)
    .bind(claims.sub)
    .bind(body.next_inspection_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Fire Drills
// ══════════════════════════════════════════════════════════

pub async fn list_fire_drills(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FmsFireDrill>>, AppError> {
    require_permission(&claims, permissions::facilities::fire::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsFireDrill>(
        "SELECT * FROM fms_fire_drills ORDER BY drill_date DESC LIMIT 100",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_fire_drill(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFireDrillRequest>,
) -> Result<Json<FmsFireDrill>, AppError> {
    require_permission(&claims, permissions::facilities::fire::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsFireDrill>(
        "INSERT INTO fms_fire_drills \
         (tenant_id, drill_type, facility_id, drill_date, start_time, end_time, \
          duration_minutes, zones_covered, participants_count, scenario_description, \
          evacuation_time_seconds, response_time_seconds, findings, improvement_actions, \
          drill_report_url, conducted_by, approved_by, next_drill_due, notes) \
         VALUES ($1, $2::fms_drill_type, $3, $4, $5, $6, $7, $8, $9, $10, \
                 $11, $12, $13, $14, $15, $16, $17, $18, $19) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.drill_type)
    .bind(body.facility_id)
    .bind(body.drill_date)
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(body.duration_minutes)
    .bind(&body.zones_covered)
    .bind(body.participants_count)
    .bind(&body.scenario_description)
    .bind(body.evacuation_time_seconds)
    .bind(body.response_time_seconds)
    .bind(&body.findings)
    .bind(&body.improvement_actions)
    .bind(&body.drill_report_url)
    .bind(claims.sub)
    .bind(body.approved_by)
    .bind(body.next_drill_due)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Fire NOC
// ══════════════════════════════════════════════════════════

pub async fn list_fire_noc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FmsFireNoc>>, AppError> {
    require_permission(&claims, permissions::facilities::fire::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsFireNoc>(
        "SELECT * FROM fms_fire_noc ORDER BY valid_to DESC NULLS LAST",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_fire_noc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFireNocRequest>,
) -> Result<Json<FmsFireNoc>, AppError> {
    require_permission(&claims, permissions::facilities::fire::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsFireNoc>(
        "INSERT INTO fms_fire_noc \
         (tenant_id, facility_id, noc_number, issuing_authority, \
          issue_date, valid_from, valid_to, renewal_alert_days, document_url, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 90), $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.facility_id)
    .bind(&body.noc_number)
    .bind(&body.issuing_authority)
    .bind(body.issue_date)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .bind(body.renewal_alert_days)
    .bind(&body.document_url)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_fire_noc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFireNocRequest>,
) -> Result<Json<FmsFireNoc>, AppError> {
    require_permission(&claims, permissions::facilities::fire::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsFireNoc>(
        "UPDATE fms_fire_noc SET \
         issuing_authority = COALESCE($2, issuing_authority), \
         issue_date = COALESCE($3, issue_date), \
         valid_from = COALESCE($4, valid_from), \
         valid_to = COALESCE($5, valid_to), \
         renewal_alert_days = COALESCE($6, renewal_alert_days), \
         is_active = COALESCE($7, is_active), \
         document_url = COALESCE($8, document_url), \
         notes = COALESCE($9, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.issuing_authority)
    .bind(body.issue_date)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .bind(body.renewal_alert_days)
    .bind(body.is_active)
    .bind(&body.document_url)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Water Tests
// ══════════════════════════════════════════════════════════

pub async fn list_water_tests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListWaterTestsQuery>,
) -> Result<Json<Vec<FmsWaterTest>>, AppError> {
    require_permission(&claims, permissions::facilities::water::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsWaterTest>(
        "SELECT * FROM fms_water_tests \
         WHERE ($1::text IS NULL OR source_type::text = $1) \
         AND ($2::text IS NULL OR test_type::text = $2) \
         ORDER BY sample_date DESC LIMIT 200",
    )
    .bind(&params.source_type)
    .bind(&params.test_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_water_test(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWaterTestRequest>,
) -> Result<Json<FmsWaterTest>, AppError> {
    require_permission(&claims, permissions::facilities::water::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsWaterTest>(
        "INSERT INTO fms_water_tests \
         (tenant_id, source_type, test_type, location_id, sample_date, result_date, \
          parameter_name, result_value, unit, acceptable_min, acceptable_max, \
          is_within_limits, corrective_action, tested_by, lab_name, certificate_number, notes) \
         VALUES ($1, $2::fms_water_source_type, $3::fms_water_test_type, $4, $5, $6, \
                 $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.source_type)
    .bind(&body.test_type)
    .bind(body.location_id)
    .bind(body.sample_date)
    .bind(body.result_date)
    .bind(&body.parameter_name)
    .bind(body.result_value)
    .bind(&body.unit)
    .bind(body.acceptable_min)
    .bind(body.acceptable_max)
    .bind(body.is_within_limits)
    .bind(&body.corrective_action)
    .bind(&body.tested_by)
    .bind(&body.lab_name)
    .bind(&body.certificate_number)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Water Schedules
// ══════════════════════════════════════════════════════════

pub async fn list_water_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FmsWaterSchedule>>, AppError> {
    require_permission(&claims, permissions::facilities::water::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsWaterSchedule>(
        "SELECT * FROM fms_water_schedules ORDER BY next_due_date NULLS LAST",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_water_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWaterScheduleRequest>,
) -> Result<Json<FmsWaterSchedule>, AppError> {
    require_permission(&claims, permissions::facilities::water::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsWaterSchedule>(
        "INSERT INTO fms_water_schedules \
         (tenant_id, location_id, schedule_type, frequency, \
          last_completed_date, next_due_date, assigned_to, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.location_id)
    .bind(&body.schedule_type)
    .bind(&body.frequency)
    .bind(body.last_completed_date)
    .bind(body.next_due_date)
    .bind(body.assigned_to)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_water_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWaterScheduleRequest>,
) -> Result<Json<FmsWaterSchedule>, AppError> {
    require_permission(&claims, permissions::facilities::water::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsWaterSchedule>(
        "UPDATE fms_water_schedules SET \
         last_completed_date = COALESCE($2, last_completed_date), \
         next_due_date = COALESCE($3, next_due_date), \
         assigned_to = COALESCE($4, assigned_to), \
         is_active = COALESCE($5, is_active), \
         notes = COALESCE($6, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.last_completed_date)
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
//  Handlers — Energy Readings
// ══════════════════════════════════════════════════════════

pub async fn list_energy_readings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEnergyReadingsQuery>,
) -> Result<Json<Vec<FmsEnergyReading>>, AppError> {
    require_permission(&claims, permissions::facilities::energy::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsEnergyReading>(
        "SELECT * FROM fms_energy_readings \
         WHERE ($1::text IS NULL OR source_type::text = $1) \
         AND ($2::uuid IS NULL OR location_id = $2) \
         ORDER BY reading_at DESC LIMIT 200",
    )
    .bind(&params.source_type)
    .bind(params.location_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_energy_reading(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEnergyReadingRequest>,
) -> Result<Json<FmsEnergyReading>, AppError> {
    require_permission(&claims, permissions::facilities::energy::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsEnergyReading>(
        "INSERT INTO fms_energy_readings \
         (tenant_id, source_type, location_id, equipment_name, reading_at, \
          voltage, current_amps, power_kw, power_factor, frequency_hz, \
          fuel_level_percent, runtime_hours, load_percent, \
          battery_voltage, battery_health_percent, backup_minutes, \
          switchover_time_seconds, is_alarm, alarm_reason, recorded_by, notes) \
         VALUES ($1, $2::fms_energy_source_type, $3, $4, COALESCE($5, now()), \
                 $6, $7, $8, $9, $10, $11, $12, $13, \
                 $14, $15, $16, $17, COALESCE($18, false), $19, $20, $21) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.source_type)
    .bind(body.location_id)
    .bind(&body.equipment_name)
    .bind(body.reading_at)
    .bind(body.voltage)
    .bind(body.current_amps)
    .bind(body.power_kw)
    .bind(body.power_factor)
    .bind(body.frequency_hz)
    .bind(body.fuel_level_percent)
    .bind(body.runtime_hours)
    .bind(body.load_percent)
    .bind(body.battery_voltage)
    .bind(body.battery_health_percent)
    .bind(body.backup_minutes)
    .bind(body.switchover_time_seconds)
    .bind(body.is_alarm)
    .bind(&body.alarm_reason)
    .bind(claims.sub)
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
) -> Result<Json<Vec<FmsWorkOrder>>, AppError> {
    require_permission(&claims, permissions::facilities::work_orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FmsWorkOrder>(
        "SELECT * FROM fms_work_orders \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR priority = $2) \
         AND ($3::uuid IS NULL OR department_id = $3) \
         AND ($4::text IS NULL OR category = $4) \
         ORDER BY requested_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.priority)
    .bind(params.department_id)
    .bind(&params.category)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_work_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FmsWorkOrder>, AppError> {
    require_permission(&claims, permissions::facilities::work_orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsWorkOrder>("SELECT * FROM fms_work_orders WHERE id = $1")
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
) -> Result<Json<FmsWorkOrder>, AppError> {
    require_permission(&claims, permissions::facilities::work_orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let wo_number = format!(
        "FWO-{}-{}",
        Utc::now().format("%Y%m%d%H%M"),
        &Uuid::new_v4().to_string()[..6]
    );

    let row = sqlx::query_as::<_, FmsWorkOrder>(
        "INSERT INTO fms_work_orders \
         (tenant_id, work_order_number, category, location_id, department_id, \
          requested_by, priority, description, assigned_to, \
          assigned_at, vendor_id, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'medium'), $8, $9, \
                 CASE WHEN $9 IS NOT NULL THEN now() ELSE NULL END, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&wo_number)
    .bind(&body.category)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(claims.sub)
    .bind(&body.priority)
    .bind(&body.description)
    .bind(body.assigned_to)
    .bind(body.vendor_id)
    .bind(&body.notes)
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
) -> Result<Json<FmsWorkOrder>, AppError> {
    require_permission(&claims, permissions::facilities::work_orders::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FmsWorkOrder>(
        "UPDATE fms_work_orders SET \
         status = $2::fms_work_order_status, \
         assigned_to = COALESCE($3, assigned_to), \
         assigned_at = CASE WHEN $3 IS NOT NULL AND assigned_at IS NULL \
                       THEN now() ELSE assigned_at END, \
         started_at = CASE WHEN $2 = 'in_progress' AND started_at IS NULL \
                      THEN now() ELSE started_at END, \
         completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END, \
         completed_by = CASE WHEN $2 = 'completed' THEN $11 ELSE completed_by END, \
         findings = COALESCE($4, findings), \
         actions_taken = COALESCE($5, actions_taken), \
         vendor_id = COALESCE($6, vendor_id), \
         vendor_report = COALESCE($7, vendor_report), \
         vendor_cost = COALESCE($8, vendor_cost), \
         material_cost = COALESCE($9, material_cost), \
         labor_cost = COALESCE($10, labor_cost), \
         total_cost = CASE WHEN $2 = 'completed' \
                      THEN COALESCE($8, vendor_cost, 0) \
                         + COALESCE($9, material_cost, 0) \
                         + COALESCE($10, labor_cost, 0) \
                      ELSE total_cost END, \
         notes = COALESCE($12, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(body.assigned_to)
    .bind(&body.findings)
    .bind(&body.actions_taken)
    .bind(body.vendor_id)
    .bind(&body.vendor_report)
    .bind(body.vendor_cost)
    .bind(body.material_cost)
    .bind(body.labor_cost)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handler — Stats (dashboard summary)
// ══════════════════════════════════════════════════════════

pub async fn get_fms_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<FmsStatsResponse>, AppError> {
    require_permission(&claims, permissions::facilities::stats::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let fire_overdue = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(DISTINCT e.id) as count FROM fms_fire_equipment e \
         LEFT JOIN fms_fire_inspections i ON i.equipment_id = e.id \
         WHERE e.is_active = true AND (\
           i.id IS NULL OR i.next_inspection_date < CURRENT_DATE \
         )",
    )
    .fetch_one(&mut *tx)
    .await?;

    let gas_expiring = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM fms_gas_compliance \
         WHERE peso_valid_to <= CURRENT_DATE + INTERVAL '90 days' \
         OR drug_license_valid_to <= CURRENT_DATE + INTERVAL '90 days'",
    )
    .fetch_one(&mut *tx)
    .await?;

    let water_due = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM fms_water_schedules \
         WHERE is_active = true AND next_due_date <= CURRENT_DATE",
    )
    .fetch_one(&mut *tx)
    .await?;

    let open_wo = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM fms_work_orders \
         WHERE status NOT IN ('completed', 'cancelled')",
    )
    .fetch_one(&mut *tx)
    .await?;

    let alarms = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM fms_energy_readings \
         WHERE is_alarm = true AND reading_at >= CURRENT_DATE - INTERVAL '7 days'",
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(FmsStatsResponse {
        overdue_fire_inspections: fire_overdue.count.unwrap_or(0),
        gas_compliance_expiring: gas_expiring.count.unwrap_or(0),
        water_tests_due: water_due.count.unwrap_or(0),
        open_work_orders: open_wo.count.unwrap_or(0),
        energy_alarms: alarms.count.unwrap_or(0),
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/facilities/pm/schedule
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SchedulePmRequest {
    pub equipment_ids: Vec<Uuid>,
    pub frequency_days: i32,
    pub priority: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub notes: Option<String>,
}

pub async fn schedule_pm(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SchedulePmRequest>,
) -> Result<Json<Vec<FmsWorkOrder>>, AppError> {
    require_permission(&claims, permissions::facilities::work_orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut created_orders = Vec::new();

    for equipment_id in &body.equipment_ids {
        let wo_number = format!(
            "PM-{}-{}",
            Utc::now().format("%Y%m%d%H%M"),
            &Uuid::new_v4().to_string()[..6]
        );

        let description = format!(
            "Preventive maintenance (every {} days) for equipment {}",
            body.frequency_days, equipment_id
        );

        let row = sqlx::query_as::<_, FmsWorkOrder>(
            "INSERT INTO fms_work_orders \
             (tenant_id, work_order_number, category, \
              requested_by, priority, description, assigned_to, \
              assigned_at, notes) \
             VALUES ($1, $2, 'preventive_maintenance', \
                     $3, COALESCE($4, 'medium'), $5, $6, \
                     CASE WHEN $6 IS NOT NULL THEN now() ELSE NULL END, $7) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(&wo_number)
        .bind(claims.sub)
        .bind(&body.priority)
        .bind(&description)
        .bind(body.assigned_to)
        .bind(&body.notes)
        .fetch_one(&mut *tx)
        .await?;

        created_orders.push(row);
    }

    tx.commit().await?;
    Ok(Json(created_orders))
}

// ══════════════════════════════════════════════════════════
//  GET /api/facilities/energy/analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct EnergyAnalyticsQuery {
    pub source_type: Option<String>,
    pub days: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EnergyAnalyticsRow {
    pub source_type: String,
    pub total_readings: Option<i64>,
    pub avg_power_kw: Option<Decimal>,
    pub max_power_kw: Option<Decimal>,
    pub min_power_kw: Option<Decimal>,
    pub alarm_count: Option<i64>,
    pub avg_load_percent: Option<Decimal>,
}

pub async fn energy_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<EnergyAnalyticsQuery>,
) -> Result<Json<Vec<EnergyAnalyticsRow>>, AppError> {
    require_permission(&claims, permissions::facilities::energy::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let days = params.days.unwrap_or(30);

    let rows = sqlx::query_as::<_, EnergyAnalyticsRow>(
        "SELECT source_type::text AS source_type, \
         COUNT(*)::bigint AS total_readings, \
         AVG(power_kw) AS avg_power_kw, \
         MAX(power_kw) AS max_power_kw, \
         MIN(power_kw) AS min_power_kw, \
         COUNT(*) FILTER (WHERE is_alarm = true)::bigint AS alarm_count, \
         AVG(load_percent) AS avg_load_percent \
         FROM fms_energy_readings \
         WHERE tenant_id = $1 \
           AND reading_at >= CURRENT_DATE - ($2 || ' days')::interval \
           AND ($3::text IS NULL OR source_type::text = $3) \
         GROUP BY source_type \
         ORDER BY total_readings DESC",
    )
    .bind(claims.tenant_id)
    .bind(days)
    .bind(&params.source_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
