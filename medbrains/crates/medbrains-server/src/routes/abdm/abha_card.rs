//! `GET /api/abdm/abha/verifications/{id}/card` and `…/qr` — the ABHA card to
//! print and the QR to show, right after verifying or creating the ABHA,
//! while ABDM's person token is still alive.

use axum::{
    Extension,
    extract::{Path, State},
    http::header,
    response::{IntoResponse, Response},
};
use medbrains_abdm::AbhaImage;
use medbrains_core::permissions;
use uuid::Uuid;

use super::abha::{connect, map_abdm_error};
use super::abha_address::is_address;
use super::abha_common::peek_token;
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// # Errors
/// 400 once ABDM's session for the person has ended (verify again);
/// 403 without `abdm.abha.manage`; 503 when ABDM is not answering.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    image(&state, &claims, id, AbhaImage::Card).await
}

/// # Errors
/// As for [`card`].
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn qr(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Response, AppError> {
    image(&state, &claims, id, AbhaImage::Qr).await
}

async fn image(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    which: AbhaImage,
) -> Result<Response, AppError> {
    require_permission(claims, permissions::abdm::abha::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let method: Option<String> = sqlx::query_scalar(
        "SELECT method FROM abha_verifications \
         WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND stage = 'verified' \
           AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let (Some(method), Some(token)) = (method, peek_token(id)) else {
        return Err(AppError::BadRequest(
            "ABDM's session for this patient has ended — verify the ABHA again".to_owned(),
        ));
    };

    let abdm = connect(state, claims.tenant_id).await?;
    let image = abdm
        .client
        .abha_image(&abdm.session, &token, which, is_address(&method))
        .await
        .map_err(map_abdm_error)?;
    Ok((
        [
            (header::CONTENT_TYPE, image.content_type),
            (header::CACHE_CONTROL, "no-store".to_owned()),
        ],
        image.bytes,
    )
        .into_response())
}
