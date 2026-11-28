//! Who may act on a referral: the side it is addressed to answers it, the
//! side that sent it withdraws it. Anyone else gets 404, so the endpoints are
//! not a way to learn which referrals exist.

use medbrains_core::consultation::Referral;
use medbrains_kernel::authz::is_bypass_role;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use uuid::Uuid;

use crate::referral_lifecycle::lock;

/// The referral, locked, if it is the caller's to act on — otherwise 404, so
/// the endpoint is not a way to learn which referrals exist.
pub(super) async fn require_addressee_access(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<Referral, AppError> {
    let referral = lock(tx, claims, id).await?;
    let to_me = referral.to_doctor_id == Some(claims.sub)
        || (referral.to_doctor_id.is_none()
            && claims.department_ids.contains(&referral.to_department_id));
    if to_me || is_bypass_role(claims) {
        Ok(referral)
    } else {
        Err(AppError::NotFound)
    }
}

/// The referral, for its sender only (or a bypass role): withdrawing it is the
/// referring doctor's call. Anyone else gets 404, as for a referral that does
/// not exist.
pub(super) async fn require_sender_access(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<Referral, AppError> {
    let referral = lock(tx, claims, id).await?;
    if referral.from_doctor_id == Some(claims.sub) || is_bypass_role(claims) {
        Ok(referral)
    } else {
        Err(AppError::NotFound)
    }
}
