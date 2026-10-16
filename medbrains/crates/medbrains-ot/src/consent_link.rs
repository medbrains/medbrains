//! Linking a signed consent to the booked operation, and undoing a link made
//! in error. Both are audited; see `consent.rs` for what counts as consented.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use uuid::Uuid;

use crate::consent::{
    OtBookingConsents, audit, booking_consent_gap, booking_consents, guard_booking,
};

#[derive(Debug, Deserialize)]
pub struct LinkConsentRequest {
    pub consent_id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct ConsentRow {
    patient_matches: bool,
    consent_type: String,
    status: String,
    withdrawn: bool,
    expired: bool,
    other_booking: bool,
}

/// Why this consent cannot be linked to the booking, read off its row.
fn link_refusal(row: &ConsentRow) -> Option<&'static str> {
    if !row.patient_matches {
        return Some("This consent belongs to another patient.");
    }
    if !matches!(
        row.consent_type.as_str(),
        "surgery" | "procedure" | "anesthesia"
    ) {
        return Some("Only a surgical, procedure or anaesthesia consent can cover an operation.");
    }
    if row.status != "signed" || row.withdrawn {
        return Some("This consent is not signed, or it has been withdrawn.");
    }
    if row.expired {
        return Some("This consent has expired. Take a fresh consent.");
    }
    if row.other_booking {
        return Some("This consent is already linked to another operation.");
    }
    None
}

/// POST /api/ot/bookings/{booking_id}/consents — link a signed consent.
///
/// The caller confirms the consent covers the booked operation; the server
/// checks it is this patient's, of a surgical or anaesthesia type, signed, not
/// withdrawn or expired, and not already covering another operation.
pub async fn link_booking_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<LinkConsentRequest>,
) -> Result<Json<OtBookingConsents>, AppError> {
    require_permission(&claims, permissions::ot::bookings::UPDATE)?;
    guard_booking(&state, &claims, booking_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsentRow>(
        "SELECT (pc.patient_id = b.patient_id) AS patient_matches, \
                pc.consent_type::text AS consent_type, pc.status::text AS status, \
                (pc.withdrawn_at IS NOT NULL) AS withdrawn, \
                (pc.expires_at IS NOT NULL AND pc.expires_at <= now()) AS expired, \
                (pc.ot_booking_id IS NOT NULL AND pc.ot_booking_id <> b.id) AS other_booking \
         FROM procedure_consents pc \
         JOIN ot_bookings b ON b.id = $2 AND b.tenant_id = $3 AND b.deleted_at IS NULL \
         WHERE pc.id = $1 AND pc.tenant_id = $3 AND pc.deleted_at IS NULL \
         FOR UPDATE OF pc",
    )
    .bind(body.consent_id)
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if let Some(reason) = link_refusal(&row) {
        return Err(AppError::Conflict(reason.to_owned()));
    }

    sqlx::query(
        "UPDATE procedure_consents SET ot_booking_id = $2, updated_at = now() \
         WHERE id = $1 AND tenant_id = $3",
    )
    .bind(body.consent_id)
    .bind(booking_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    let values = serde_json::json!({ "consent_id": body.consent_id });
    audit(&mut tx, &claims, "ot.consent.linked", booking_id, &values).await?;

    let out = booking_consents(&mut tx, claims.tenant_id, booking_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct UnlinkConsentRequest {
    pub reason: String,
}

/// POST /api/ot/bookings/{booking_id}/consents/{consent_id}/unlink
///
/// Undo a link made in error. Refused once surgery has started: the consent
/// the operation went ahead on is part of the record. If unlinking leaves the
/// booking without consent, `consent_obtained` goes back to false.
pub async fn unlink_booking_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((booking_id, consent_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UnlinkConsentRequest>,
) -> Result<Json<OtBookingConsents>, AppError> {
    require_permission(&claims, permissions::ot::bookings::UPDATE)?;
    guard_booking(&state, &claims, booking_id).await?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Give the reason for unlinking this consent.".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status: String = sqlx::query_scalar(
        "SELECT status::text FROM ot_bookings \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if matches!(status.as_str(), "in_progress" | "completed") {
        return Err(AppError::Conflict(
            "Surgery has started; the consent it went ahead on cannot be unlinked.".to_owned(),
        ));
    }

    let unlinked = sqlx::query(
        "UPDATE procedure_consents SET ot_booking_id = NULL, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND ot_booking_id = $3 AND deleted_at IS NULL",
    )
    .bind(consent_id)
    .bind(claims.tenant_id)
    .bind(booking_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if unlinked == 0 {
        return Err(AppError::NotFound);
    }
    if booking_consent_gap(&mut tx, claims.tenant_id, booking_id)
        .await?
        .is_some()
    {
        sqlx::query(
            "UPDATE ot_bookings SET consent_obtained = false WHERE id = $1 AND tenant_id = $2",
        )
        .bind(booking_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }
    let values = serde_json::json!({ "consent_id": consent_id, "reason": reason });
    audit(&mut tx, &claims, "ot.consent.unlinked", booking_id, &values).await?;

    let out = booking_consents(&mut tx, claims.tenant_id, booking_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[cfg(test)]
mod tests {
    use super::{ConsentRow, link_refusal};

    #[test]
    fn a_consent_for_another_operation_cannot_be_linked() {
        let ok = ConsentRow {
            patient_matches: true,
            consent_type: "surgery".to_owned(),
            status: "signed".to_owned(),
            withdrawn: false,
            expired: false,
            other_booking: false,
        };
        assert!(link_refusal(&ok).is_none());
        assert!(
            link_refusal(&ConsentRow {
                other_booking: true,
                ..ok
            })
            .is_some()
        );
    }
}
