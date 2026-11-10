//! The code-blue team roster: who a code blue pages, by tier.
//!
//! The maker screen for `code_blue_team_members` and for the two escalation
//! settings. Without it the roster would stay empty and every code would fall
//! back to the ward shift or to every clinician — which the code-blue screen
//! says, but which nobody could fix.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

use crate::code_blue_escalation::{
    DEFAULT_MAX_ROUNDS, DEFAULT_RESPONSE_SECS, MAX_ROUNDS_KEY, MAX_ROUNDS_RANGE, RESPONSE_SECS_KEY,
    RESPONSE_SECS_RANGE,
};

/// `tenant_settings` category of the two escalation settings; the
/// escalation pass reads the same rows.
const SETTINGS_CATEGORY: &str = "operations";

/// One escalation setting through the kernel's config: a positive integer,
/// else `default`.
async fn setting(tx: &mut medbrains_kernel::Tx, key: &str, default: i32) -> Result<i32, AppError> {
    let tenant_id = tx.actor().tenant_id;
    let value =
        medbrains_kernel::config::setting_in(tx, &tenant_id, SETTINGS_CATEGORY, key).await?;
    Ok(value
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .and_then(|n| i32::try_from(n).ok())
        .filter(|n| *n > 0)
        .unwrap_or(default))
}

/// The codes a roster can be kept for: the nursing code blue and the floor
/// codes on `er_code_activations`.
const CODE_TYPES: [&str; 7] = [
    "code_blue",
    "code_yellow",
    "code_pink",
    "code_orange",
    "code_red",
    "code_silver",
    "code_black",
];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CodeTeamMember {
    pub id: Uuid,
    pub user_id: Uuid,
    pub full_name: String,
    pub code_type: String,
    pub tier: i16,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CodeTeamCandidate {
    pub id: Uuid,
    pub full_name: String,
    pub role: String,
}

/// The roster screen in one round trip.
#[derive(Debug, Serialize)]
pub struct CodeTeamRoster {
    pub members: Vec<CodeTeamMember>,
    pub candidates: Vec<CodeTeamCandidate>,
    pub response_secs: i32,
    pub max_rounds: i32,
}

/// `GET /api/nurse/code-blue/team` — the roster, who can be added, and the
/// escalation settings.
pub async fn get_code_team(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CodeTeamRoster>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::MANAGE_TEAM)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;

    let members = sqlx::query_as::<_, CodeTeamMember>(
        "SELECT m.id, m.user_id, u.full_name, m.code_type, m.tier \
           FROM code_blue_team_members m \
           JOIN users u ON u.id = m.user_id AND u.is_active = true AND u.deleted_at IS NULL \
          WHERE m.tenant_id = $1 AND m.deleted_at IS NULL \
          ORDER BY m.code_type, m.tier, u.full_name LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    // Clinicians, administrators and security: a medical superintendent is
    // often an administrator account, and a Code Pink is answered by guards.
    let candidates = sqlx::query_as::<_, CodeTeamCandidate>(
        "SELECT id, full_name, role::text AS role FROM users \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND role::text IN ('doctor', 'nurse', 'hospital_admin', 'security_guard') \
          ORDER BY full_name LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let response_secs = setting(&mut tx, RESPONSE_SECS_KEY, DEFAULT_RESPONSE_SECS).await?;
    let max_rounds = setting(&mut tx, MAX_ROUNDS_KEY, DEFAULT_MAX_ROUNDS).await?;
    tx.commit().await?;
    let clamp = |v: i32, (lo, hi): (i32, i32)| v.clamp(lo, hi);
    Ok(Json(CodeTeamRoster {
        members,
        candidates,
        response_secs: clamp(response_secs, RESPONSE_SECS_RANGE),
        max_rounds: clamp(max_rounds, MAX_ROUNDS_RANGE),
    }))
}

#[derive(Debug, Deserialize)]
pub struct AddCodeTeamMemberRequest {
    pub user_id: Uuid,
    /// 1 code team, 2 duty medical officer, 3 medical superintendent.
    pub tier: i16,
    /// Which code's roster; the code blue's when left out.
    pub code_type: Option<String>,
}

/// `POST /api/nurse/code-blue/team` — put someone on a tier.
pub async fn add_code_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddCodeTeamMemberRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::MANAGE_TEAM)?;
    if !(1..=3).contains(&body.tier) {
        return Err(AppError::BadRequest(
            "tier must be 1 (code team), 2 (duty medical officer) or 3 (medical superintendent)"
                .to_owned(),
        ));
    }
    let code_type = body.code_type.as_deref().unwrap_or("code_blue");
    if !CODE_TYPES.contains(&code_type) {
        return Err(AppError::BadRequest(format!(
            "code_type must be one of {}",
            CODE_TYPES.join(", ")
        )));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO code_blue_team_members (tenant_id, user_id, tier, added_by, code_type) \
         SELECT $1, u.id, $3, $4, $5 FROM users u \
          WHERE u.id = $2 AND u.tenant_id = $1 AND u.is_active = true AND u.deleted_at IS NULL \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.user_id)
    .bind(body.tier)
    .bind(claims.sub)
    .bind(code_type)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|err| match err {
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505") => {
            AppError::Conflict("That person is already on this tier.".to_owned())
        }
        err => err.into(),
    })?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

/// `DELETE /api/nurse/code-blue/team/{id}` — take someone off the roster.
/// Soft, so a review can still see who was on the team on a given night.
pub async fn remove_code_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::MANAGE_TEAM)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let removed = sqlx::query(
        "UPDATE code_blue_team_members SET deleted_at = now(), deleted_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if removed == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "removed": true })))
}

#[derive(Debug, Deserialize)]
pub struct CodeTeamSettingsRequest {
    pub response_secs: i32,
    pub max_rounds: i32,
}

/// `PUT /api/nurse/code-blue/team/settings` — how long before a re-page, and
/// how many rounds at most.
pub async fn update_code_team_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CodeTeamSettingsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::MANAGE_TEAM)?;
    let in_range = |v: i32, (lo, hi): (i32, i32)| (lo..=hi).contains(&v);
    if !in_range(body.response_secs, RESPONSE_SECS_RANGE)
        || !in_range(body.max_rounds, MAX_ROUNDS_RANGE)
    {
        return Err(AppError::BadRequest(format!(
            "re-page after {}-{} seconds, at most {}-{} rounds",
            RESPONSE_SECS_RANGE.0, RESPONSE_SECS_RANGE.1, MAX_ROUNDS_RANGE.0, MAX_ROUNDS_RANGE.1
        )));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    for (key, value) in [
        (RESPONSE_SECS_KEY, body.response_secs),
        (MAX_ROUNDS_KEY, body.max_rounds),
    ] {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, $2, $3, to_jsonb($4::int)) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE \
               SET value = EXCLUDED.value, deleted_at = NULL, deleted_by = NULL, \
                   delete_reason = NULL",
        )
        .bind(claims.tenant_id)
        .bind(SETTINGS_CATEGORY)
        .bind(key)
        .bind(value)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "updated": true })))
}
