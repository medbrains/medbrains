//! Emergency implied consent for surgery.
//!
//! When an emergency operation cannot wait — the patient cannot consent and no
//! relative can be reached in time — Indian practice (and NABH) accepts implied
//! consent if two doctors certify the emergency in writing. Here each doctor
//! certifies in their own authenticated session, after re-entering their
//! password (step-up), so neither can be recorded by the other typing an id.
//! Only emergency bookings qualify, never over a recorded refusal, and every
//! certification is audited and printed on the operation notes.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::consent::{OtBookingConsents, audit, booking_consents, guard_booking};

/// The certification as the booking screen shows it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OtEmergencyConsent {
    pub reason: String,
    pub first_doctor_name: Option<String>,
    pub first_certified_at: DateTime<Utc>,
    pub second_doctor_name: Option<String>,
    pub second_certified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CertifyEmergencyConsentRequest {
    /// Required from the first doctor; ignored for the second.
    pub reason: Option<String>,
}

pub(crate) async fn emergency_certification(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    booking_id: Uuid,
) -> Result<Option<OtEmergencyConsent>, AppError> {
    Ok(sqlx::query_as::<_, OtEmergencyConsent>(
        "SELECT e.reason, u1.full_name AS first_doctor_name, e.first_certified_at, \
                u2.full_name AS second_doctor_name, e.second_certified_at \
         FROM ot_emergency_consent_certifications e \
         LEFT JOIN users u1 ON u1.id = e.first_doctor_id \
         LEFT JOIN users u2 ON u2.id = e.second_doctor_id \
         WHERE e.booking_id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL",
    )
    .bind(booking_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

#[derive(Debug, sqlx::FromRow)]
struct BookingState {
    priority: String,
    status: String,
    refused: bool,
}

fn booking_refusal(b: &BookingState) -> Option<&'static str> {
    if b.priority != "emergency" {
        return Some(
            "Implied consent applies only to emergency bookings. Take written consent, or \
             change the booking's priority to emergency if it is one.",
        );
    }
    if matches!(b.status.as_str(), "completed" | "cancelled") {
        return Some("This booking is closed.");
    }
    if b.refused {
        return Some(
            "The patient has refused consent for this operation. A refusal cannot be overridden \
             as implied consent.",
        );
    }
    None
}

/// POST /api/ot/bookings/{booking_id}/emergency-consent
///
/// The first call (with a reason) is the first doctor's certification; the
/// second call, by a different doctor in their own session, completes it.
pub async fn certify_emergency_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: CookieJar,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CertifyEmergencyConsentRequest>,
) -> Result<Json<OtBookingConsents>, AppError> {
    require_permission(&claims, permissions::ot::consent::EMERGENCY_OVERRIDE)?;
    guard_booking(&state, &claims, booking_id).await?;
    // The doctor proves it is them now, not whoever left a session open.
    medbrains_server_core::step_up::require_step_up(&state, &jar, &claims)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let booking = sqlx::query_as::<_, BookingState>(
        "SELECT b.priority::text AS priority, b.status::text AS status, \
                EXISTS (SELECT 1 FROM procedure_consents pc \
                        WHERE pc.ot_booking_id = b.id AND pc.tenant_id = b.tenant_id \
                          AND pc.status = 'refused' AND pc.deleted_at IS NULL) AS refused \
         FROM ot_bookings b \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL FOR UPDATE OF b",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if let Some(refusal) = booking_refusal(&booking) {
        return Err(AppError::Conflict(refusal.to_owned()));
    }

    let existing: Option<(Uuid, Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT id, first_doctor_id, second_doctor_id \
         FROM ot_emergency_consent_certifications \
         WHERE booking_id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (action, values) = match existing {
        None => {
            let reason = body.reason.as_deref().map(str::trim).unwrap_or_default();
            if reason.is_empty() {
                return Err(AppError::BadRequest(
                    "State why the operation cannot wait for consent.".to_owned(),
                ));
            }
            sqlx::query(
                "INSERT INTO ot_emergency_consent_certifications \
                 (tenant_id, booking_id, reason, first_doctor_id) VALUES ($1, $2, $3, $4)",
            )
            .bind(claims.tenant_id)
            .bind(booking_id)
            .bind(reason)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
            (
                "ot.consent.emergency_first",
                serde_json::json!({ "reason": reason }),
            )
        }
        Some((_, first, None)) if first == claims.sub => {
            return Err(AppError::Conflict(
                "You have already certified. A second, different doctor must certify in their \
                 own session."
                    .to_owned(),
            ));
        }
        Some((id, first, None)) => {
            sqlx::query(
                "UPDATE ot_emergency_consent_certifications \
                 SET second_doctor_id = $2, second_certified_at = now() \
                 WHERE id = $1",
            )
            .bind(id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
            (
                "ot.consent.emergency_second",
                serde_json::json!({ "first_doctor_id": first }),
            )
        }
        Some((_, _, Some(_))) => {
            return Err(AppError::Conflict(
                "Two doctors have already certified this emergency.".to_owned(),
            ));
        }
    };
    audit(&mut tx, &claims, action, booking_id, &values).await?;

    let out = booking_consents(&mut tx, claims.tenant_id, booking_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[cfg(test)]
mod tests {
    use super::{BookingState, booking_refusal};

    fn booking(priority: &str, refused: bool) -> BookingState {
        BookingState {
            priority: priority.to_owned(),
            status: "confirmed".to_owned(),
            refused,
        }
    }

    #[test]
    fn only_an_emergency_without_a_refusal_qualifies() {
        assert!(booking_refusal(&booking("emergency", false)).is_none());
        assert!(booking_refusal(&booking("elective", false)).is_some());
        assert!(booking_refusal(&booking("emergency", true)).is_some());
    }
}
