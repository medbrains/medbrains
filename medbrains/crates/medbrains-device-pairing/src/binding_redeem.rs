//! `POST /api/device-binding/redeem` — an app presents a scanned binding QR.
//!
//! Unauthenticated by necessity: the app has no hospital yet, which is what
//! it is asking for. The signed token is the credential, and its nonce is
//! counted atomically so a photographed code binds no more devices than it
//! was issued for.

use axum::{Json, extract::State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;

use crate::binding::{binding_key, check_challenge, check_device};
use crate::binding_token as token;

#[derive(Debug, Deserialize)]
pub struct RedeemRequest {
    pub token: String,
    pub device_label: String,
    pub app_variant: String,
    pub public_key_pem: String,
    pub challenge: String,
}

#[derive(Debug, Serialize)]
pub struct RedeemResponse {
    pub paired_device_id: Uuid,
    pub tenant: String,
    pub tenant_name: String,
    /// The binding key's signature over the device's challenge.
    pub proof: String,
}

/// Why a code that verified still binds nothing.
fn refusal(revoked: bool, expires_at: DateTime<Utc>, used_up: bool) -> AppError {
    if revoked {
        AppError::BadRequest("this binding code was revoked".into())
    } else if expires_at <= Utc::now() {
        AppError::BadRequest("this binding code has expired".into())
    } else if used_up {
        AppError::Conflict("this binding code has already been used".into())
    } else {
        AppError::BadRequest("this binding code is not valid".into())
    }
}

pub async fn redeem_binding_code(
    State(state): State<AppState>,
    Json(body): Json<RedeemRequest>,
) -> Result<Json<RedeemResponse>, AppError> {
    let key = binding_key(&state).await?;
    let claims = token::verify(&key.verifying_key(), &body.token)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    check_challenge(&body.challenge)?;
    let label = check_device(&body.device_label, &body.public_key_pem)?;
    if !crate::is_valid_app_variant(&body.app_variant) {
        return Err(AppError::BadRequest("invalid app_variant".into()));
    }

    let tenant: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, code, name FROM tenants WHERE upper(code) = upper($1) AND is_active",
    )
    .bind(&claims.tenant)
    .fetch_optional(&state.db)
    .await?;
    let Some((tenant_id, tenant_code, tenant_name)) = tenant else {
        return Err(AppError::NotFound);
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // One statement decides the use: two devices scanning a single-use code
    // at once cannot both get it.
    let code_id: Option<Uuid> = sqlx::query_scalar(
        "UPDATE device_binding_codes SET use_count = use_count + 1 \
          WHERE jti = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND revoked_at IS NULL AND expires_at > now() AND use_count < max_uses \
          RETURNING id",
    )
    .bind(&claims.jti)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(code_id) = code_id else {
        let row: Option<(bool, DateTime<Utc>, bool)> = sqlx::query_as(
            "SELECT revoked_at IS NOT NULL, expires_at, use_count >= max_uses \
               FROM device_binding_codes \
              WHERE jti = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        )
        .bind(&claims.jti)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
        return Err(row.map_or_else(
            || AppError::BadRequest("this binding code is not valid".into()),
            |(revoked, expires_at, used_up)| refusal(revoked, expires_at, used_up),
        ));
    };

    let pem = body.public_key_pem.trim();
    let paired_device_id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO paired_devices (tenant_id, label, app_variant, cert_fingerprint, cert_pem) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (cert_fingerprint) DO NOTHING RETURNING id",
    )
    .bind(tenant_id)
    .bind(&label)
    .bind(&body.app_variant)
    .bind(crate::sha256_hex(pem.as_bytes()))
    .bind(pem)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(paired_device_id) = paired_device_id else {
        return Err(AppError::Conflict(
            "this device key is already paired".into(),
        ));
    };

    sqlx::query(
        "INSERT INTO device_binding_redemptions \
            (tenant_id, code_id, paired_device_id, app_variant) VALUES ($1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(code_id)
    .bind(paired_device_id)
    .bind(&body.app_variant)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(RedeemResponse {
        paired_device_id,
        tenant: tenant_code,
        tenant_name,
        proof: token::proof(&key, &claims.jti, &body.challenge),
    }))
}
