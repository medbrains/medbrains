use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Row / Request types — Drug Recalls
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyDrugRecall {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub recall_number: String,
    pub drug_id: Option<Uuid>,
    pub drug_name: Option<String>,
    pub batch_numbers: Vec<String>,
    pub reason: String,
    pub severity: String,
    pub status: String,
    pub manufacturer_ref: Option<String>,
    pub fda_ref: Option<String>,
    pub affected_patients_count: Option<i32>,
    pub initiated_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRecallRequest {
    pub drug_id: Option<Uuid>,
    pub drug_name: Option<String>,
    pub batch_numbers: Vec<String>,
    pub reason: String,
    pub severity: String,
    pub manufacturer_ref: Option<String>,
    pub fda_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRecallsQuery {
    pub status: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Row / Request types — Destruction Register
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyDestructionLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub certificate_number: String,
    pub destruction_date: DateTime<Utc>,
    pub method: String,
    pub items: Value,
    pub total_quantity: i32,
    pub total_value: rust_decimal::Decimal,
    pub reason: String,
    pub witness_name: String,
    pub authorized_by: Option<Uuid>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDestructionRequest {
    pub destruction_date: DateTime<Utc>,
    pub method: String,
    pub items: Value,
    pub total_quantity: i32,
    pub total_value: rust_decimal::Decimal,
    pub reason: String,
    pub witness_name: String,
    pub authorized_by: Option<Uuid>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Row / Request types — Generic Substitution
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacySubstitute {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub brand_drug_id: Uuid,
    pub generic_drug_id: Uuid,
    pub brand_name: Option<String>,
    pub brand_price: Option<rust_decimal::Decimal>,
    pub generic_name: Option<String>,
    pub generic_price: Option<rust_decimal::Decimal>,
    pub current_stock: Option<i32>,
    pub price_difference: Option<rust_decimal::Decimal>,
    pub is_therapeutic_equivalent: bool,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubstituteRequest {
    pub brand_drug_id: Uuid,
    pub generic_drug_id: Uuid,
    pub is_therapeutic_equivalent: Option<bool>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Row / Request types — Emergency Kits
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyEmergencyKit {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub kit_code: String,
    pub kit_type: String,
    pub location_id: Option<Uuid>,
    pub location_description: String,
    pub department_id: Option<Uuid>,
    pub items: Value,
    pub status: String,
    pub check_interval_days: i32,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub last_checked_by: Option<Uuid>,
    pub next_check_due: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateKitRequest {
    pub kit_code: String,
    pub kit_type: String,
    pub location_id: Option<Uuid>,
    pub location_description: String,
    pub department_id: Option<Uuid>,
    pub items: Value,
    pub check_interval_days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RestockKitRequest {
    pub items: Value,
}

// ══════════════════════════════════════════════════════════
//  Drug Recall handlers
// ══════════════════════════════════════════════════════════

pub async fn list_recalls(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRecallsQuery>,
) -> Result<Json<Vec<PharmacyDrugRecall>>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PharmacyDrugRecall>(
        "SELECT * FROM pharmacy_drug_recalls \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_recall(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRecallRequest>,
) -> Result<Json<PharmacyDrugRecall>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let recall_number = format!("RCL-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, PharmacyDrugRecall>(
        "INSERT INTO pharmacy_drug_recalls \
         (tenant_id, recall_number, drug_id, drug_name, batch_numbers, \
          reason, severity, manufacturer_ref, fda_ref, initiated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&recall_number)
    .bind(body.drug_id)
    .bind(&body.drug_name)
    .bind(&body.batch_numbers)
    .bind(&body.reason)
    .bind(&body.severity)
    .bind(&body.manufacturer_ref)
    .bind(&body.fda_ref)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_recall(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyDrugRecall>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PharmacyDrugRecall>(
        "UPDATE pharmacy_drug_recalls SET \
         status = 'completed', completed_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('initiated', 'in_progress') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct AffectedPatientRow {
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub order_date: DateTime<Utc>,
    pub quantity: i32,
}

pub async fn get_recall_affected_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let recall = sqlx::query_as::<_, PharmacyDrugRecall>(
        "SELECT * FROM pharmacy_drug_recalls WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let patients = sqlx::query_as::<_, AffectedPatientRow>(
        "SELECT DISTINCT p.id AS patient_id, \
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name, \
                p.uhid, \
                po.created_at AS order_date, \
                poi.quantity \
         FROM pharmacy_order_items poi \
         JOIN pharmacy_orders po ON poi.order_id = po.id \
         JOIN patients p ON po.patient_id = p.id \
         WHERE poi.batch_number = ANY($1) \
           AND po.tenant_id = $2 \
         ORDER BY po.created_at DESC",
    )
    .bind(&recall.batch_numbers)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let count = i32::try_from(patients.len()).unwrap_or(0);

    sqlx::query(
        "UPDATE pharmacy_drug_recalls SET \
         affected_patients_count = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(count)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "recall_id": id,
        "affected_patients_count": count,
        "patients": patients,
    })))
}

// ══════════════════════════════════════════════════════════
//  Destruction Register handlers
// ══════════════════════════════════════════════════════════

pub async fn list_destructions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyDestructionLog>>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PharmacyDestructionLog>(
        "SELECT * FROM pharmacy_destruction_log \
         WHERE tenant_id = $1 \
         ORDER BY destruction_date DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_destruction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDestructionRequest>,
) -> Result<Json<PharmacyDestructionLog>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let certificate_number = format!("DEST-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, PharmacyDestructionLog>(
        "INSERT INTO pharmacy_destruction_log \
         (tenant_id, certificate_number, destruction_date, method, items, \
          total_quantity, total_value, reason, witness_name, authorized_by, \
          notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&certificate_number)
    .bind(body.destruction_date)
    .bind(&body.method)
    .bind(&body.items)
    .bind(body.total_quantity)
    .bind(body.total_value)
    .bind(&body.reason)
    .bind(&body.witness_name)
    .bind(body.authorized_by)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_destruction_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyDestructionLog>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PharmacyDestructionLog>(
        "SELECT * FROM pharmacy_destruction_log WHERE id = $1 AND tenant_id = $2",
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
//  Generic Substitution handlers
// ══════════════════════════════════════════════════════════

pub async fn list_substitutes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(drug_id): Path<Uuid>,
) -> Result<Json<Vec<PharmacySubstitute>>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PharmacySubstitute>(
        "SELECT ps.*, \
                brand.name AS brand_name, brand.mrp AS brand_price, \
                generic.name AS generic_name, generic.mrp AS generic_price, \
                generic.current_stock \
         FROM pharmacy_substitutes ps \
         JOIN pharmacy_catalog brand ON ps.brand_drug_id = brand.id \
         JOIN pharmacy_catalog generic ON ps.generic_drug_id = generic.id \
         WHERE (ps.brand_drug_id = $1 OR ps.generic_drug_id = $1) \
           AND ps.tenant_id = $2 \
         ORDER BY ps.created_at DESC",
    )
    .bind(drug_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_substitute(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSubstituteRequest>,
) -> Result<Json<PharmacySubstitute>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PharmacySubstitute>(
        "WITH prices AS ( \
             SELECT \
               (SELECT mrp FROM pharmacy_catalog WHERE id = $3) AS brand_mrp, \
               (SELECT mrp FROM pharmacy_catalog WHERE id = $4) AS generic_mrp \
         ) \
         INSERT INTO pharmacy_substitutes \
         (tenant_id, brand_drug_id, generic_drug_id, \
          price_difference, is_therapeutic_equivalent, notes, created_by) \
         SELECT $1, $3, $4, \
                COALESCE(p.brand_mrp, 0) - COALESCE(p.generic_mrp, 0), \
                $5, $6, $7 \
         FROM prices p \
         RETURNING *, \
           (SELECT name FROM pharmacy_catalog WHERE id = brand_drug_id) AS brand_name, \
           (SELECT mrp FROM pharmacy_catalog WHERE id = brand_drug_id) AS brand_price, \
           (SELECT name FROM pharmacy_catalog WHERE id = generic_drug_id) AS generic_name, \
           (SELECT mrp FROM pharmacy_catalog WHERE id = generic_drug_id) AS generic_price, \
           (SELECT current_stock FROM pharmacy_catalog WHERE id = generic_drug_id) \
             AS current_stock",
    )
    .bind(claims.tenant_id)                              // $1
    .bind(claims.sub)                                     // $2 — unused in this query
    .bind(body.brand_drug_id)                             // $3
    .bind(body.generic_drug_id)                           // $4
    .bind(body.is_therapeutic_equivalent.unwrap_or(false)) // $5
    .bind(&body.notes)                                    // $6
    .bind(claims.sub)                                     // $7
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Emergency Kit handlers
// ══════════════════════════════════════════════════════════

pub async fn list_kits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyEmergencyKit>>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PharmacyEmergencyKit>(
        "SELECT * FROM pharmacy_emergency_kits \
         WHERE tenant_id = $1 \
         ORDER BY next_check_due ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_kit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateKitRequest>,
) -> Result<Json<PharmacyEmergencyKit>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let interval_days = body.check_interval_days.unwrap_or(30);

    let row = sqlx::query_as::<_, PharmacyEmergencyKit>(
        "INSERT INTO pharmacy_emergency_kits \
         (tenant_id, kit_code, kit_type, location_id, location_description, \
          department_id, items, check_interval_days, \
          next_check_due, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \
                 now() + ($8 || ' days')::interval, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.kit_code)
    .bind(&body.kit_type)
    .bind(body.location_id)
    .bind(&body.location_description)
    .bind(body.department_id)
    .bind(&body.items)
    .bind(interval_days)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn check_kit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyEmergencyKit>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PharmacyEmergencyKit>(
        "UPDATE pharmacy_emergency_kits SET \
         last_checked_at = now(), \
         last_checked_by = $3, \
         next_check_due = now() + (check_interval_days || ' days')::interval, \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn restock_kit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RestockKitRequest>,
) -> Result<Json<PharmacyEmergencyKit>, AppError> {
    require_permission(&claims, permissions::pharmacy::safety::OVERRIDE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PharmacyEmergencyKit>(
        "UPDATE pharmacy_emergency_kits SET \
         items = $3, status = 'active', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.items)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}
