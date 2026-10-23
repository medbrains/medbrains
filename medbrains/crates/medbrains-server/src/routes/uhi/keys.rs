//! `POST /api/uhi/settings/keys` — this hospital's UHI signing key pair.
//!
//! Generated here, or imported from NHA's header generation utility
//! (github.com/NHA-ABDM/UHI/tree/main/header_generator_utility). The private
//! half is sealed before it is stored; only the public half is ever shown.

use axum::{Extension, Json, body::Bytes, extract::State};
use medbrains_core::permissions;
use serde::Deserialize;

use super::settings::{KEY_CONTEXT, UhiSettingsView, view};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    routes::abdm::abha::secret_key, state::AppState,
};

#[derive(Debug, Deserialize)]
struct ImportKey {
    /// Base64 PKCS#8 (or raw 32-byte) ed25519 private key, as NHA's header
    /// generation utility prints it.
    private_key: String,
}

/// The key pair to store: imported when the body names a private key,
/// otherwise generated here.
fn key_pair(body: &[u8]) -> Result<medbrains_crypto::beckn::KeyPair, AppError> {
    if body.iter().all(u8::is_ascii_whitespace) {
        return Ok(medbrains_crypto::beckn::generate());
    }
    let import: ImportKey = serde_json::from_slice(body).map_err(|_| {
        AppError::BadRequest("send { \"private_key\": \"…\" } or nothing".to_owned())
    })?;
    let private_key = import.private_key.trim().to_owned();
    let public_key = medbrains_crypto::beckn::public_key_of(&private_key).map_err(|_| {
        AppError::BadRequest("that is not an ed25519 private key (base64 PKCS#8)".to_owned())
    })?;
    Ok(medbrains_crypto::beckn::KeyPair {
        private_key,
        public_key,
    })
}

/// `POST /api/uhi/settings/keys` — a new key pair, generated here or
/// imported (`{ "private_key": "…" }`). The old one stops working the moment
/// NHA has the new public key, so the screen asks first.
///
/// # Errors
/// 400 before the settings are saved, or for a key that is not ed25519.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn generate_keys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Bytes,
) -> Result<Json<UhiSettingsView>, AppError> {
    require_permission(&claims, permissions::uhi::CONFIGURE)?;
    let pair = key_pair(&body)?;
    let key = secret_key(state.secret_resolver.as_ref()).await?;
    let sealed = medbrains_crypto::aead::encrypt_token(&key, KEY_CONTEXT, &pair.private_key)
        .map_err(|_| AppError::Internal("could not seal the UHI signing key".to_owned()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let updated = sqlx::query(
        "UPDATE uhi_subscriptions SET signing_public_key = $2, signing_private_key_sealed = $3, \
                key_generated_at = now(), updated_by = $4 \
          WHERE tenant_id = $1 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&pair.public_key)
    .bind(&sealed)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "save the UHI settings before generating the key".to_owned(),
        ));
    }
    tx.commit().await?;
    Ok(Json(view(&state, claims.tenant_id).await?))
}
