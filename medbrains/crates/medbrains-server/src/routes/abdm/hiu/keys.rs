//! The Fidelius key pair each health-information request is made with, and
//! the request itself.
//!
//! A fresh pair and nonce per request; the public half goes to the consent
//! manager in `keyMaterial`, the private half is kept **sealed in the
//! artefact's row** (AEAD under the ABDM secret key), not in memory. HIPs
//! push when they are ready — minutes or hours later, in pages, to whichever
//! server instance answers — and a key held in one process's memory would be
//! lost to a deploy or to the other instance, silently dropping records the
//! patient consented to share. The sealed key is cleared when the last page
//! arrives, when the request errors, and when the consent ends.

use chrono::{DateTime, SecondsFormat, Utc};
use medbrains_abdm::gateway::{HIU_DATA_PUSH_PATH, HIU_HI_REQUEST_PATH};
use medbrains_core::secrets::SecretResolver;
use medbrains_crypto::fidelius::{self, KeyMaterial};
use serde_json::json;
use uuid::Uuid;

use super::scope::Window;
use crate::{
    error::AppError, routes::abdm::abha::secret_key, routes::abdm::hip::gateway::Hip,
    state::AppState,
};

const KEY_CONTEXT: &[u8] = b"abdm-hiu-fidelius-key";
/// Our public URL; HIPs push to `{this}{HIU_DATA_PUSH_PATH}`.
const PUBLIC_BASE_URL: &str = "MEDBRAINS_PUBLIC_BASE_URL";
const KEY_PARAMETERS: &str = "Curve25519/32byte random key";

fn stamp(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Seal key material for storage.
///
/// # Errors
/// 500 when it cannot be sealed.
pub async fn seal(secrets: &dyn SecretResolver, km: &KeyMaterial) -> Result<String, AppError> {
    let key = secret_key(secrets).await;
    medbrains_crypto::aead::encrypt_token(
        &key,
        KEY_CONTEXT,
        &(&km.private_key, &km.public_key, &km.nonce),
    )
    .map_err(|_| AppError::Internal("could not seal the ABDM transfer key".to_owned()))
}

/// Open sealed key material.
///
/// # Errors
/// 503 when it cannot be opened (the ABDM secret key changed).
pub async fn open(secrets: &dyn SecretResolver, sealed: &str) -> Result<KeyMaterial, AppError> {
    let key = secret_key(secrets).await;
    let (private_key, public_key, nonce): (String, String, String) =
        medbrains_crypto::aead::decrypt_token(&key, KEY_CONTEXT, sealed).map_err(|_| {
            AppError::ServiceUnavailable("the ABDM transfer key cannot be opened".to_owned())
        })?;
    Ok(KeyMaterial {
        private_key,
        public_key,
        nonce,
    })
}

/// Where HIPs push for this artefact. The artefact id in the URL is how the
/// push finds its hospital and key — the push carries no gateway JWT.
async fn data_push_url(
    secrets: &dyn SecretResolver,
    artefact_id: Uuid,
) -> Result<String, AppError> {
    let base = secrets
        .get(PUBLIC_BASE_URL)
        .await
        .ok()
        .filter(|v| v.starts_with("http"))
        .ok_or_else(|| {
            AppError::ServiceUnavailable(format!(
                "{PUBLIC_BASE_URL} is not set, so other hospitals cannot send records here"
            ))
        })?;
    Ok(format!(
        "{}{HIU_DATA_PUSH_PATH}?ref={artefact_id}",
        base.trim_end_matches('/')
    ))
}

/// Ask for the records one granted artefact covers, with a fresh key pair.
///
/// # Errors
/// 503 when the public URL is unset or ABDM is unreachable; 400 when ABDM
/// refuses. The artefact records why (`hi_status`).
#[tracing::instrument(skip_all, fields(tenant_id = %hiu.tenant_id))]
pub async fn request_data(
    state: &AppState,
    hiu: &Hip,
    artefact_id: Uuid,
    consent_id: &str,
    window: &Window,
) -> Result<(), AppError> {
    let secrets = state.secret_resolver.as_ref();
    let push_url = data_push_url(secrets, artefact_id).await?;
    let ours = fidelius::generate()
        .map_err(|_| AppError::Internal("could not generate transfer keys".to_owned()))?;
    let sealed = seal(secrets, &ours).await?;
    let body = json!({ "hiRequest": {
        "consent": { "id": consent_id },
        "dateRange": { "from": stamp(window.from), "to": stamp(window.to) },
        "dataPushUrl": push_url,
        "keyMaterial": { "cryptoAlg": "ECDH", "curve": "Curve25519", "nonce": ours.nonce,
            "dhPublicKey": { "expiry": stamp(window.erase_at), "parameters": KEY_PARAMETERS,
                             "keyValue": ours.public_key } } } });
    // Stored before sending, so a push that races the acknowledgement finds it.
    set_key(
        state,
        hiu.tenant_id,
        artefact_id,
        Some(&sealed),
        "requesting",
        None,
    )
    .await?;
    match hiu.send_as_hiu(HIU_HI_REQUEST_PATH, &body).await {
        Ok(request_id) => {
            set_key(
                state,
                hiu.tenant_id,
                artefact_id,
                Some(&sealed),
                "requested",
                Some(request_id),
            )
            .await
        }
        Err(e) => {
            set_key(
                state,
                hiu.tenant_id,
                artefact_id,
                None,
                "request_failed",
                None,
            )
            .await?;
            Err(e)
        }
    }
}

async fn set_key(
    state: &AppState,
    tenant_id: Uuid,
    artefact_id: Uuid,
    sealed: Option<&str>,
    hi_status: &str,
    request_id: Option<Uuid>,
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_consent_artefacts SET key_material_sealed = $3, hi_status = $4, \
                hi_request_id = COALESCE($5, hi_request_id) \
          WHERE tenant_id = $1 AND id = $2 AND role = 'hiu'",
    )
    .bind(tenant_id)
    .bind(artefact_id)
    .bind(sealed)
    .bind(hi_status)
    .bind(request_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}
