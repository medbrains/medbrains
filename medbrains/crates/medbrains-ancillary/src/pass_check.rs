//! A visitor pass checked at the gate: the guard scans its QR (the pass
//! number) and sees at once whether it lets this person in now, who it was
//! issued to — with their ID and photo, to match the person in front of
//! them — and which ward and bed it opens.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct PassScanQuery {
    /// What the QR carries: the pass number.
    pub code: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PassCheck {
    /// Lets the holder in now.
    pub valid: bool,
    /// Why not, when it doesn't: "revoked", "expired" or "`not_yet_valid`".
    pub reason: Option<String>,
    pub pass_number: String,
    pub visitor_name: String,
    pub relationship: Option<String>,
    pub category: String,
    pub id_type: Option<String>,
    pub id_number: Option<String>,
    pub photo_url: Option<String>,
    pub ward_name: Option<String>,
    pub bed_number: Option<String>,
    pub valid_until: DateTime<Utc>,
    pub revoked_reason: Option<String>,
}

/// `GET /api/front-office/passes/scan?code=VP-…` — 404 for no such pass.
pub async fn scan_pass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PassScanQuery>,
) -> Result<Json<PassCheck>, AppError> {
    require_permission(&claims, permissions::front_office::passes::VERIFY)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, PassCheck>(
        "SELECT (p.status::text = 'active' AND now() BETWEEN p.valid_from AND p.valid_until) AS valid, \
                CASE WHEN p.status::text = 'revoked' THEN 'revoked' \
                     WHEN p.status::text = 'expired' OR now() > p.valid_until THEN 'expired' \
                     WHEN now() < p.valid_from THEN 'not_yet_valid' END AS reason, \
                p.pass_number, r.visitor_name, r.relationship, r.category::text AS category, \
                r.id_type::text AS id_type, r.id_number, r.photo_url, w.name AS ward_name, \
                p.bed_number, p.valid_until, p.revoked_reason \
           FROM visitor_passes p \
           JOIN visitor_registrations r ON r.id = p.registration_id AND r.deleted_at IS NULL \
           LEFT JOIN wards w ON w.id = p.ward_id \
          WHERE p.tenant_id = $1 AND upper(p.pass_number) = upper($2) AND p.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(q.code.trim())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
