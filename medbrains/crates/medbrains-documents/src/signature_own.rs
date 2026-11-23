//! A signer sets up their own signature.
//!
//! `POST /api/signatures/my-credentials` makes the caller's signing key and
//! stores the image printed with their signature. The signer is always the
//! session's user: nobody sets a signature for somebody else, so the request
//! carries no user id and a body that names one is refused. It needs the same
//! fresh password step-up as signing. The image is checked here, by its
//! bytes, whatever the browser claimed.

use axum::extract::rejection::JsonRejection;
use axum::{Extension, Json, extract::State};
use base64::{Engine, engine::general_purpose::STANDARD};
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState, step_up};
use medbrains_signing::signing;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::signatures::{
    SignatureCredentialPublic, signature_key_context, signature_key_encryption_key,
};

/// The largest signature image, in bytes: the limit the upload form states.
const MAX_IMAGE_BYTES: usize = 750_000;
const NOT_AN_IMAGE: &str = "Use a PNG, JPEG or WebP image for your signature.";
const TOO_LARGE: &str = "The signature image is too large. Keep it under 750 KB.";

/// The signer's own choice. No user id: the signer is the session's user.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetMyCredentialRequest {
    /// A PNG, JPEG or WebP data URL; `null` to sign with no image.
    pub image: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SetMyCredentialResponse {
    pub credential: SignatureCredentialPublic,
    /// True when an earlier signature was ended by this one.
    pub replaced: bool,
}

/// Make the caller's Ed25519 key pair, seal the private key under the server
/// key and store it as their default credential, created by themselves. The
/// one place a signing credential is made, and it makes one for nobody else.
///
/// # Errors
/// `Internal` when the key cannot be made or sealed; a database error.
async fn create_credential(
    state: &AppState,
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    image: Option<&str>,
) -> Result<SignatureCredentialPublic, AppError> {
    let (private_key, public_key) =
        signing::generate_keypair().map_err(|e| AppError::Internal(format!("keygen: {e}")))?;
    let sealing_key = signature_key_encryption_key(state).await?;
    let context = signature_key_context(&claims.tenant_id, &claims.sub);
    let sealed =
        medbrains_crypto::aead::encrypt_bytes(&sealing_key, context.as_bytes(), &private_key)
            .map_err(|_| AppError::Internal("signature key encryption failed".to_owned()))?;
    let row = sqlx::query_as!(
        SignatureCredentialPublic,
        "INSERT INTO doctor_signature_credentials ( \
            tenant_id, doctor_user_id, credential_type, algorithm, \
            public_key, encrypted_private_key, display_image_url, is_default, created_by \
         ) VALUES ($1,$2,'stored_key','Ed25519',$3,$4,$5,TRUE,$2) \
         RETURNING id, tenant_id, doctor_user_id, credential_type, algorithm, \
                   public_key, display_image_url, display_font, \
                   valid_from, valid_until, revoked_at, revoked_reason, \
                   is_default, created_at",
        claims.tenant_id,
        claims.sub,
        public_key.as_slice(),
        sealed.as_slice(),
        image,
    )
    .fetch_one(&mut *tx)
    .await?;
    Ok(row)
}

/// The image type its first bytes say it is, whatever its name or label said.
fn image_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP".as_slice()) {
        Some("image/webp")
    } else {
        None
    }
}

/// The data URL to store for an uploaded signature image: decoded, within
/// [`MAX_IMAGE_BYTES`], and labelled with the type its bytes prove.
///
/// # Errors
/// `BadRequest`, in plain words, for anything that is not such an image.
pub(crate) fn checked_image(data_url: &str) -> Result<String, AppError> {
    let refuse = |why: &str| AppError::BadRequest(why.to_owned());
    let (_, encoded) = data_url
        .strip_prefix("data:image/")
        .and_then(|rest| rest.split_once(";base64,"))
        .ok_or_else(|| refuse(NOT_AN_IMAGE))?;
    // Four characters carry three bytes: refuse an oversized one undecoded.
    if encoded.len() > MAX_IMAGE_BYTES.div_ceil(3) * 4 {
        return Err(refuse(TOO_LARGE));
    }
    let bytes = STANDARD.decode(encoded).map_err(|_| refuse(NOT_AN_IMAGE))?;
    let mime = image_type(&bytes).ok_or_else(|| refuse(NOT_AN_IMAGE))?;
    Ok(format!("data:{mime};base64,{encoded}"))
}

/// `POST /api/signatures/my-credentials`: the caller sets or replaces their
/// own signature.
///
/// Every earlier signature of theirs is ended, not revoked: none is the
/// default any more and each one's `valid_until` is now, and the rows stay, because records signed with it
/// still verify against its key and keep the image they were signed with.
/// One audit row says who set or replaced it, and when.
///
/// # Errors
/// 403 without `signatures.own.manage`; 403 `step_up_required` without a
/// fresh step-up; 400 for a body naming anything but `image`, or an image
/// that is not a PNG, JPEG or WebP within the size limit.
pub async fn set_my_credential(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    proof: step_up::StepUpProof,
    body: Result<Json<SetMyCredentialRequest>, JsonRejection>,
) -> Result<Json<SetMyCredentialResponse>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::signatures::own::MANAGE)?;
    step_up::require_step_up(&state, &proof, &claims)?;
    let Json(body) = body?;
    let image = body.image.as_deref().map(checked_image).transpose()?;

    let mut tx = kernel::scoped_tx(&state.db, &permit, &claims.department_ids).await?;
    let previous = sqlx::query_scalar!(
        // Every credential of theirs that could still sign, not only the
        // default: one an administrator issued beside it must not outlive this.
        // One that already ended keeps the date it ended on.
        "UPDATE doctor_signature_credentials \
            SET is_default = FALSE, valid_until = LEAST(COALESCE(valid_until, now()), now()) \
          WHERE tenant_id = $1 AND doctor_user_id = $2 AND revoked_at IS NULL \
            AND (is_default OR valid_until IS NULL OR valid_until > now()) \
         RETURNING id",
        claims.tenant_id,
        claims.sub,
    )
    .fetch_all(&mut *tx)
    .await?;
    let credential = create_credential(&state, &mut tx, &claims, image.as_deref()).await?;
    let ended = (!previous.is_empty()).then(|| json!({ "credential_ids": previous }));
    let action = if ended.is_some() {
        "signature_replaced"
    } else {
        "signature_set"
    };
    let entry = kernel::audit::AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action,
        entity_type: "doctor_signature_credential",
        entity_id: Some(credential.id),
        old_values: ended.as_ref(),
        new_values: Some(&json!({ "has_image": image.is_some() })),
        ip_address: None,
    };
    kernel::audit::append(&mut tx, &entry).await?;
    tx.commit().await?;
    Ok(Json(SetMyCredentialResponse {
        credential,
        replaced: !previous.is_empty(),
    }))
}

#[cfg(test)]
mod tests {
    use super::{MAX_IMAGE_BYTES, STANDARD, checked_image};
    use base64::Engine;

    /// A data URL labelled `label` whose bytes are `bytes`.
    fn url(label: &str, bytes: &[u8]) -> String {
        format!("data:image/{label};base64,{}", STANDARD.encode(bytes))
    }

    #[test]
    fn an_image_is_stored_under_the_type_its_bytes_prove() {
        let png = b"\x89PNG\r\n\x1a\nrest";
        assert!(checked_image(&url("png", png)).is_ok_and(|u| u.starts_with("data:image/png;")));
        // Labelled SVG, but a JPEG: stored as the JPEG it is.
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2];
        assert!(
            checked_image(&url("svg+xml", &jpeg)).is_ok_and(|u| u.starts_with("data:image/jpeg;"))
        );
        assert!(checked_image(&url("webp", b"RIFF\0\0\0\0WEBPVP8 ")).is_ok());
    }

    #[test]
    fn anything_else_is_refused_in_plain_words() {
        for bad in [
            url("png", b"<svg onload=alert(1)>"),
            url("png", b"%PDF-1.7"),
            "data:image/png;base64,***".to_owned(),
            "https://example.test/signature.png".to_owned(),
            String::new(),
        ] {
            assert!(checked_image(&bad).is_err(), "{bad}");
        }
        let mut huge = b"\x89PNG\r\n\x1a\n".to_vec();
        huge.resize(MAX_IMAGE_BYTES + 3, 0);
        assert!(checked_image(&url("png", &huge)).is_err());
    }
}
