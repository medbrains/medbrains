//! Opaque event tokens for QR/barcode surfaces.
//!
//! A printed/scanned code should never expose patient data or raw database
//! identifiers. These tokens are AES-GCM encrypted and authenticated; scanners
//! that are not MedBrains only see an opaque `MBE1...` value.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

const EVENT_TOKEN_CONTEXT: &[u8] = b"medbrains:event-token:v1";
const EVENT_TOKEN_KEY_SECRET: &str = "MEDBRAINS_EVENT_TOKEN_KEY";
const DEV_EVENT_TOKEN_KEY: &[u8] = b"medbrains-dev-event-token-key-rotate-before-production";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTokenPayload {
    pub version: u8,
    pub tenant_id: Uuid,
    pub event: String,
    pub subject_type: String,
    pub subject_id: Uuid,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub nonce: Uuid,
}

pub async fn issue_event_token(
    state: &AppState,
    tenant_id: Uuid,
    event: &str,
    subject_type: &str,
    subject_id: Uuid,
    expires_at: DateTime<Utc>,
) -> Result<String, AppError> {
    let key = event_token_key(state).await?;
    medbrains_crypto::aead::encrypt_token(
        &key,
        EVENT_TOKEN_CONTEXT,
        &EventTokenPayload {
            version: 1,
            tenant_id,
            event: event.to_owned(),
            subject_type: subject_type.to_owned(),
            subject_id,
            issued_at: Utc::now(),
            expires_at,
            nonce: Uuid::new_v4(),
        },
    )
    .map_err(|_| AppError::Internal("event token encryption failed".to_owned()))
}

pub async fn open_event_token(
    state: &AppState,
    token: &str,
    expected_event: &str,
) -> Result<EventTokenPayload, AppError> {
    let key = event_token_key(state).await?;
    let payload: EventTokenPayload =
        medbrains_crypto::aead::decrypt_token(&key, EVENT_TOKEN_CONTEXT, token)
            .map_err(|_| AppError::BadRequest("Invalid QR/barcode token".to_owned()))?;

    if payload.version != 1 || payload.event != expected_event {
        return Err(AppError::BadRequest("Invalid QR/barcode token".to_owned()));
    }
    if payload.expires_at < Utc::now() {
        return Err(AppError::BadRequest("QR/barcode token expired".to_owned()));
    }

    Ok(payload)
}

async fn event_token_key(state: &AppState) -> Result<Vec<u8>, AppError> {
    match state.secret_resolver.get(EVENT_TOKEN_KEY_SECRET).await {
        Ok(value) if value.len() >= 32 => Ok(value.into_bytes()),
        Ok(_) => Err(AppError::Internal(format!(
            "{EVENT_TOKEN_KEY_SECRET} must be at least 32 bytes"
        ))),
        Err(_) => {
            tracing::warn!(
                "{EVENT_TOKEN_KEY_SECRET} missing; using dev-only event token key. \
                 Set this before production so QR/barcode tokens are not decryptable across installs."
            );
            Ok(DEV_EVENT_TOKEN_KEY.to_vec())
        }
    }
}
