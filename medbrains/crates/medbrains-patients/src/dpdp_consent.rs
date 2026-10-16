//! What a patient agreed to under the DPDP Act 2023 (s.5–6, Rules 2025 r.3).
//!
//! Care itself is a legitimate use (s.7) and needs no consent; the notice
//! still says so. What does need the patient's own yes, purpose by purpose:
//! linking records to ABDM, sharing with an insurer or TPA, health reminders,
//! and de-identified research. The desk shows the notice in a language the
//! patient reads and records which purposes they agreed to.
//!
//! `dpdp_consents` is append-only: each row is one decision, the newest is
//! the current answer, and a withdrawal is a new row — withdrawing is as easy
//! as agreeing (s.6(4)), and both stay on record.

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
use uuid::Uuid;

/// The notice the desk shows. Bump when its wording changes, so every
/// consent says which text the patient read.
pub const NOTICE_VERSION: &str = "2026-10";
/// The purposes the notice names — the only ones that can be agreed to.
pub const PURPOSES: [&str; 4] = [
    "abdm_linking",
    "insurance_claims",
    "health_reminders",
    "research",
];
/// Languages the notice exists in.
pub const NOTICE_LANGUAGES: [&str; 3] = ["en", "hi", "ta"];

/// The privacy block of a registration: the notice was shown, in which
/// language, and what the patient agreed to.
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct DpdpConsentInput {
    pub notice_version: String,
    pub notice_language: String,
    #[serde(default)]
    pub purposes: Vec<String>,
    /// Who decided, when it was not the patient: a parent or guardian (s.9).
    pub guardian_name: Option<String>,
}

impl DpdpConsentInput {
    /// Refuse a consent to a notice the patient was not shown.
    pub fn validate(&self) -> Result<(), AppError> {
        if self.notice_version != NOTICE_VERSION {
            return Err(AppError::BadRequest(
                "The privacy notice has changed — reload and show the patient the current one"
                    .to_owned(),
            ));
        }
        if !NOTICE_LANGUAGES.contains(&self.notice_language.as_str()) {
            return Err(AppError::BadRequest(
                "The notice was not shown in a language we have".into(),
            ));
        }
        if let Some(p) = self
            .purposes
            .iter()
            .find(|p| !PURPOSES.contains(&p.as_str()))
        {
            return Err(AppError::BadRequest(format!(
                "{p} is not a purpose the notice names"
            )));
        }
        Ok(())
    }
}

/// One decision on the ledger, recorded by a member of staff.
pub async fn insert(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, patient_id, recorded_by): (Uuid, Uuid, Uuid),
    input: &DpdpConsentInput,
    source: &str,
) -> Result<(), AppError> {
    write(
        tx,
        (tenant_id, patient_id, Some(recorded_by)),
        input,
        (source, "Shown at the desk"),
    )
    .await
}

/// One decision on the ledger, made by the patient online.
pub async fn insert_by_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, patient_id): (Uuid, Uuid),
    input: &DpdpConsentInput,
) -> Result<(), AppError> {
    write(
        tx,
        (tenant_id, patient_id, None),
        input,
        ("portal", "By the patient, online"),
    )
    .await
}

async fn write(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, patient_id, recorded_by): (Uuid, Uuid, Option<Uuid>),
    input: &DpdpConsentInput,
    (source, method): (&str, &str),
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO dpdp_consents \
           (tenant_id, patient_id, purposes, consent_given, notice_version, notice_language, \
            guardian_name, consent_method, source, recorded_by) \
         VALUES ($1, $2, $3, cardinality($3) > 0, $4, $5, $6, $9, $7, $8)",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(&input.purposes)
    .bind(&input.notice_version)
    .bind(&input.notice_language)
    .bind(
        input
            .guardian_name
            .as_deref()
            .map(str::trim)
            .filter(|g| !g.is_empty()),
    )
    .bind(source)
    .bind(recorded_by)
    .bind(method)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Record the notice and the patient's answer at registration. An absent
/// block means the notice was not given (an unconscious emergency patient,
/// say); the desk can record it later from the patient's page.
pub async fn record_at_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    who: (Uuid, Uuid, Uuid),
    input: Option<&DpdpConsentInput>,
) -> Result<(), AppError> {
    match input {
        Some(input) => insert(tx, who, input, "registration").await,
        None => Ok(()),
    }
}

/// One decision on the ledger.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DpdpConsentRecord {
    pub purposes: Vec<String>,
    pub notice_version: Option<String>,
    pub notice_language: Option<String>,
    pub guardian_name: Option<String>,
    pub source: String,
    pub recorded_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PatientDpdpConsent {
    pub notice_version: &'static str,
    /// The purposes a patient can agree to, in the notice's order.
    pub purposes: [&'static str; 4],
    /// Newest first; empty when the notice was never given.
    pub history: Vec<DpdpConsentRecord>,
}

/// The patient's current answer and its history.
pub async fn read(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientDpdpConsent, AppError> {
    let history = sqlx::query_as::<_, DpdpConsentRecord>(
        "SELECT c.purposes, c.notice_version, c.notice_language, c.guardian_name, c.source, \
                u.full_name AS recorded_by_name, c.created_at \
           FROM dpdp_consents c LEFT JOIN users u ON u.id = c.recorded_by \
          WHERE c.patient_id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL \
          ORDER BY c.created_at DESC LIMIT 50",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(PatientDpdpConsent {
        notice_version: NOTICE_VERSION,
        purposes: PURPOSES,
        history,
    })
}

/// `GET /api/patients/{id}/dpdp-consent`
pub async fn get_dpdp_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<PatientDpdpConsent>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let consent = read(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    Ok(Json(consent))
}

/// `PUT /api/patients/{id}/dpdp-consent` — the notice given after
/// registration, or the patient changing their mind. A new row, never an
/// edit.
pub async fn set_dpdp_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<DpdpConsentInput>,
) -> Result<Json<PatientDpdpConsent>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    insert(
        &mut tx,
        (claims.tenant_id, patient_id, claims.sub),
        &body,
        "patient_update",
    )
    .await?;
    let consent = read(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    Ok(Json(consent))
}

#[cfg(test)]
mod tests {
    use super::{DpdpConsentInput, NOTICE_VERSION};

    fn input(version: &str, lang: &str, purposes: &[&str]) -> DpdpConsentInput {
        DpdpConsentInput {
            notice_version: version.to_owned(),
            notice_language: lang.to_owned(),
            purposes: purposes.iter().map(|p| (*p).to_owned()).collect(),
            guardian_name: None,
        }
    }

    #[test]
    fn consent_to_an_old_notice_is_refused() {
        assert!(input("2020-01", "en", &[]).validate().is_err());
        assert!(
            input(NOTICE_VERSION, "en", &["research"])
                .validate()
                .is_ok()
        );
    }

    #[test]
    fn only_named_purposes_and_languages() {
        assert!(
            input(NOTICE_VERSION, "en", &["marketing"])
                .validate()
                .is_err()
        );
        assert!(input(NOTICE_VERSION, "fr", &[]).validate().is_err());
    }
}
