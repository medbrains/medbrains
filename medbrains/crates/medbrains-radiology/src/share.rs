//! Sharing a study by link — with a referring doctor, for a second opinion,
//! or with the patient.
//!
//! A link opens exactly one study in the viewer, through `MedBrains`, for
//! one named recipient: the patient (a code to their phone on record) or a
//! clinician (a code to the phone or email given here). Without the code the
//! link opens nothing ([`crate::share_public`]). It lasts a day unless set
//! otherwise, a week at most, can be revoked, and a clinician's link can be
//! de-identified for a second opinion. Making, revoking, verifying and every
//! open are audited.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::share_public::landing_path;

const DEFAULT_HOURS: i64 = 24;
const MAX_HOURS: i64 = 7 * 24;
/// Fewest digits in a phone number a code can be sent to.
const MIN_PHONE_DIGITS: usize = 10;

pub(crate) async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    user: Option<Uuid>,
    action: &str,
    link_id: Uuid,
    values: &Value,
) -> Result<(), AppError> {
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id,
            user_id: user,
            action,
            entity_type: "radiology_share_link",
            entity_id: Some(link_id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

async fn open_tx<'a>(
    state: &'a AppState,
    claims: &Claims,
) -> Result<Transaction<'a, Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

#[derive(Debug, Deserialize)]
pub struct CreateShareLink {
    pub study_id: Uuid,
    /// `clinician` (default) or `patient`.
    pub recipient_kind: Option<String>,
    pub recipient_name: Option<String>,
    /// A clinician's phone or email, where the code is sent. Unused for the
    /// patient, whose phone on record is used.
    pub recipient_phone: Option<String>,
    pub recipient_email: Option<String>,
    /// Replace identifying `DICOM` attributes. Clinician links only.
    pub deidentify: Option<bool>,
    /// 1 to 168; 24 when absent.
    pub expires_hours: Option<i64>,
}

/// Who a link is for, once its fields are checked.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Recipient {
    Patient,
    Clinician {
        phone: Option<String>,
        email: Option<String>,
        deidentify: bool,
    },
}

fn trimmed(v: Option<&String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// Check who the link is for and where its code can go.
pub(crate) fn recipient(body: &CreateShareLink) -> Result<Recipient, AppError> {
    let deidentify = body.deidentify.unwrap_or(false);
    match body.recipient_kind.as_deref().unwrap_or("clinician") {
        "patient" if deidentify => Err(AppError::BadRequest(
            "A patient's own images are not de-identified".to_owned(),
        )),
        "patient" => Ok(Recipient::Patient),
        "clinician" => {
            let phone = trimmed(body.recipient_phone.as_ref());
            let email = trimmed(body.recipient_email.as_ref());
            if phone
                .as_deref()
                .is_some_and(|p| p.chars().filter(char::is_ascii_digit).count() < MIN_PHONE_DIGITS)
            {
                return Err(AppError::BadRequest(
                    "That phone number is too short".to_owned(),
                ));
            }
            if email
                .as_deref()
                .is_some_and(|e| !e.contains('@') || e.starts_with('@'))
            {
                return Err(AppError::BadRequest(
                    "That email address is not valid".to_owned(),
                ));
            }
            if phone.is_none() && email.is_none() {
                return Err(AppError::BadRequest(
                    "Give the recipient's phone or email: the viewer opens only with a code sent there"
                        .to_owned(),
                ));
            }
            Ok(Recipient::Clinician {
                phone,
                email,
                deidentify,
            })
        }
        _ => Err(AppError::BadRequest(
            "A link is for a clinician or the patient".to_owned(),
        )),
    }
}

/// `POST /api/radiology/share-links` — make a link to one study.
pub async fn create_share_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateShareLink>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::radiology::studies::SHARE)?;
    // A link to a patient's images: only for a patient the caller may see.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_DICOM_STUDY,
        body.study_id,
    )
    .await?;
    let hours = body.expires_hours.unwrap_or(DEFAULT_HOURS);
    if !(1..=MAX_HOURS).contains(&hours) {
        return Err(AppError::BadRequest(format!(
            "A link lasts between 1 hour and {MAX_HOURS} hours (a week)"
        )));
    }
    let who = recipient(&body)?;
    let mut tx = open_tx(&state, &claims).await?;
    let (patient_phone, patient_name): (Option<String>, String) = sqlx::query_as(
        "SELECT p.phone, p.first_name || ' ' || p.last_name FROM radiology_dicom_studies s \
           JOIN patients p ON p.id = s.patient_id AND p.tenant_id = s.tenant_id \
          WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL",
    )
    .bind(body.study_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let (kind, name, phone, email, deidentify) = match who {
        Recipient::Patient => {
            let phone = patient_phone
                .filter(|p| p.chars().filter(char::is_ascii_digit).count() >= MIN_PHONE_DIGITS)
                .ok_or_else(|| {
                    AppError::BadRequest(
                        "The patient has no mobile number on record to send the code to".to_owned(),
                    )
                })?;
            ("patient", patient_name, Some(phone), None, false)
        }
        Recipient::Clinician {
            phone,
            email,
            deidentify,
        } => {
            let name = trimmed(body.recipient_name.as_ref())
                .ok_or_else(|| AppError::BadRequest("Say who the link is for".to_owned()))?;
            ("clinician", name, phone, email, deidentify)
        }
    };
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let expires = Utc::now() + chrono::Duration::hours(hours);
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_share_links \
           (tenant_id, study_id, token, recipient_kind, recipient_name, recipient_phone, \
            recipient_email, deidentify, expires_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.study_id)
    .bind(&token)
    .bind(kind)
    .bind(&name)
    .bind(&phone)
    .bind(&email)
    .bind(deidentify)
    .bind(expires)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let values = json!({
        "study_id": body.study_id, "recipient_kind": kind, "recipient": name,
        "deidentify": deidentify, "expires_at": expires,
    });
    audit(
        &mut tx,
        claims.tenant_id,
        Some(claims.sub),
        "radiology.share_link.create",
        id,
        &values,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "id": id, "share_url": landing_path(&token), "expires_at": expires }),
    ))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ShareLinkRow {
    pub id: Uuid,
    pub recipient_kind: String,
    pub recipient_name: Option<String>,
    pub recipient_email: Option<String>,
    pub deidentify: bool,
    pub expires_at: DateTime<Utc>,
    pub accessed_count: i32,
    pub last_accessed: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// `GET /api/radiology/dicom-studies/{id}/share-links` — who a study was
/// shared with, and whether they opened it. Tokens are never listed.
pub async fn list_share_links(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(study_id): Path<Uuid>,
) -> Result<Json<Vec<ShareLinkRow>>, AppError> {
    require_permission(&claims, permissions::radiology::studies::SHARE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_DICOM_STUDY,
        study_id,
    )
    .await?;
    let mut tx = open_tx(&state, &claims).await?;
    // allow-soft-deleted: a revoked link is shown as revoked, not hidden.
    let rows = sqlx::query_as::<_, ShareLinkRow>(
        "SELECT id, recipient_kind, recipient_name, recipient_email, deidentify, expires_at, \
                accessed_count, last_accessed, \
                created_at, deleted_at AS revoked_at \
           FROM radiology_share_links WHERE study_id = $1 AND tenant_id = $2 \
          ORDER BY created_at DESC LIMIT 100",
    )
    .bind(study_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/radiology/share-links/{id}/revoke` — stop a link working.
pub async fn revoke_share_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::radiology::studies::SHARE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_SHARE_LINK,
        id,
    )
    .await?;
    let mut tx = open_tx(&state, &claims).await?;
    let token: String = sqlx::query_scalar(
        "UPDATE radiology_share_links SET deleted_at = now(), deleted_by = $3, \
                delete_reason = 'revoked' \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING token",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // ponytail: evicts on this server only; another instance stops the link
    // within TOKEN_TTL.
    crate::share_public::forget_token(&token);
    audit(
        &mut tx,
        claims.tenant_id,
        Some(claims.sub),
        "radiology.share_link.revoke",
        id,
        &json!({}),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "revoked": true })))
}

#[cfg(test)]
mod tests {
    use super::{CreateShareLink, Recipient, recipient};
    use uuid::Uuid;

    fn link(
        kind: &str,
        phone: Option<&str>,
        email: Option<&str>,
        deidentify: bool,
    ) -> CreateShareLink {
        CreateShareLink {
            study_id: Uuid::nil(),
            recipient_kind: Some(kind.to_owned()),
            recipient_name: Some("Dr Rao".to_owned()),
            recipient_phone: phone.map(str::to_owned),
            recipient_email: email.map(str::to_owned),
            deidentify: Some(deidentify),
            expires_hours: None,
        }
    }

    #[test]
    fn a_clinician_link_needs_somewhere_to_send_the_code() {
        assert!(recipient(&link("clinician", None, None, false)).is_err());
        assert!(recipient(&link("clinician", Some("12"), None, false)).is_err());
        assert!(recipient(&link("clinician", None, Some("not-an-email"), false)).is_err());
        assert!(matches!(
            recipient(&link("clinician", Some("+91 98450 12210"), None, true)),
            Ok(Recipient::Clinician { .. })
        ));
    }

    #[test]
    fn the_patients_own_share_is_never_de_identified() {
        assert!(recipient(&link("patient", None, None, true)).is_err());
        assert!(matches!(
            recipient(&link("patient", None, None, false)),
            Ok(Recipient::Patient)
        ));
    }
}
