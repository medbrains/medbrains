//! `GET /api/abdm/abha/verifications/{id}/card` — print the ABHA card right
//! after verifying or creating it, while ABDM's person token is still alive.

use axum::{
    Extension,
    extract::{Path, State},
    http::header,
    response::{IntoResponse, Response},
};
use medbrains_core::permissions;
use uuid::Uuid;

use super::abha::{connect, map_abdm_error};
use super::abha_common::peek_token;
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// # Errors
/// 400 once ABDM's session for the person has ended (verify again to print);
/// 403 without `abdm.abha.manage`; 503 when ABDM is not answering.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mine: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM abha_verifications \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND stage = 'verified' \
           AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let token = mine.and_then(|_| peek_token(id)).ok_or_else(|| {
        AppError::BadRequest(
            "ABDM's session for this patient has ended — verify the ABHA again to print the card"
                .to_owned(),
        )
    })?;

    let abdm = connect(&state, claims.tenant_id).await?;
    let card = abdm
        .client
        .abha_card(&abdm.session, &token)
        .await
        .map_err(map_abdm_error)?;
    Ok((
        [
            (header::CONTENT_TYPE, card.content_type),
            (header::CACHE_CONTROL, "no-store".to_owned()),
        ],
        card.bytes,
    )
        .into_response())
}
