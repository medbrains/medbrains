//! Consent for the booked operation (IPSG-4, informed consent).
//!
//! A booking is consented only by a signed surgical consent *linked to that
//! booking* — not by any signed consent the patient ever gave. The link is made
//! on the booking screen by the person who reads the consent and confirms it
//! covers this operation, and it is audited. Where anaesthesia is planned (an
//! anaesthetist is on the booking), a linked anaesthesia consent is required
//! too. Withdrawn, expired, refused, pending or deleted consents never count.
//! The one exception is emergency implied consent, certified by two doctors
//! (`emergency_consent.rs`).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::emergency_consent::{OtEmergencyConsent, emergency_certification};

/// A consent that counts: signed, not withdrawn, not expired, not deleted.
const VALID_CONSENT_SQL: &str = "pc.status = 'signed' AND pc.withdrawn_at IS NULL \
     AND pc.deleted_at IS NULL AND (pc.expires_at IS NULL OR pc.expires_at > now())";

#[derive(Debug, sqlx::FromRow)]
struct ConsentFacts {
    procedure_name: String,
    anaesthesia_required: bool,
    surgical_consent_id: Option<Uuid>,
    anaesthesia_consent_id: Option<Uuid>,
    emergency_certified: bool,
}

impl ConsentFacts {
    fn block_reason(&self) -> Option<String> {
        if self.emergency_certified {
            return None;
        }
        if self.surgical_consent_id.is_none() {
            return Some(format!(
                "No signed surgical consent is linked to this booking for \"{}\". Link the \
                 patient's signed consent for this operation on the booking's Consent panel, \
                 or capture one first.",
                self.procedure_name
            ));
        }
        if self.anaesthesia_required && self.anaesthesia_consent_id.is_none() {
            return Some(
                "Anaesthesia is planned for this booking but no signed anaesthesia consent is \
                 linked to it. Link or capture the anaesthesia consent first."
                    .to_owned(),
            );
        }
        None
    }
}

async fn consent_facts(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    booking_id: Uuid,
) -> Result<ConsentFacts, AppError> {
    let linked = |types: &str| {
        format!(
            "(SELECT pc.id FROM procedure_consents pc \
              WHERE pc.ot_booking_id = b.id AND pc.tenant_id = b.tenant_id \
                AND pc.patient_id = b.patient_id AND pc.consent_type IN ({types}) \
                AND {VALID_CONSENT_SQL} \
              ORDER BY pc.signed_at DESC NULLS LAST LIMIT 1)"
        )
    };
    let sql = format!(
        "SELECT b.procedure_name, \
                (b.anesthetist_id IS NOT NULL OR b.anesthesiologist_id IS NOT NULL) \
                    AS anaesthesia_required, \
                {} AS surgical_consent_id, \
                {} AS anaesthesia_consent_id, \
                EXISTS (SELECT 1 FROM ot_emergency_consent_certifications e \
                        WHERE e.booking_id = b.id AND e.tenant_id = b.tenant_id \
                          AND e.deleted_at IS NULL AND e.second_doctor_id IS NOT NULL) \
                    AS emergency_certified \
         FROM ot_bookings b \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL",
        linked("'surgery', 'procedure'"),
        linked("'anesthesia'"),
    );
    sqlx::query_as::<_, ConsentFacts>(&sql)
        .bind(booking_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// Why this booking is not consented, or `None` when it is.
pub(crate) async fn booking_consent_gap(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    booking_id: Uuid,
) -> Result<Option<String>, AppError> {
    Ok(consent_facts(tx, tenant_id, booking_id)
        .await?
        .block_reason())
}

pub(crate) async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    action: &str,
    booking_id: Uuid,
    values: &serde_json::Value,
) -> Result<(), AppError> {
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "ot_booking",
            entity_id: Some(booking_id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// Audit a refused consent gate. The caller commits, then returns the error.
pub(crate) async fn audit_blocked(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    booking_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    let values = serde_json::json!({ "reason": reason });
    audit(tx, claims, "ot.consent.blocked", booking_id, &values).await
}

/// One of the patient's consents as the booking screen lists it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OtConsentOption {
    pub id: Uuid,
    pub procedure_name: String,
    pub consent_type: String,
    pub signed_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    /// `true` when linked to this booking.
    pub linked: bool,
}

#[derive(Debug, Serialize)]
pub struct OtBookingConsents {
    pub anaesthesia_required: bool,
    pub surgical_consent_id: Option<Uuid>,
    pub anaesthesia_consent_id: Option<Uuid>,
    /// Why surgery may not start, `None` when consent is complete.
    pub block_reason: Option<String>,
    /// Valid surgical/anaesthesia consents of this patient that are linked to
    /// this booking or to no booking.
    pub consents: Vec<OtConsentOption>,
    /// Two-doctor emergency certification, when one has been started.
    pub emergency: Option<OtEmergencyConsent>,
}

pub(crate) async fn booking_consents(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    booking_id: Uuid,
) -> Result<OtBookingConsents, AppError> {
    let facts = consent_facts(tx, tenant_id, booking_id).await?;
    let sql = format!(
        "SELECT pc.id, pc.procedure_name::text AS procedure_name, \
                pc.consent_type::text AS consent_type, pc.signed_at, pc.expires_at, \
                (pc.ot_booking_id IS NOT NULL) AS linked \
         FROM procedure_consents pc \
         JOIN ot_bookings b ON b.id = $1 AND b.tenant_id = $2 \
         WHERE pc.tenant_id = $2 AND pc.patient_id = b.patient_id \
           AND pc.consent_type IN ('surgery', 'procedure', 'anesthesia') \
           AND (pc.ot_booking_id IS NULL OR pc.ot_booking_id = $1) \
           AND {VALID_CONSENT_SQL} \
         ORDER BY linked DESC, pc.signed_at DESC NULLS LAST \
         LIMIT 100"
    );
    let consents = sqlx::query_as::<_, OtConsentOption>(&sql)
        .bind(booking_id)
        .bind(tenant_id)
        .fetch_all(&mut **tx)
        .await?;
    Ok(OtBookingConsents {
        anaesthesia_required: facts.anaesthesia_required,
        surgical_consent_id: facts.surgical_consent_id,
        anaesthesia_consent_id: facts.anaesthesia_consent_id,
        block_reason: facts.block_reason(),
        consents,
        emergency: emergency_certification(tx, tenant_id, booking_id).await?,
    })
}

pub(crate) async fn guard_booking(
    state: &AppState,
    claims: &Claims,
    booking_id: Uuid,
) -> Result<(), AppError> {
    // The consents name the patient; reaching them is scoped by the booking.
    medbrains_authz_gate::require_access_via(
        state,
        claims,
        medbrains_authz_gate::links::OT_BOOKING,
        booking_id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "ot",
    )
    .await?;
    Ok(())
}

/// GET /`api/ot/bookings/{booking_id}/consents`
pub async fn get_booking_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<OtBookingConsents>, AppError> {
    require_permission(&claims, permissions::ot::bookings::LIST)?;
    guard_booking(&state, &claims, booking_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let out = booking_consents(&mut tx, claims.tenant_id, booking_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[cfg(test)]
mod tests {
    use super::ConsentFacts;
    use uuid::Uuid;

    fn facts(surgical: bool, anaesthesia_required: bool, anaesthesia: bool) -> ConsentFacts {
        ConsentFacts {
            procedure_name: "Left TKR".to_owned(),
            anaesthesia_required,
            surgical_consent_id: surgical.then(Uuid::nil),
            anaesthesia_consent_id: anaesthesia.then(Uuid::nil),
            emergency_certified: false,
        }
    }

    #[test]
    fn a_two_doctor_emergency_certification_stands_in_for_consent() {
        let certified = ConsentFacts {
            emergency_certified: true,
            ..facts(false, true, false)
        };
        assert!(certified.block_reason().is_none());
    }

    #[test]
    fn surgical_consent_is_always_required() {
        assert!(facts(false, false, false).block_reason().is_some());
        assert!(facts(true, false, false).block_reason().is_none());
    }

    #[test]
    fn anaesthesia_consent_only_when_anaesthesia_is_planned() {
        assert!(facts(true, true, false).block_reason().is_some());
        assert!(facts(true, true, true).block_reason().is_none());
    }
}
