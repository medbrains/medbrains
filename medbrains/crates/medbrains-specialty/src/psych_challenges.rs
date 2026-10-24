//! MHCA s.11 applications to the Board against an advance directive.
//!
//! The only lawful route to not following a directive. A pending
//! application does not suspend it; the Board's decision may.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_authz_gate::mental_health::{
    PsychChild, require_psych_child_access, require_psych_record_access,
};
use medbrains_core::permissions;
use medbrains_core::specialty::psychiatry::PsychDirectiveChallenge;
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::psych_legal::non_blank;

#[derive(Debug, Deserialize)]
pub struct DecideChallengeRequest {
    /// `upheld` (directive stands), `modified` or `cancelled`.
    pub status: String,
    pub board_reference: Option<String>,
    pub decision_note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChallengeRequest {
    pub applicant_role: String,
    pub grounds: Vec<String>,
    pub details: String,
}

pub async fn list_challenges(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(psych_patient_id): Path<Uuid>,
) -> Result<Json<Vec<PsychDirectiveChallenge>>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::patients::LIST)?;
    require_psych_record_access(&state, &claims, psych_patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as!(
        PsychDirectiveChallenge,
        "SELECT c.id, c.tenant_id, c.advance_directive_id, c.applicant_role, c.grounds, c.details, \
                c.status, c.board_reference, c.decided_at, c.decision_note, c.filed_by, \
                c.created_at, c.updated_at \
           FROM psych_directive_challenges c \
           JOIN psych_advance_directives d ON d.id = c.advance_directive_id \
          WHERE d.psych_patient_id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL \
          ORDER BY c.created_at DESC LIMIT 100",
        psych_patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_challenge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(directive_id): Path<Uuid>,
    Json(body): Json<CreateChallengeRequest>,
) -> Result<Json<PsychDirectiveChallenge>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::psychiatry::directives::CHALLENGE,
    )?;
    require_psych_child_access(&state, &claims, PsychChild::AdvanceDirective, directive_id).await?;
    if body.grounds.is_empty() || body.details.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Name at least one ground under s.11(2) and explain it".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychDirectiveChallenge,
        "INSERT INTO psych_directive_challenges \
           (tenant_id, advance_directive_id, applicant_role, grounds, details, filed_by) \
         SELECT $1, d.id, $3, $4, $5, $6 FROM psych_advance_directives d \
          WHERE d.id = $2 AND d.tenant_id = $1 AND d.status = 'active' \
         RETURNING id, tenant_id, advance_directive_id, applicant_role, grounds, details, status, \
                board_reference, decided_at, decision_note, filed_by, created_at, updated_at",
        claims.tenant_id,
        directive_id,
        body.applicant_role,
        &body.grounds,
        body.details.trim(),
        claims.sub,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("Only an active directive can be challenged".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Record the Board's decision; a modified or cancelled directive stops
/// governing treatment from now on.
pub async fn decide_challenge(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecideChallengeRequest>,
) -> Result<Json<PsychDirectiveChallenge>, AppError> {
    require_permission(&claims, permissions::specialty::psychiatry::mhrb::MANAGE)?;
    require_psych_child_access(&state, &claims, PsychChild::DirectiveChallenge, id).await?;
    let directive_status = match body.status.as_str() {
        "upheld" => None,
        "modified" => Some("modified_by_board"),
        "cancelled" => Some("cancelled_by_board"),
        _ => {
            return Err(AppError::BadRequest(
                "The Board upholds, modifies or cancels the directive".to_owned(),
            ));
        }
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as!(
        PsychDirectiveChallenge,
        "UPDATE psych_directive_challenges SET status = $3, board_reference = $4, \
                decision_note = $5, decided_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'pending_board' AND deleted_at IS NULL \
         RETURNING id, tenant_id, advance_directive_id, applicant_role, grounds, details, status, \
                board_reference, decided_at, decision_note, filed_by, created_at, updated_at",
        id,
        claims.tenant_id,
        body.status,
        non_blank(body.board_reference.as_ref()),
        non_blank(body.decision_note.as_ref()),
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict("The Board has already decided this application".to_owned())
    })?;
    if let Some(status) = directive_status {
        sqlx::query!(
            "UPDATE psych_advance_directives SET status = $3 \
              WHERE id = $1 AND tenant_id = $2 AND status = 'active'",
            row.advance_directive_id,
            claims.tenant_id,
            status,
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(Json(row))
}
