//! Clinician professional-registration credential gate, shared across the regulated
//! acts (prescribing, operating). A **revoked** registration hard-blocks with no
//! override; an **expired** one is a soft gate (allowed with a logged override reason).
//! No `doctor_profiles` row / no dates on file → not gated (nothing to check against).

use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::error::AppError;

/// Enforce `user_id`'s registration credential before `action` (e.g. "prescribe",
/// "book surgery"). Runs inside the caller's transaction.
pub async fn enforce_prescriber_credential(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    override_reason: Option<&str>,
    action: &str,
) -> Result<(), AppError> {
    let row: Option<(bool, bool)> = sqlx::query_as(
        "SELECT COALESCE(registration_revoked, false), \
                (registration_valid_until IS NOT NULL \
                 AND registration_valid_until < CURRENT_DATE) \
         FROM doctor_profiles WHERE user_id = $1 AND tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some((revoked, expired)) = row else {
        return Ok(());
    };

    if revoked {
        return Err(AppError::BadRequest(format!(
            "Clinician's medical registration is REVOKED — cannot {action}. This cannot be overridden."
        )));
    }

    if expired {
        let reason = override_reason.map(str::trim).filter(|r| !r.is_empty());
        match reason {
            None => {
                return Err(AppError::BadRequest(format!(
                    "Clinician's medical registration has expired. Renew it, or provide an override reason to {action}."
                )));
            }
            Some(reason) => {
                tracing::warn!(
                    tenant_id = %tenant_id,
                    clinician = %user_id,
                    action,
                    reason,
                    "credential override: expired registration"
                );
            }
        }
    }

    Ok(())
}
