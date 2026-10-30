//! The pregnancy question before an ionising exposure.
//!
//! A woman aged 12 to 50 (or of unknown age) having an X-ray, CT,
//! fluoroscopy, mammography or nuclear medicine exam is asked whether she is
//! or may be pregnant, and the answer is recorded with how it was
//! established and who asked — AERB's notice to patients, ICRP 84, NABH.
//! "Pregnant" or "cannot be ruled out" needs a reason the exam still goes
//! ahead (a benefit that outweighs the risk, an emergency). The exam cannot
//! be started or completed by hand until the answer is recorded.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::radiology::RadiologyOrder;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::dose::open_tx;

pub const STATUSES: [&str; 3] = ["not_pregnant", "pregnant", "cannot_rule_out"];
pub const METHODS: [&str; 4] = ["asked", "lmp", "urine_test", "serum_test"];

/// Does this order's exposure need the pregnancy question answered first?
///
/// # Errors
/// Database errors; `NotFound` for no such order.
pub async fn is_required(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<bool, AppError> {
    sqlx::query_scalar::<_, bool>(
        "SELECT m.is_ionising AND p.gender::text = 'female' \
                AND (p.date_of_birth IS NULL \
                     OR date_part('year', age(current_date, p.date_of_birth)) BETWEEN 12 AND 50) \
           FROM radiology_orders o \
           JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
           JOIN radiology_modalities m ON m.id = o.modality_id \
          WHERE o.id = $1 AND o.tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Refuse to start or complete an exposure whose pregnancy question is
/// unanswered.
///
/// # Errors
/// `Conflict` naming what to do.
pub async fn require_answered(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    if !is_required(tx, tenant_id, order_id).await? {
        return Ok(());
    }
    let answered: bool = sqlx::query_scalar(
        "SELECT pregnancy_status IS NOT NULL FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if answered {
        Ok(())
    } else {
        Err(AppError::Conflict(
            "Ask whether she is or may be pregnant, and record the answer, before the exposure"
                .to_owned(),
        ))
    }
}

#[derive(Debug, Deserialize)]
pub struct PregnancyCheck {
    pub status: String,
    pub method: String,
    pub justification: Option<String>,
}

impl PregnancyCheck {
    fn validate(&self) -> Result<Option<String>, AppError> {
        if !STATUSES.contains(&self.status.as_str()) {
            return Err(AppError::BadRequest(
                "Answer: not pregnant, pregnant, or cannot be ruled out".to_owned(),
            ));
        }
        if !METHODS.contains(&self.method.as_str()) {
            return Err(AppError::BadRequest(
                "Say how it was established".to_owned(),
            ));
        }
        let justification = self
            .justification
            .as_deref()
            .map(str::trim)
            .filter(|j| !j.is_empty());
        if self.status != "not_pregnant" && justification.is_none() {
            return Err(AppError::BadRequest(
                "Say why the exam goes ahead when she is or may be pregnant".to_owned(),
            ));
        }
        Ok(justification.map(str::to_owned))
    }
}

/// `POST /api/radiology/orders/{id}/pregnancy-check` — record the answer.
pub async fn record_pregnancy_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PregnancyCheck>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::PREGNANCY_CHECK)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        id,
    )
    .await?;
    let justification = body.validate()?;
    let mut tx = open_tx(&state, &claims).await?;
    let order = sqlx::query_as::<_, RadiologyOrder>(
        "UPDATE radiology_orders SET pregnancy_status = $3, pregnancy_check_method = $4, \
                pregnancy_justification = $5, pregnancy_checked_by = $6, \
                pregnancy_checked_at = now(), pregnancy_checked = true, \
                patient_pregnant = ($3 = 'pregnant'), updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.method)
    .bind(&justification)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let values = json!({
        "patient_id": order.patient_id, "status": body.status, "method": body.method,
        "justification": justification,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "radiology.pregnancy_check",
            entity_type: "radiology_order",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(order))
}

#[cfg(test)]
mod tests {
    use super::PregnancyCheck;

    fn check(status: &str, method: &str, why: Option<&str>) -> PregnancyCheck {
        PregnancyCheck {
            status: status.to_owned(),
            method: method.to_owned(),
            justification: why.map(str::to_owned),
        }
    }

    #[test]
    fn a_possible_pregnancy_needs_a_reason_to_go_ahead() {
        assert!(check("not_pregnant", "asked", None).validate().is_ok());
        assert!(check("pregnant", "urine_test", None).validate().is_err());
        assert!(
            check("cannot_rule_out", "lmp", Some("  "))
                .validate()
                .is_err()
        );
        assert!(
            check(
                "pregnant",
                "serum_test",
                Some("Suspected PE; benefit outweighs fetal dose")
            )
            .validate()
            .is_ok()
        );
        assert!(check("maybe", "asked", None).validate().is_err());
        assert!(check("not_pregnant", "guess", None).validate().is_err());
    }
}
