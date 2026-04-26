#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::cssd::{
    CssdIndicatorResult, CssdInstrument, CssdInstrumentSet, CssdIssuance, CssdLoadItem,
    CssdMaintenanceLog, CssdSetItem, CssdSterilizationLoad, CssdSterilizer,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInstrumentRequest {
    pub barcode: String,
    pub name: String,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub purchase_date: Option<String>,
    pub max_uses: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInstrumentRequest {
    pub name: Option<String>,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub status: Option<String>,
    pub max_uses: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSetRequest {
    pub set_code: String,
    pub set_name: String,
    pub department: Option<String>,
    pub description: Option<String>,
    pub items: Option<Vec<SetItemInput>>,
}

#[derive(Debug, Deserialize)]
pub struct SetItemInput {
    pub instrument_id: Uuid,
    pub quantity: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSterilizerRequest {
    pub name: String,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub method: Option<String>,
    pub chamber_size_liters: Option<f64>,
    pub location: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSterilizerRequest {
    pub name: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub method: Option<String>,
    pub chamber_size_liters: Option<f64>,
    pub location: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLoadRequest {
    pub sterilizer_id: Uuid,
    pub method: String,
    pub is_flash: Option<bool>,
    pub flash_reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLoadStatusRequest {
    pub status: String,
    pub cycle_time_minutes: Option<i32>,
    pub temperature_c: Option<f64>,
    pub pressure_psi: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AddLoadItemRequest {
    pub set_id: Option<Uuid>,
    pub instrument_id: Option<Uuid>,
    pub quantity: Option<i32>,
    pub pack_expiry_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordIndicatorRequest {
    pub indicator_type: String,
    pub indicator_brand: Option<String>,
    pub indicator_lot: Option<String>,
    pub result_pass: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIssuanceRequest {
    pub load_item_id: Option<Uuid>,
    pub set_id: Option<Uuid>,
    pub issued_to_department: String,
    pub issued_to_patient_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReturnIssuanceRequest {
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecallIssuanceRequest {
    pub recall_reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaintenanceRequest {
    pub maintenance_type: String,
    pub performed_by: Option<String>,
    pub next_due_at: Option<String>,
    pub findings: Option<String>,
    pub actions_taken: Option<String>,
    pub cost: Option<f64>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Instruments
// ══════════════════════════════════════════════════════════

pub async fn list_instruments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CssdInstrument>>, AppError> {
    require_permission(&claims, permissions::cssd::instruments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdInstrument>("SELECT * FROM cssd_instruments ORDER BY name")
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_instrument(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInstrumentRequest>,
) -> Result<Json<CssdInstrument>, AppError> {
    require_permission(&claims, permissions::cssd::instruments::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdInstrument>(
        "INSERT INTO cssd_instruments (tenant_id, barcode, name, category, manufacturer, purchase_date, max_uses, notes)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.barcode)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.manufacturer)
    .bind(&body.purchase_date)
    .bind(body.max_uses)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_instrument(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInstrumentRequest>,
) -> Result<Json<CssdInstrument>, AppError> {
    require_permission(&claims, permissions::cssd::instruments::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdInstrument>(
        "UPDATE cssd_instruments SET
            name = COALESCE($2, name),
            category = COALESCE($3, category),
            manufacturer = COALESCE($4, manufacturer),
            status = COALESCE($5::instrument_status, status),
            max_uses = COALESCE($6, max_uses),
            notes = COALESCE($7, notes)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.manufacturer)
    .bind(&body.status)
    .bind(body.max_uses)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Instrument Sets
// ══════════════════════════════════════════════════════════

pub async fn list_sets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CssdInstrumentSet>>, AppError> {
    require_permission(&claims, permissions::cssd::sets::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdInstrumentSet>(
        "SELECT * FROM cssd_instrument_sets ORDER BY set_name",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_set(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSetRequest>,
) -> Result<Json<CssdInstrumentSet>, AppError> {
    require_permission(&claims, permissions::cssd::sets::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let set = sqlx::query_as::<_, CssdInstrumentSet>(
        "INSERT INTO cssd_instrument_sets (tenant_id, set_code, set_name, department, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.set_code)
    .bind(&body.set_name)
    .bind(&body.department)
    .bind(&body.description)
    .fetch_one(&mut *tx)
    .await?;

    // Add items if provided
    if let Some(items) = &body.items {
        for item in items {
            sqlx::query(
                "INSERT INTO cssd_set_items (tenant_id, set_id, instrument_id, quantity)
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(claims.tenant_id)
            .bind(set.id)
            .bind(item.instrument_id)
            .bind(item.quantity.unwrap_or(1))
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(Json(set))
}

pub async fn get_set_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(set_id): Path<Uuid>,
) -> Result<Json<Vec<CssdSetItem>>, AppError> {
    require_permission(&claims, permissions::cssd::sets::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdSetItem>("SELECT * FROM cssd_set_items WHERE set_id = $1")
        .bind(set_id)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Sterilizers (Equipment)
// ══════════════════════════════════════════════════════════

pub async fn list_sterilizers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CssdSterilizer>>, AppError> {
    require_permission(&claims, permissions::cssd::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdSterilizer>("SELECT * FROM cssd_sterilizers ORDER BY name")
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_sterilizer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSterilizerRequest>,
) -> Result<Json<CssdSterilizer>, AppError> {
    require_permission(&claims, permissions::cssd::equipment::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdSterilizer>(
        "INSERT INTO cssd_sterilizers (tenant_id, name, model, serial_number, method, chamber_size_liters, location)
         VALUES ($1, $2, $3, $4, COALESCE($5::sterilization_method, 'steam'), $6, $7)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.model)
    .bind(&body.serial_number)
    .bind(&body.method)
    .bind(body.chamber_size_liters)
    .bind(&body.location)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_sterilizer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSterilizerRequest>,
) -> Result<Json<CssdSterilizer>, AppError> {
    require_permission(&claims, permissions::cssd::equipment::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdSterilizer>(
        "UPDATE cssd_sterilizers SET
            name = COALESCE($2, name),
            model = COALESCE($3, model),
            serial_number = COALESCE($4, serial_number),
            method = COALESCE($5::sterilization_method, method),
            chamber_size_liters = COALESCE($6, chamber_size_liters),
            location = COALESCE($7, location),
            is_active = COALESCE($8, is_active)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.model)
    .bind(&body.serial_number)
    .bind(&body.method)
    .bind(body.chamber_size_liters)
    .bind(&body.location)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Sterilization Loads
// ══════════════════════════════════════════════════════════

pub async fn list_loads(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CssdSterilizationLoad>>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdSterilizationLoad>(
        "SELECT * FROM cssd_sterilization_loads ORDER BY created_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_load(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLoadRequest>,
) -> Result<Json<CssdSterilizationLoad>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Generate load number
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM cssd_sterilization_loads WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let load_number = format!("LOAD-{:06}", count.0 + 1);

    let row = sqlx::query_as::<_, CssdSterilizationLoad>(
        "INSERT INTO cssd_sterilization_loads (tenant_id, load_number, sterilizer_id, method, operator_id, is_flash, flash_reason, notes)
         VALUES ($1, $2, $3, $4::sterilization_method, $5, COALESCE($6, FALSE), $7, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&load_number)
    .bind(body.sterilizer_id)
    .bind(&body.method)
    .bind(claims.sub)
    .bind(body.is_flash)
    .bind(&body.flash_reason)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_load_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLoadStatusRequest>,
) -> Result<Json<CssdSterilizationLoad>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let started = if body.status == "running" {
        Some(now)
    } else {
        None
    };
    let completed = if body.status == "completed" || body.status == "failed" {
        Some(now)
    } else {
        None
    };

    let row = sqlx::query_as::<_, CssdSterilizationLoad>(
        "UPDATE cssd_sterilization_loads SET
            status = $2::load_status,
            started_at = COALESCE($3, started_at),
            completed_at = COALESCE($4, completed_at),
            cycle_time_minutes = COALESCE($5, cycle_time_minutes),
            temperature_c = COALESCE($6, temperature_c),
            pressure_psi = COALESCE($7, pressure_psi)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(started)
    .bind(completed)
    .bind(body.cycle_time_minutes)
    .bind(body.temperature_c)
    .bind(body.pressure_psi)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn add_load_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(load_id): Path<Uuid>,
    Json(body): Json<AddLoadItemRequest>,
) -> Result<Json<CssdLoadItem>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdLoadItem>(
        "INSERT INTO cssd_load_items (tenant_id, load_id, set_id, instrument_id, quantity, pack_expiry_date)
         VALUES ($1, $2, $3, $4, COALESCE($5, 1), $6::date)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(load_id)
    .bind(body.set_id)
    .bind(body.instrument_id)
    .bind(body.quantity)
    .bind(&body.pack_expiry_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Indicator Results
// ══════════════════════════════════════════════════════════

pub async fn list_indicators(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(load_id): Path<Uuid>,
) -> Result<Json<Vec<CssdIndicatorResult>>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdIndicatorResult>(
        "SELECT * FROM cssd_indicator_results WHERE load_id = $1 ORDER BY created_at",
    )
    .bind(load_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn record_indicator(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(load_id): Path<Uuid>,
    Json(body): Json<RecordIndicatorRequest>,
) -> Result<Json<CssdIndicatorResult>, AppError> {
    require_permission(&claims, permissions::cssd::sterilization::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdIndicatorResult>(
        "INSERT INTO cssd_indicator_results (tenant_id, load_id, indicator_type, indicator_brand, indicator_lot, result_pass, read_by, notes)
         VALUES ($1, $2, $3::indicator_type, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(load_id)
    .bind(&body.indicator_type)
    .bind(&body.indicator_brand)
    .bind(&body.indicator_lot)
    .bind(body.result_pass)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Issuances
// ══════════════════════════════════════════════════════════

pub async fn list_issuances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CssdIssuance>>, AppError> {
    require_permission(&claims, permissions::cssd::issuance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdIssuance>(
        "SELECT * FROM cssd_issuances ORDER BY issued_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_issuance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIssuanceRequest>,
) -> Result<Json<CssdIssuance>, AppError> {
    require_permission(&claims, permissions::cssd::issuance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdIssuance>(
        "INSERT INTO cssd_issuances (tenant_id, load_item_id, set_id, issued_to_department, issued_to_patient_id, issued_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.load_item_id)
    .bind(body.set_id)
    .bind(&body.issued_to_department)
    .bind(body.issued_to_patient_id)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-bill CSSD issuance if issued to a patient
    if let Some(patient_id) = row.issued_to_patient_id {
        if super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "cssd")
            .await
            .unwrap_or(false)
        {
            let _ = super::billing::create_service_charge(
                &mut tx,
                super::billing::ServiceChargeInput {
                    tenant_id: claims.tenant_id,
                    patient_id,
                    encounter_id: row.id,
                    charge_code: "CSSD_SUPPLY",
                    quantity: 1,
                    source_module: "cssd",
                    source_entity_id: row.id,
                    requested_by: claims.sub,
                },
            )
            .await;
        }
    }

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn return_issuance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(_body): Json<ReturnIssuanceRequest>,
) -> Result<Json<CssdIssuance>, AppError> {
    require_permission(&claims, permissions::cssd::issuance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdIssuance>(
        "UPDATE cssd_issuances SET returned_at = now(), returned_by = $2
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn recall_issuance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RecallIssuanceRequest>,
) -> Result<Json<CssdIssuance>, AppError> {
    require_permission(&claims, permissions::cssd::issuance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdIssuance>(
        "UPDATE cssd_issuances SET is_recalled = TRUE, recall_reason = $2
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.recall_reason)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Maintenance Logs
// ══════════════════════════════════════════════════════════

pub async fn list_maintenance_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(sterilizer_id): Path<Uuid>,
) -> Result<Json<Vec<CssdMaintenanceLog>>, AppError> {
    require_permission(&claims, permissions::cssd::equipment::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CssdMaintenanceLog>(
        "SELECT * FROM cssd_maintenance_logs WHERE sterilizer_id = $1 ORDER BY performed_at DESC",
    )
    .bind(sterilizer_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_maintenance_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(sterilizer_id): Path<Uuid>,
    Json(body): Json<CreateMaintenanceRequest>,
) -> Result<Json<CssdMaintenanceLog>, AppError> {
    require_permission(&claims, permissions::cssd::equipment::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CssdMaintenanceLog>(
        "INSERT INTO cssd_maintenance_logs (tenant_id, sterilizer_id, maintenance_type, performed_by, next_due_at, findings, actions_taken, cost, notes)
         VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(sterilizer_id)
    .bind(&body.maintenance_type)
    .bind(&body.performed_by)
    .bind(&body.next_due_at)
    .bind(&body.findings)
    .bind(&body.actions_taken)
    .bind(body.cost)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Update sterilizer maintenance dates
    sqlx::query(
        "UPDATE cssd_sterilizers SET last_maintenance_at = now(), next_maintenance_at = $2::timestamptz
         WHERE id = $1",
    )
    .bind(sterilizer_id)
    .bind(&body.next_due_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
