//! A patient's ABHA leaves this hospital (M2 test case
//! HIP_INIT_ABHA_OPTOUT_DEACTIVATE): the patient opts out of sharing here,
//! or deletes or deactivates their ABHA at the desk (PROF_ABHA_605).
//!
//! Either way the hospital stops using the ABHA: the link is ended and
//! soft-deleted (so another ABHA can be linked later), the ABHA identifiers
//! on the patient are retired, the consents patients granted this hospital
//! as a HIP are deleted, and records not yet linked stay unlinked with the
//! reason shown. Records ABDM already holds stay with ABDM: there is no API
//! to unlink them, and the patient controls them from their ABHA app.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Longest reason kept; a sentence, not a document.
const MAX_REASON: usize = 500;

#[derive(Debug, Deserialize)]
pub struct OptOut {
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct OptedOut {
    /// The ABHA number that was on the patient, masked to its last four digits.
    pub abha_ending: String,
    pub consents_deleted: u64,
}

/// Why the link ended, for the row and the audit trail.
#[derive(Clone, Copy, Debug)]
pub(crate) enum Ending {
    OptedOut,
    DeletedAtAbdm,
    DeactivatedAtAbdm,
}

impl Ending {
    const fn status(self) -> &'static str {
        match self {
            Self::OptedOut => "opted_out",
            Self::DeletedAtAbdm => "deleted",
            Self::DeactivatedAtAbdm => "deactivated",
        }
    }
}

/// End the patient's ABHA link and delete what hangs off it. Returns the
/// ABHA number that was linked and how many consents were deleted.
///
/// # Errors
/// 404 when the patient has no ABHA linked here; database faults.
pub(crate) async fn end_link(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, patient_id, user_id): (Uuid, Uuid, Uuid),
    ending: Ending,
    reason: &str,
) -> Result<(String, u64), AppError> {
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let ended: Option<(String, Option<String>)> = sqlx::query_as(
        "UPDATE patient_abha_links SET status = $4, unlinked_at = now(), \
                linking_token = NULL, token_expiry = NULL, \
                opted_out_at = now(), opted_out_by = $3, opt_out_reason = $5, \
                deleted_at = now(), deleted_by = $3, delete_reason = $5 \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
          RETURNING abha_number, abha_address",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(user_id)
    .bind(ending.status())
    .bind(reason)
    .fetch_optional(&mut **tx)
    .await?;
    let (number, address) = ended.ok_or(AppError::NotFound)?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE patient_identifiers SET deleted_at = now(), deleted_by = $3, delete_reason = $4 \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
            AND id_type IN ('abha'::identifier_type, 'abha_address'::identifier_type)",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(user_id)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let consents = sqlx::query(
        "UPDATE abdm_consent_artefacts SET deleted_at = now(), deleted_by = $3, delete_reason = $4 \
          WHERE tenant_id = $1 AND patient_id = $2 AND role = 'hip' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(user_id)
    .bind(reason)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_care_contexts SET link_status = 'not_linked', last_error = $3 \
          WHERE tenant_id = $1 AND patient_id = $2 AND link_status <> 'linked' \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(format!("The patient's ABHA was removed: {reason}"))
    .execute(&mut **tx)
    .await?;
    let audit = serde_json::json!({
        "ending": ending.status(),
        "reason": reason,
        "abha_address": address,
        "consents_deleted": consents,
    });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id,
            user_id: Some(user_id),
            action: "patient.abha.unlinked",
            entity_type: "patient",
            entity_id: Some(patient_id),
            old_values: None,
            new_values: Some(&audit),
            ip_address: None,
        },
    )
    .await?;
    Ok((number, consents))
}

/// The last four digits, for a confirmation that does not repeat the ID.
pub(crate) fn ending_digits(number: &str) -> String {
    let d: String = number.chars().filter(char::is_ascii_digit).collect();
    d.chars().skip(d.len().saturating_sub(4)).collect()
}

/// `POST /api/abdm/patients/{patient_id}/abha/opt-out` — the patient
/// withdraws their ABHA from this hospital.
///
/// # Errors
/// 403 without `abdm.abha.unlink` or access to the patient; 400 without a
/// reason; 404 when the patient has no ABHA linked here.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn opt_out(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<OptOut>,
) -> Result<Json<OptedOut>, AppError> {
    require_permission(&claims, permissions::abdm::abha::UNLINK)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let reason = body.reason.trim();
    if reason.is_empty() || reason.len() > MAX_REASON {
        return Err(AppError::BadRequest(
            "say in a sentence why the patient is opting out".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (number, consents) = end_link(
        &mut tx,
        (claims.tenant_id, patient_id, claims.sub),
        Ending::OptedOut,
        reason,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(OptedOut {
        abha_ending: ending_digits(&number),
        consents_deleted: consents,
    }))
}

#[cfg(test)]
mod tests {
    use super::ending_digits;

    #[test]
    fn only_the_last_four_digits_are_repeated() {
        assert_eq!(ending_digits("91-4173-3253-1234"), "1234");
        assert_eq!(ending_digits("12"), "12");
    }
}
