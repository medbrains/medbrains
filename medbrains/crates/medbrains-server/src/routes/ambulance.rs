#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::ambulance::{
    Ambulance, AmbulanceDriver, AmbulanceMaintenance, AmbulanceTrip, AmbulanceTripLog,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAmbulancesQuery {
    pub status: Option<String>,
    pub ambulance_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAmbulanceRequest {
    pub vehicle_number: String,
    pub ambulance_type: String,
    pub make: Option<String>,
    pub model: Option<String>,
    pub year_of_manufacture: Option<i32>,
    pub chassis_number: Option<String>,
    pub engine_number: Option<String>,
    pub fitness_certificate_expiry: Option<NaiveDate>,
    pub insurance_expiry: Option<NaiveDate>,
    pub pollution_certificate_expiry: Option<NaiveDate>,
    pub permit_expiry: Option<NaiveDate>,
    pub equipment_checklist: Option<serde_json::Value>,
    pub has_ventilator: Option<bool>,
    pub has_defibrillator: Option<bool>,
    pub has_oxygen: Option<bool>,
    pub seating_capacity: Option<i32>,
    pub gps_device_id: Option<String>,
    pub default_driver_id: Option<Uuid>,
    pub fuel_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAmbulanceRequest {
    pub vehicle_number: Option<String>,
    pub ambulance_type: Option<String>,
    pub status: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub year_of_manufacture: Option<i32>,
    pub chassis_number: Option<String>,
    pub engine_number: Option<String>,
    pub fitness_certificate_expiry: Option<NaiveDate>,
    pub insurance_expiry: Option<NaiveDate>,
    pub pollution_certificate_expiry: Option<NaiveDate>,
    pub permit_expiry: Option<NaiveDate>,
    pub equipment_checklist: Option<serde_json::Value>,
    pub has_ventilator: Option<bool>,
    pub has_defibrillator: Option<bool>,
    pub has_oxygen: Option<bool>,
    pub seating_capacity: Option<i32>,
    pub gps_device_id: Option<String>,
    pub default_driver_id: Option<Uuid>,
    pub odometer_km: Option<i32>,
    pub fuel_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
}

// ── Drivers ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListDriversQuery {
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDriverRequest {
    pub employee_id: Uuid,
    pub license_number: String,
    pub license_type: String,
    pub license_expiry: NaiveDate,
    pub bls_certified: Option<bool>,
    pub bls_expiry: Option<NaiveDate>,
    pub defensive_driving: Option<bool>,
    pub shift_pattern: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDriverRequest {
    pub license_number: Option<String>,
    pub license_type: Option<String>,
    pub license_expiry: Option<NaiveDate>,
    pub is_active: Option<bool>,
    pub bls_certified: Option<bool>,
    pub bls_expiry: Option<NaiveDate>,
    pub defensive_driving: Option<bool>,
    pub shift_pattern: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
}

// ── Trips ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTripsQuery {
    pub status: Option<String>,
    pub trip_type: Option<String>,
    pub ambulance_id: Option<Uuid>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTripRequest {
    pub trip_type: String,
    pub priority: Option<String>,
    pub ambulance_id: Option<Uuid>,
    pub driver_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub patient_phone: Option<String>,
    pub pickup_address: String,
    pub pickup_latitude: Option<f64>,
    pub pickup_longitude: Option<f64>,
    pub pickup_landmark: Option<String>,
    pub drop_address: Option<String>,
    pub drop_latitude: Option<f64>,
    pub drop_longitude: Option<f64>,
    pub drop_landmark: Option<String>,
    pub er_visit_id: Option<Uuid>,
    pub transport_request_id: Option<Uuid>,
    pub is_billable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTripRequest {
    pub ambulance_id: Option<Uuid>,
    pub driver_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub patient_phone: Option<String>,
    pub pickup_address: Option<String>,
    pub drop_address: Option<String>,
    pub vitals_at_pickup: Option<serde_json::Value>,
    pub vitals_at_drop: Option<serde_json::Value>,
    pub clinical_notes: Option<String>,
    pub oxygen_administered: Option<bool>,
    pub iv_started: Option<bool>,
    pub odometer_start: Option<i32>,
    pub odometer_end: Option<i32>,
    pub base_charge: Option<Decimal>,
    pub per_km_charge: Option<Decimal>,
    pub total_amount: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTripStatusRequest {
    pub status: String,
    pub cancellation_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddTripLogRequest {
    pub event_type: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub speed_kmh: Option<Decimal>,
    pub event_data: Option<serde_json::Value>,
}

// ── Maintenance ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListMaintenanceQuery {
    pub ambulance_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaintenanceRequest {
    pub ambulance_id: Uuid,
    pub maintenance_type: String,
    pub scheduled_date: NaiveDate,
    pub description: Option<String>,
    pub vendor_name: Option<String>,
    pub cost: Option<Decimal>,
    pub odometer_at_service: Option<i32>,
    pub next_service_km: Option<i32>,
    pub next_service_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMaintenanceRequest {
    pub maintenance_type: Option<String>,
    pub status: Option<String>,
    pub scheduled_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub vendor_name: Option<String>,
    pub cost: Option<Decimal>,
    pub odometer_at_service: Option<i32>,
    pub next_service_km: Option<i32>,
    pub next_service_date: Option<NaiveDate>,
    pub findings: Option<String>,
    pub parts_replaced: Option<serde_json::Value>,
    pub performed_by: Option<String>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Fleet
// ══════════════════════════════════════════════════════════

pub async fn list_ambulances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAmbulancesQuery>,
) -> Result<Json<Vec<Ambulance>>, AppError> {
    require_permission(&claims, permissions::ambulance::fleet::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Ambulance>(
        "SELECT * FROM ambulances \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR ambulance_type::text = $2) \
         ORDER BY ambulance_code LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.ambulance_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_ambulance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Ambulance>, AppError> {
    require_permission(&claims, permissions::ambulance::fleet::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Ambulance>("SELECT * FROM ambulances WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_ambulance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAmbulanceRequest>,
) -> Result<Json<Ambulance>, AppError> {
    require_permission(&claims, permissions::ambulance::fleet::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let ambulance_code = format!("AMB-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, Ambulance>(
        "INSERT INTO ambulances \
         (tenant_id, vehicle_number, ambulance_code, ambulance_type, \
          make, model, year_of_manufacture, chassis_number, engine_number, \
          fitness_certificate_expiry, insurance_expiry, pollution_certificate_expiry, permit_expiry, \
          equipment_checklist, has_ventilator, has_defibrillator, has_oxygen, seating_capacity, \
          gps_device_id, default_driver_id, fuel_type, notes, created_by) \
         VALUES ($1,$2,$3,$4::ambulance_type, $5,$6,$7,$8,$9, $10,$11,$12,$13, \
                 $14,$15,$16,$17,$18, $19,$20,$21,$22,$23) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.vehicle_number)
    .bind(&ambulance_code)
    .bind(&body.ambulance_type)
    .bind(&body.make)
    .bind(&body.model)
    .bind(body.year_of_manufacture)
    .bind(&body.chassis_number)
    .bind(&body.engine_number)
    .bind(body.fitness_certificate_expiry)
    .bind(body.insurance_expiry)
    .bind(body.pollution_certificate_expiry)
    .bind(body.permit_expiry)
    .bind(&body.equipment_checklist)
    .bind(body.has_ventilator.unwrap_or(false))
    .bind(body.has_defibrillator.unwrap_or(false))
    .bind(body.has_oxygen.unwrap_or(true))
    .bind(body.seating_capacity)
    .bind(&body.gps_device_id)
    .bind(body.default_driver_id)
    .bind(&body.fuel_type)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_ambulance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAmbulanceRequest>,
) -> Result<Json<Ambulance>, AppError> {
    require_permission(&claims, permissions::ambulance::fleet::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Ambulance>(
        "UPDATE ambulances SET \
         vehicle_number = COALESCE($2, vehicle_number), \
         ambulance_type = COALESCE($3::ambulance_type, ambulance_type), \
         status = COALESCE($4::ambulance_status, status), \
         make = COALESCE($5, make), \
         model = COALESCE($6, model), \
         year_of_manufacture = COALESCE($7, year_of_manufacture), \
         chassis_number = COALESCE($8, chassis_number), \
         engine_number = COALESCE($9, engine_number), \
         fitness_certificate_expiry = COALESCE($10, fitness_certificate_expiry), \
         insurance_expiry = COALESCE($11, insurance_expiry), \
         pollution_certificate_expiry = COALESCE($12, pollution_certificate_expiry), \
         permit_expiry = COALESCE($13, permit_expiry), \
         equipment_checklist = COALESCE($14, equipment_checklist), \
         has_ventilator = COALESCE($15, has_ventilator), \
         has_defibrillator = COALESCE($16, has_defibrillator), \
         has_oxygen = COALESCE($17, has_oxygen), \
         seating_capacity = COALESCE($18, seating_capacity), \
         gps_device_id = COALESCE($19, gps_device_id), \
         default_driver_id = COALESCE($20, default_driver_id), \
         odometer_km = COALESCE($21, odometer_km), \
         fuel_type = COALESCE($22, fuel_type), \
         notes = COALESCE($23, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.vehicle_number)
    .bind(&body.ambulance_type)
    .bind(&body.status)
    .bind(&body.make)
    .bind(&body.model)
    .bind(body.year_of_manufacture)
    .bind(&body.chassis_number)
    .bind(&body.engine_number)
    .bind(body.fitness_certificate_expiry)
    .bind(body.insurance_expiry)
    .bind(body.pollution_certificate_expiry)
    .bind(body.permit_expiry)
    .bind(&body.equipment_checklist)
    .bind(body.has_ventilator)
    .bind(body.has_defibrillator)
    .bind(body.has_oxygen)
    .bind(body.seating_capacity)
    .bind(&body.gps_device_id)
    .bind(body.default_driver_id)
    .bind(body.odometer_km)
    .bind(&body.fuel_type)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_ambulance_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLocationRequest>,
) -> Result<Json<Ambulance>, AppError> {
    require_permission(&claims, permissions::ambulance::fleet::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Ambulance>(
        "UPDATE ambulances SET \
         last_latitude = $2, last_longitude = $3, last_location_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.latitude)
    .bind(body.longitude)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Drivers
// ══════════════════════════════════════════════════════════

pub async fn list_drivers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDriversQuery>,
) -> Result<Json<Vec<AmbulanceDriver>>, AppError> {
    require_permission(&claims, permissions::ambulance::drivers::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AmbulanceDriver>(
        "SELECT * FROM ambulance_drivers \
         WHERE ($1::bool IS NULL OR is_active = $1) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_driver(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDriverRequest>,
) -> Result<Json<AmbulanceDriver>, AppError> {
    require_permission(&claims, permissions::ambulance::drivers::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceDriver>(
        "INSERT INTO ambulance_drivers \
         (tenant_id, employee_id, license_number, license_type, license_expiry, \
          bls_certified, bls_expiry, defensive_driving, shift_pattern, phone, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(&body.license_number)
    .bind(&body.license_type)
    .bind(body.license_expiry)
    .bind(body.bls_certified.unwrap_or(false))
    .bind(body.bls_expiry)
    .bind(body.defensive_driving.unwrap_or(false))
    .bind(&body.shift_pattern)
    .bind(&body.phone)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_driver(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDriverRequest>,
) -> Result<Json<AmbulanceDriver>, AppError> {
    require_permission(&claims, permissions::ambulance::drivers::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceDriver>(
        "UPDATE ambulance_drivers SET \
         license_number = COALESCE($2, license_number), \
         license_type = COALESCE($3, license_type), \
         license_expiry = COALESCE($4, license_expiry), \
         is_active = COALESCE($5, is_active), \
         bls_certified = COALESCE($6, bls_certified), \
         bls_expiry = COALESCE($7, bls_expiry), \
         defensive_driving = COALESCE($8, defensive_driving), \
         shift_pattern = COALESCE($9, shift_pattern), \
         phone = COALESCE($10, phone), \
         notes = COALESCE($11, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.license_number)
    .bind(&body.license_type)
    .bind(body.license_expiry)
    .bind(body.is_active)
    .bind(body.bls_certified)
    .bind(body.bls_expiry)
    .bind(body.defensive_driving)
    .bind(&body.shift_pattern)
    .bind(&body.phone)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Trips
// ══════════════════════════════════════════════════════════

pub async fn list_trips(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTripsQuery>,
) -> Result<Json<Vec<AmbulanceTrip>>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AmbulanceTrip>(
        "SELECT * FROM ambulance_trips \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR trip_type::text = $2) \
         AND ($3::uuid IS NULL OR ambulance_id = $3) \
         AND ($4::text IS NULL OR priority::text = $4) \
         ORDER BY requested_at DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.trip_type)
    .bind(params.ambulance_id)
    .bind(&params.priority)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_trip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AmbulanceTrip>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceTrip>("SELECT * FROM ambulance_trips WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_trip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTripRequest>,
) -> Result<Json<AmbulanceTrip>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let trip_code = format!("TRIP-{ts}-{}", &uid.to_string()[..8]);

    let priority = if body.trip_type == "emergency" && body.priority.is_none() {
        "critical".to_owned()
    } else {
        body.priority.unwrap_or_else(|| "routine".to_owned())
    };

    let row = sqlx::query_as::<_, AmbulanceTrip>(
        "INSERT INTO ambulance_trips \
         (tenant_id, trip_code, ambulance_id, driver_id, \
          trip_type, priority, patient_id, patient_name, patient_phone, \
          pickup_address, pickup_latitude, pickup_longitude, pickup_landmark, \
          drop_address, drop_latitude, drop_longitude, drop_landmark, \
          er_visit_id, transport_request_id, is_billable, requested_by) \
         VALUES ($1,$2,$3,$4, $5::ambulance_trip_type,$6::ambulance_trip_priority, \
                 $7,$8,$9, $10,$11,$12,$13, $14,$15,$16,$17, $18,$19,$20,$21) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&trip_code)
    .bind(body.ambulance_id)
    .bind(body.driver_id)
    .bind(&body.trip_type)
    .bind(&priority)
    .bind(body.patient_id)
    .bind(&body.patient_name)
    .bind(&body.patient_phone)
    .bind(&body.pickup_address)
    .bind(body.pickup_latitude)
    .bind(body.pickup_longitude)
    .bind(&body.pickup_landmark)
    .bind(&body.drop_address)
    .bind(body.drop_latitude)
    .bind(body.drop_longitude)
    .bind(&body.drop_landmark)
    .bind(body.er_visit_id)
    .bind(body.transport_request_id)
    .bind(body.is_billable.unwrap_or(true))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // If ambulance assigned, mark it as on_trip
    if let Some(amb_id) = body.ambulance_id {
        sqlx::query(
            "UPDATE ambulances SET status = 'on_trip', \
             current_driver_id = $2 WHERE id = $1",
        )
        .bind(amb_id)
        .bind(body.driver_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_trip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTripRequest>,
) -> Result<Json<AmbulanceTrip>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceTrip>(
        "UPDATE ambulance_trips SET \
         ambulance_id = COALESCE($2, ambulance_id), \
         driver_id = COALESCE($3, driver_id), \
         patient_id = COALESCE($4, patient_id), \
         patient_name = COALESCE($5, patient_name), \
         patient_phone = COALESCE($6, patient_phone), \
         pickup_address = COALESCE($7, pickup_address), \
         drop_address = COALESCE($8, drop_address), \
         vitals_at_pickup = COALESCE($9, vitals_at_pickup), \
         vitals_at_drop = COALESCE($10, vitals_at_drop), \
         clinical_notes = COALESCE($11, clinical_notes), \
         oxygen_administered = COALESCE($12, oxygen_administered), \
         iv_started = COALESCE($13, iv_started), \
         odometer_start = COALESCE($14, odometer_start), \
         odometer_end = COALESCE($15, odometer_end), \
         base_charge = COALESCE($16, base_charge), \
         per_km_charge = COALESCE($17, per_km_charge), \
         total_amount = COALESCE($18, total_amount) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.ambulance_id)
    .bind(body.driver_id)
    .bind(body.patient_id)
    .bind(&body.patient_name)
    .bind(&body.patient_phone)
    .bind(&body.pickup_address)
    .bind(&body.drop_address)
    .bind(&body.vitals_at_pickup)
    .bind(&body.vitals_at_drop)
    .bind(&body.clinical_notes)
    .bind(body.oxygen_administered)
    .bind(body.iv_started)
    .bind(body.odometer_start)
    .bind(body.odometer_end)
    .bind(body.base_charge)
    .bind(body.per_km_charge)
    .bind(body.total_amount)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_trip_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTripStatusRequest>,
) -> Result<Json<AmbulanceTrip>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Set appropriate timestamp based on new status
    let ts_col = match body.status.as_str() {
        "dispatched" => "dispatched_at",
        "at_pickup" | "en_route_pickup" => "pickup_arrived_at",
        "en_route_drop" => "patient_loaded_at",
        "at_drop" => "drop_arrived_at",
        "completed" => "completed_at",
        "cancelled" => "cancelled_at",
        _ => "updated_at",
    };

    let query = format!(
        "UPDATE ambulance_trips SET \
         status = $2::ambulance_trip_status, \
         {ts_col} = COALESCE({ts_col}, now()), \
         cancellation_reason = COALESCE($3, cancellation_reason), \
         dispatched_by = CASE WHEN $2 = 'dispatched' THEN $4 ELSE dispatched_by END, \
         distance_km = CASE WHEN $2 = 'completed' \
           THEN COALESCE(odometer_end - odometer_start, distance_km) \
           ELSE distance_km END \
         WHERE id = $1 RETURNING *"
    );

    let row = sqlx::query_as::<_, AmbulanceTrip>(&query)
        .bind(id)
        .bind(&body.status)
        .bind(&body.cancellation_reason)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

    // Release ambulance on completion or cancellation
    if body.status == "completed" || body.status == "cancelled" {
        if let Some(amb_id) = row.ambulance_id {
            sqlx::query(
                "UPDATE ambulances SET status = 'available', \
                 current_driver_id = NULL WHERE id = $1",
            )
            .bind(amb_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Auto-bill ambulance transport on trip completion (if billable)
    if body.status == "completed" && row.is_billable {
        if let Some(patient_id) = row.patient_id {
            if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "ambulance")
                .await
                .unwrap_or(false)
            {
                let encounter_id = row.er_visit_id.unwrap_or(row.id);
                let _ = super::billing::create_service_charge(
                    &mut tx,
                    super::billing::ServiceChargeInput {
                        tenant_id: claims.tenant_id,
                        patient_id,
                        encounter_id,
                        charge_code: "AMBULANCE_TRANSPORT",
                        quantity: 1,
                        source_module: "ambulance",
                        source_entity_id: row.id,
                        requested_by: claims.sub,
                    },
                )
                .await;
            }
        }
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ── Trip Logs ───────────────────────────────────────────

pub async fn list_trip_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(trip_id): Path<Uuid>,
) -> Result<Json<Vec<AmbulanceTripLog>>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AmbulanceTripLog>(
        "SELECT * FROM ambulance_trip_logs \
         WHERE trip_id = $1 ORDER BY recorded_at ASC",
    )
    .bind(trip_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn add_trip_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(trip_id): Path<Uuid>,
    Json(body): Json<AddTripLogRequest>,
) -> Result<Json<AmbulanceTripLog>, AppError> {
    require_permission(&claims, permissions::ambulance::trips::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceTripLog>(
        "INSERT INTO ambulance_trip_logs \
         (tenant_id, trip_id, event_type, latitude, longitude, speed_kmh, event_data, recorded_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(trip_id)
    .bind(&body.event_type)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.speed_kmh)
    .bind(&body.event_data)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Maintenance
// ══════════════════════════════════════════════════════════

pub async fn list_maintenance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMaintenanceQuery>,
) -> Result<Json<Vec<AmbulanceMaintenance>>, AppError> {
    require_permission(&claims, permissions::ambulance::maintenance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AmbulanceMaintenance>(
        "SELECT * FROM ambulance_maintenance \
         WHERE ($1::uuid IS NULL OR ambulance_id = $1) \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY scheduled_date DESC LIMIT 200",
    )
    .bind(params.ambulance_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_maintenance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMaintenanceRequest>,
) -> Result<Json<AmbulanceMaintenance>, AppError> {
    require_permission(&claims, permissions::ambulance::maintenance::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceMaintenance>(
        "INSERT INTO ambulance_maintenance \
         (tenant_id, ambulance_id, maintenance_type, scheduled_date, \
          description, vendor_name, cost, odometer_at_service, \
          next_service_km, next_service_date, notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.ambulance_id)
    .bind(&body.maintenance_type)
    .bind(body.scheduled_date)
    .bind(&body.description)
    .bind(&body.vendor_name)
    .bind(body.cost)
    .bind(body.odometer_at_service)
    .bind(body.next_service_km)
    .bind(body.next_service_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_maintenance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMaintenanceRequest>,
) -> Result<Json<AmbulanceMaintenance>, AppError> {
    require_permission(&claims, permissions::ambulance::maintenance::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmbulanceMaintenance>(
        "UPDATE ambulance_maintenance SET \
         maintenance_type = COALESCE($2, maintenance_type), \
         status = COALESCE($3::ambulance_maintenance_status, status), \
         scheduled_date = COALESCE($4, scheduled_date), \
         started_at = CASE WHEN $3 = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END, \
         completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END, \
         description = COALESCE($5, description), \
         vendor_name = COALESCE($6, vendor_name), \
         cost = COALESCE($7, cost), \
         odometer_at_service = COALESCE($8, odometer_at_service), \
         next_service_km = COALESCE($9, next_service_km), \
         next_service_date = COALESCE($10, next_service_date), \
         findings = COALESCE($11, findings), \
         parts_replaced = COALESCE($12, parts_replaced), \
         performed_by = COALESCE($13, performed_by), \
         notes = COALESCE($14, notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.maintenance_type)
    .bind(&body.status)
    .bind(body.scheduled_date)
    .bind(&body.description)
    .bind(&body.vendor_name)
    .bind(body.cost)
    .bind(body.odometer_at_service)
    .bind(body.next_service_km)
    .bind(body.next_service_date)
    .bind(&body.findings)
    .bind(&body.parts_replaced)
    .bind(&body.performed_by)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
