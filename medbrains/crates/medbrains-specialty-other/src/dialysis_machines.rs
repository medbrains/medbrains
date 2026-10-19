//! The dialysis unit's machines, its dialyzer reuse limit, and who is booked
//! on which machine for which shift.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dialysis_rules::{self, DEFAULT_MAX_USES, MAX_ALLOWED_USES, SEROLOGIES, SHIFTS};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DialysisMachine {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub serology: String,
    pub status: String,
    pub location: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MachineInput {
    pub code: String,
    pub name: String,
    pub serology: String,
    pub status: Option<String>,
    pub location: Option<String>,
}

fn check_choice(value: &str, allowed: &[&str], what: &str) -> Result<(), AppError> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("{what} must be one of: {}", allowed.join(", "))))
    }
}

/// `GET /api/specialty/dialysis/machines`
pub async fn list_machines(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DialysisMachine>>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DialysisMachine>(
        "SELECT id, code, name, serology, status, location FROM dialysis_machines \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY code LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/specialty/dialysis/machines` — add a machine, or update the one with that code.
pub async fn save_machine(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MachineInput>,
) -> Result<Json<DialysisMachine>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::CONFIGURE)?;
    let code = body.code.trim().to_uppercase();
    if code.is_empty() || body.name.trim().is_empty() {
        return Err(AppError::BadRequest("A machine needs a code and a name".to_owned()));
    }
    check_choice(&body.serology, SEROLOGIES, "Serology")?;
    let status = body.status.as_deref().unwrap_or("active");
    check_choice(status, &["active", "maintenance", "retired"], "Status")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, DialysisMachine>(
        "INSERT INTO dialysis_machines (tenant_id, code, name, serology, status, location) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO UPDATE SET \
           name = EXCLUDED.name, serology = EXCLUDED.serology, status = EXCLUDED.status, \
           location = EXCLUDED.location \
         RETURNING id, code, name, serology, status, location",
    )
    .bind(claims.tenant_id)
    .bind(&code)
    .bind(body.name.trim())
    .bind(&body.serology)
    .bind(status)
    .bind(body.location.as_deref().map(str::trim).filter(|l| !l.is_empty()))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The hospital's dialyzer reuse limit (seronegative patients).
pub(crate) async fn reuse_limit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
) -> Result<i32, AppError> {
    let set: Option<i32> = sqlx::query_scalar(
        "SELECT (value #>> '{}')::int FROM tenant_settings WHERE tenant_id = $1 \
           AND category = 'dialysis' AND key = 'dialyzer_max_uses' AND deleted_at IS NULL",
    )
    .bind(tenant)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(set.unwrap_or(DEFAULT_MAX_USES))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReusePolicy {
    pub max_uses: i32,
}

/// `GET /api/specialty/dialysis/reuse-policy`
pub async fn get_reuse_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ReusePolicy>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let max_uses = reuse_limit(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(ReusePolicy { max_uses }))
}

/// `PUT /api/specialty/dialysis/reuse-policy` — applies to dialyzers issued from now on.
pub async fn set_reuse_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReusePolicy>,
) -> Result<Json<ReusePolicy>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::CONFIGURE)?;
    if !(1..=MAX_ALLOWED_USES).contains(&body.max_uses) {
        return Err(AppError::BadRequest(format!("Reuse must be 1–{MAX_ALLOWED_USES}")));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'dialysis', 'dialyzer_max_uses', to_jsonb($2::int)) \
         ON CONFLICT (tenant_id, category, key) WHERE deleted_at IS NULL \
         DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(claims.tenant_id)
    .bind(body.max_uses)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(body))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DialysisSlot {
    pub id: Uuid,
    pub machine_id: Uuid,
    pub machine_code: String,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub slot_date: NaiveDate,
    pub shift: String,
    pub serology: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SlotQuery {
    pub date: NaiveDate,
}

const SLOT_SELECT: &str = "SELECT s.id, s.machine_id, m.code AS machine_code, s.patient_id, \
        concat_ws(' ', p.first_name, p.last_name) AS patient_name, p.uhid, s.slot_date, s.shift, \
        s.serology, s.status, s.created_at \
   FROM dialysis_slots s \
   JOIN dialysis_machines m ON m.id = s.machine_id \
   LEFT JOIN patients p ON p.id = s.patient_id AND p.tenant_id = s.tenant_id \
  WHERE s.tenant_id = $1 AND s.deleted_at IS NULL";

/// `GET /api/specialty/dialysis/slots?date=` — the day's bookings, by shift and machine.
pub async fn list_slots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SlotQuery>,
) -> Result<Json<Vec<DialysisSlot>>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DialysisSlot>(&format!(
        "{SLOT_SELECT} AND s.slot_date = $2 AND s.status <> 'cancelled' \
         ORDER BY array_position(ARRAY['morning','afternoon','evening','night'], s.shift), m.code"
    ))
    .bind(claims.tenant_id)
    .bind(q.date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct BookSlot {
    pub machine_id: Uuid,
    pub patient_id: Uuid,
    pub slot_date: NaiveDate,
    pub shift: String,
    pub serology: String,
}

/// `POST /api/specialty/dialysis/slots`
pub async fn book_slot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BookSlot>,
) -> Result<Json<DialysisSlot>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    check_choice(&body.shift, SHIFTS, "Shift")?;
    check_choice(&body.serology, SEROLOGIES, "Serology")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let machine: (String, String) = sqlx::query_as(
        "SELECT serology, status FROM dialysis_machines \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(body.machine_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if let Some(refusal) = dialysis_rules::refuse_machine(&machine.0, &machine.1, &body.serology) {
        return Err(AppError::Conflict(refusal));
    }
    let id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO dialysis_slots (tenant_id, machine_id, patient_id, slot_date, shift, serology, booked_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.machine_id)
    .bind(body.patient_id)
    .bind(body.slot_date)
    .bind(&body.shift)
    .bind(&body.serology)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let id = id.ok_or_else(|| {
        AppError::Conflict(format!("That machine is already booked for the {} shift", body.shift))
    })?;
    let slot = sqlx::query_as::<_, DialysisSlot>(&format!("{SLOT_SELECT} AND s.id = $2"))
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(slot))
}

/// `POST /api/specialty/dialysis/slots/{id}/cancel`
pub async fn cancel_slot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE dialysis_slots SET status = 'cancelled' \
          WHERE id = $1 AND tenant_id = $2 AND status = 'booked' AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if done == 0 {
        return Err(AppError::Conflict("Only a booked shift can be cancelled".to_owned()));
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "cancelled" })))
}
