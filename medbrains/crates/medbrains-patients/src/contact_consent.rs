//! How a patient may be contacted, as they said at the desk.
//!
//! An SMS carrying the UHID is a service message and needs no opt-in. `WhatsApp`
//! and email do — `WhatsApp`'s business policy and the DPDP Act 2023 both require
//! the patient's own yes and a record of who took it — so registration asks,
//! and the answer is kept in `patient_contact_consents` (append-only).

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

/// The contact block of a registration.
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct ContactPreferences {
    /// `sms` | `whatsapp` | `email` | `call`.
    pub preferred_method: Option<String>,
    #[serde(default)]
    pub whatsapp_opt_in: bool,
    #[serde(default)]
    pub email_opt_in: bool,
}

const METHODS: [&str; 4] = ["sms", "whatsapp", "email", "call"];

impl ContactPreferences {
    /// Refuse what cannot be honoured, before anything is written.
    pub fn validate(&self, has_email: bool) -> Result<(), AppError> {
        if let Some(method) = self.preferred_method.as_deref() {
            if !METHODS.contains(&method) {
                return Err(AppError::BadRequest(format!(
                    "preferred contact method must be one of {}",
                    METHODS.join(", ")
                )));
            }
        }
        if self.email_opt_in && !has_email {
            return Err(AppError::BadRequest(
                "Email updates were agreed to, but no email address was given".to_owned(),
            ));
        }
        let wants = |channel| self.preferred_method.as_deref() == Some(channel);
        if (wants("whatsapp") && !self.whatsapp_opt_in) || (wants("email") && !self.email_opt_in) {
            return Err(AppError::BadRequest(
                "The preferred contact method needs the patient's agreement to that channel"
                    .to_owned(),
            ));
        }
        Ok(())
    }
}

/// Record the patient's answers at registration. Only a yes is written: an
/// absent row already means "not agreed", and a registration that recorded
/// "no" for every patient would bury the rows that matter.
pub async fn record_at_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, patient_id, recorded_by): (Uuid, Uuid, Uuid),
    prefs: &ContactPreferences,
) -> Result<(), AppError> {
    for (channel, granted) in [("whatsapp", prefs.whatsapp_opt_in), ("email", prefs.email_opt_in)] {
        if !granted {
            continue;
        }
        sqlx::query!(
            "INSERT INTO patient_contact_consents \
               (tenant_id, patient_id, channel, granted, source, recorded_by) \
             VALUES ($1, $2, $3, true, 'registration', $4)",
            tenant_id,
            patient_id,
            channel,
            recorded_by,
        )
        .execute(&mut **tx)
        .await?;
    }
    if let Some(method) = prefs.preferred_method.as_deref() {
        sqlx::query!(
            "UPDATE patients SET preferred_contact_method = $1 WHERE id = $2 AND tenant_id = $3",
            method,
            patient_id,
            tenant_id,
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// One channel's current answer, and who recorded it.
#[derive(Debug, Serialize)]
pub struct ChannelConsent {
    pub channel: String,
    pub granted: bool,
    pub source: String,
    pub recorded_by_name: Option<String>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PatientContactConsents {
    pub preferred_method: Option<String>,
    /// Newest answer per channel; a channel never asked about is absent.
    pub channels: Vec<ChannelConsent>,
}

/// `GET /api/patients/{id}/contact-consents`
pub async fn get_contact_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<PatientContactConsents>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let consents = read_consents(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    Ok(Json(consents))
}

#[derive(Debug, Deserialize)]
pub struct SetContactConsent {
    pub channel: String,
    pub granted: bool,
}

/// `PUT /api/patients/{id}/contact-consents` — the patient changed their mind.
/// A new row, never an edit: withdrawing is as easy as agreeing, and the
/// history of both stays.
pub async fn set_contact_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<SetContactConsent>,
) -> Result<Json<PatientContactConsents>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    if !["whatsapp", "email"].contains(&body.channel.as_str()) {
        return Err(AppError::BadRequest("channel must be whatsapp or email".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let email = sqlx::query_scalar!(
        "SELECT email FROM patients WHERE id = $1 AND tenant_id = $2",
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if body.channel == "email" && body.granted && email.is_none_or(|e| e.trim().is_empty()) {
        return Err(AppError::BadRequest(
            "Add an email address before agreeing to email updates".to_owned(),
        ));
    }
    sqlx::query!(
        "INSERT INTO patient_contact_consents \
           (tenant_id, patient_id, channel, granted, source, recorded_by) \
         VALUES ($1, $2, $3, $4, 'patient_update', $5)",
        claims.tenant_id,
        patient_id,
        body.channel,
        body.granted,
        claims.sub,
    )
    .execute(&mut *tx)
    .await?;
    let consents = read_consents(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    Ok(Json(consents))
}

async fn read_consents(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientContactConsents, AppError> {
    let preferred_method = sqlx::query_scalar!(
        "SELECT preferred_contact_method FROM patients WHERE id = $1 AND tenant_id = $2",
        patient_id,
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let channels = sqlx::query_as!(
        ChannelConsent,
        r#"SELECT DISTINCT ON (c.channel)
                  c.channel, c.granted, c.source, u.full_name AS "recorded_by_name?",
                  c.recorded_at
             FROM patient_contact_consents c
             LEFT JOIN users u ON u.id = c.recorded_by
            WHERE c.patient_id = $1 AND c.tenant_id = $2
            ORDER BY c.channel, c.recorded_at DESC"#,
        patient_id,
        tenant_id,
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(PatientContactConsents { preferred_method, channels })
}

#[cfg(test)]
mod tests {
    use super::ContactPreferences;

    fn prefs(method: Option<&str>, whatsapp: bool, email: bool) -> ContactPreferences {
        ContactPreferences {
            preferred_method: method.map(str::to_owned),
            whatsapp_opt_in: whatsapp,
            email_opt_in: email,
        }
    }

    #[test]
    fn email_updates_need_an_email_address() {
        assert!(prefs(None, false, true).validate(false).is_err());
        assert!(prefs(None, false, true).validate(true).is_ok());
    }

    #[test]
    fn preferring_a_channel_needs_agreeing_to_it() {
        assert!(prefs(Some("whatsapp"), false, false).validate(true).is_err());
        assert!(prefs(Some("whatsapp"), true, false).validate(true).is_ok());
        assert!(prefs(Some("sms"), false, false).validate(false).is_ok());
    }

    #[test]
    fn an_unknown_method_is_refused() {
        assert!(prefs(Some("pigeon"), false, false).validate(false).is_err());
    }
}
