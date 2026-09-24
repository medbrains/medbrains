//! Who is on the ward tonight.
//!
//! `nurse_shift_assignments` has carried a ward's staffing since it was
//! created and has never had a way to write a row. The consequences were not
//! confined to the table: `ward_on_duty` reads it for the care-view board, and
//! an empty result renders as an unstaffed ward rather than as a ward nobody
//! has rostered. The initial-assessment pipeline picks its assignee from it,
//! and with no rows there is no one to assign, so the task is not raised.
//!
//! This is the maker screen for that table.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// The three shifts the table's check constraint allows.
const SHIFT_TYPES: [&str; 3] = ["day", "evening", "night"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RosterEntry {
    pub id: Uuid,
    pub nurse_user_id: Uuid,
    pub nurse_name: String,
    pub ward_id: Option<Uuid>,
    pub ward_name: Option<String>,
    pub shift_date: NaiveDate,
    pub shift_type: String,
    pub primary_assigned: bool,
    pub is_charge: Option<bool>,
    pub patient_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct ListRosterQuery {
    pub ward_id: Option<Uuid>,
    /// Defaults to today, which is what a ward board wants.
    pub shift_date: Option<NaiveDate>,
}

/// `GET /api/nurse/roster` — who is rostered, for a ward and a date.
pub async fn list_roster(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRosterQuery>,
) -> Result<Json<Vec<RosterEntry>>, AppError> {
    require_permission(&claims, permissions::nurse::roster::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        RosterEntry,
        "SELECT nsa.id, nsa.nurse_user_id, u.full_name AS nurse_name, nsa.ward_id, \
                w.name AS \"ward_name?\", nsa.shift_date, nsa.shift_type, \
                nsa.primary_assigned, \
                (nsa.charge_nurse_user_id = nsa.nurse_user_id) AS is_charge, \
                COALESCE(array_length(nsa.patient_ids, 1), 0) AS \"patient_count!\" \
           FROM nurse_shift_assignments nsa \
           JOIN users u ON u.id = nsa.nurse_user_id \
           LEFT JOIN wards w ON w.id = nsa.ward_id \
          WHERE nsa.tenant_id = $1 AND nsa.deleted_at IS NULL \
            AND ($2::uuid IS NULL OR nsa.ward_id = $2) \
            AND nsa.shift_date = COALESCE($3::date, CURRENT_DATE) \
          ORDER BY nsa.shift_type, nsa.primary_assigned DESC, u.full_name \
          LIMIT 500",
        claims.tenant_id,
        q.ward_id,
        q.shift_date,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct RosterCandidate {
    pub id: Uuid,
    pub full_name: String,
}

/// `GET /api/nurse/roster/candidates` — the nurses who can be rostered.
///
/// Its own endpoint rather than the admin user directory, which needs
/// `admin.users.list`: a charge nurse on a custom role that holds only
/// `nurse.roster.manage` must be able to fill the picker, and widening the
/// directory to her would hand her every account in the hospital.
pub async fn list_roster_candidates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RosterCandidate>>, AppError> {
    require_permission(&claims, permissions::nurse::roster::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        RosterCandidate,
        "SELECT id, full_name FROM users \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND role::text = 'nurse' \
          ORDER BY full_name LIMIT 500",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRosterEntryRequest {
    pub nurse_user_id: Uuid,
    pub ward_id: Uuid,
    pub shift_type: String,
    pub shift_date: Option<NaiveDate>,
    pub primary_assigned: Option<bool>,
    pub is_charge: Option<bool>,
}

/// `POST /api/nurse/roster` — put a nurse on a ward's shift.
pub async fn create_roster_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRosterEntryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::roster::MANAGE)?;

    // Checked here rather than left to the table's constraint, so the caller
    // is told which words are allowed instead of reading a constraint name.
    if !SHIFT_TYPES.contains(&body.shift_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "shift_type must be one of {}",
            SHIFT_TYPES.join(", ")
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = sqlx::query_scalar!(
        "INSERT INTO nurse_shift_assignments \
           (tenant_id, nurse_user_id, ward_id, shift_date, shift_type, patient_ids, \
            primary_assigned, charge_nurse_user_id) \
         VALUES ($1::uuid, $2::uuid, $3::uuid, COALESCE($4::date, CURRENT_DATE), $5::text, \
                 ARRAY[]::uuid[], COALESCE($6::bool, true), \
                 CASE WHEN COALESCE($7::bool, false) THEN $2::uuid ELSE NULL END) \
         RETURNING id",
        claims.tenant_id,
        body.nurse_user_id,
        body.ward_id,
        body.shift_date,
        body.shift_type,
        body.primary_assigned,
        body.is_charge,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| match err {
        // The unique index added in migration 1014. Rostering the same nurse
        // twice is a double-click, not a failure worth a 500 — and the ward
        // board counts these rows, so a duplicate would show one nurse as two.
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505") => {
            AppError::Conflict(
                "That nurse is already rostered on this ward for that shift.".to_owned(),
            )
        }
        err => err.into(),
    })?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

/// `DELETE /api/nurse/roster/{id}` — take a nurse off a shift.
///
/// Soft, so the roster keeps its history: who was on the ward on a given
/// night is exactly the question an incident review asks afterwards.
pub async fn delete_roster_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::roster::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let removed = sqlx::query_scalar!(
        "UPDATE nurse_shift_assignments \
            SET deleted_at = now(), deleted_by = $3 \
          WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL \
          RETURNING id",
        claims.tenant_id,
        id,
        claims.sub,
    )
        .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": removed })))
}
