//! Deferring a donor by hand, and reinstating one.
//!
//! The collection check in `issue_gates` reads `is_deferred` and
//! `deferral_until`; until this, only a reactive TTI result ever set them, so
//! a donor found unfit at the couch (a recent tattoo, malaria, pregnancy, a
//! drug on the deferral list) could not be recorded as such. Every change is
//! audited with the old and new state. A TTI-reactive deferral is not lifted
//! here: that is a confirmatory-testing decision, not a desk edit.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_core::blood_bank::BloodDonor;
use medbrains_core::permissions;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct SetDeferralRequest {
    /// `true` to defer, `false` to reinstate.
    pub deferred: bool,
    /// End of a temporary deferral; absent means permanent.
    pub until: Option<NaiveDate>,
    pub reason: String,
}

/// `PUT /api/blood-bank/donors/{id}/deferral`
pub async fn set_donor_deferral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donor_id): Path<Uuid>,
    Json(body): Json<SetDeferralRequest>,
) -> Result<Json<BloodDonor>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::DEFER)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "blood_bank",
    )
    .await?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Give the reason for deferring or reinstating this donor.".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let before = sqlx::query_as::<_, BloodDonor>(
        "SELECT * FROM blood_donors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         FOR UPDATE",
    )
    .bind(donor_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let (true, Some(until)) = (body.deferred, body.until) {
        let past = sqlx::query_scalar::<_, bool>("SELECT $1::date <= CURRENT_DATE")
            .bind(until)
            .fetch_one(&mut *tx)
            .await?;
        if past {
            return Err(AppError::BadRequest(
                "A temporary deferral must end after today; leave the date empty for a \
                 permanent one."
                    .to_owned(),
            ));
        }
    }
    if !body.deferred {
        let reactive = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM blood_tti_results r \
               JOIN blood_donations d ON d.id = r.donation_id AND d.tenant_id = r.tenant_id \
              WHERE r.tenant_id = $1 AND d.donor_id = $2 AND r.result = 'reactive' \
                AND r.deleted_at IS NULL AND d.deleted_at IS NULL)",
        )
        .bind(claims.tenant_id)
        .bind(donor_id)
        .fetch_one(&mut *tx)
        .await?;
        if reactive {
            drop(tx);
            return Err(crate::issue_gates::audited(
                &state,
                &claims,
                "blood_bank.donor_reinstate_refused",
                Some(donor_id),
                AppError::Conflict(
                    "This donor has a reactive TTI result on record and stays deferred. \
                     Reinstatement follows confirmatory testing by the medical officer, not \
                     this screen."
                        .to_owned(),
                ),
            )
            .await);
        }
    }

    let after = sqlx::query_as::<_, BloodDonor>(
        "UPDATE blood_donors SET is_deferred = $3, \
                deferral_until = CASE WHEN $3 THEN $4::date ELSE NULL END, \
                deferral_reason = CASE WHEN $3 THEN $5::text ELSE NULL END, \
                updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(donor_id)
    .bind(claims.tenant_id)
    .bind(body.deferred)
    .bind(body.until)
    .bind(reason)
    .fetch_one(&mut *tx)
    .await?;

    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if body.deferred {
                "blood_bank.donor_deferred"
            } else {
                "blood_bank.donor_reinstated"
            },
            entity_type: "blood_donor",
            entity_id: Some(donor_id),
            old_values: Some(&json!({
                "is_deferred": before.is_deferred,
                "deferral_until": before.deferral_until,
                "deferral_reason": before.deferral_reason,
            })),
            new_values: Some(&json!({
                "is_deferred": after.is_deferred,
                "deferral_until": after.deferral_until,
                "reason": reason,
            })),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;
    Ok(Json(after))
}
