//! Charge or queue: the one way a clinical action posts its automatic charge.
//!
//! The clinical write is never blocked by billing, and a charge never
//! disappears. The auto-billing setting is read in its own savepoint, the
//! charge is posted in its own savepoint (`auto_charge`), and when either
//! cannot be done the charge goes to `charge_attention_items` (migration 1411)
//! in the caller's transaction, for the billing desk to post or dismiss.
//!
//! Before this, call sites wrote `let _ = create_service_charge(..)` and
//! `is_auto_billing_enabled(..).await.unwrap_or(false)`: a failed charge was
//! never billed, and a failed setting read both read as "off" and left the
//! transaction aborted, so the clinical write itself rolled back on COMMIT
//! while the client saw 200.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::billing::{
    AutoChargeInput, AutoChargeResult, apply_concessions_best_effort, auto_charge,
    is_auto_billing_enabled,
};

/// Queue reason when the `auto_charge_<module>` setting could not be read.
pub const REASON_SETTING_UNREADABLE: &str = "billing_setting_unreadable";
/// Queue reason for a consignment implant used with no patient named: the
/// only row that carries no patient, until the desk names one.
pub const REASON_IMPLANT_NO_PATIENT: &str = "implant_no_patient";

/// One automatic charge a module wants posted.
#[derive(Debug)]
pub struct ChargeRequest<'a> {
    pub tenant_id: Uuid,
    /// The user whose action raised the charge.
    pub requested_by: Uuid,
    /// The setting that governs it: `auto_charge_<setting_module>`.
    pub setting_module: &'a str,
    pub charge: AutoChargeInput,
    /// Run the tenant's auto-concession rules on the new line, as
    /// `create_service_charge` always has. Off for callers that never did.
    pub apply_concessions: bool,
}

/// What became of the charge. Every variant is a decision the caller can
/// report; none of them is a silent loss.
#[derive(Debug)]
pub enum ChargeOutcome {
    /// Posted onto a draft invoice (or already there).
    Posted(AutoChargeResult),
    /// The hospital switched auto-billing off for this module.
    Disabled,
    /// Could not be posted; it is on the attention queue.
    Queued,
}

/// The hospital's `auto_charge_<module>` setting, as far as it could be read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutoBilling {
    On,
    Off,
    /// The read failed. Charges go to the queue rather than being treated as
    /// off: an unknown answer is not a no.
    Unknown,
}

/// Post `req`'s charge, or put it on the attention queue.
///
/// Returns `Err` only when the queue row itself cannot be written, or when
/// the request is malformed (quantity below 1, a caller bug); the caller's
/// transaction then fails as a whole, which is the honest outcome.
pub async fn charge_or_queue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    req: ChargeRequest<'_>,
) -> Result<ChargeOutcome, AppError> {
    check_quantity(&req)?;
    let setting = read_auto_billing(tx, &req.tenant_id, req.setting_module).await?;
    settle(tx, setting, &req).await
}

/// Post or queue charges whose setting the caller read first with
/// `read_auto_billing` — so a caller that needs lookups to build its charges
/// (an encounter, a room rate, an OT's consumables) runs them only when
/// billing is not off, and a failed lookup never fails a clinical write the
/// hospital does not bill.
pub async fn settle_charges(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    setting: AutoBilling,
    reqs: &[ChargeRequest<'_>],
) -> Result<(), AppError> {
    for req in reqs {
        check_quantity(req)?;
    }
    for req in reqs {
        settle(tx, setting, req).await?;
    }
    Ok(())
}

/// A charge for fewer than one of something is a caller bug, not a charge.
fn check_quantity(req: &ChargeRequest<'_>) -> Result<(), AppError> {
    if req.charge.quantity < 1 {
        return Err(AppError::BadRequest(
            "billing.error.chargeQuantityBelowOne".to_owned(),
        ));
    }
    Ok(())
}

/// Post, skip or queue one charge given the setting's answer.
async fn settle(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    setting: AutoBilling,
    req: &ChargeRequest<'_>,
) -> Result<ChargeOutcome, AppError> {
    match setting {
        AutoBilling::Off => Ok(ChargeOutcome::Disabled),
        AutoBilling::Unknown => {
            queue_charge(
                tx,
                req,
                Some(req.charge.patient_id),
                REASON_SETTING_UNREADABLE,
            )
            .await
        }
        AutoBilling::On => match post_charge(tx, req).await {
            Ok(result) => Ok(ChargeOutcome::Posted(result)),
            Err(error) => {
                queue_charge(tx, req, Some(req.charge.patient_id), reason_for(&error)).await
            }
        },
    }
}

/// Post the charge now, with no setting check: the module's own path when
/// the setting is on, and the billing desk's "Post charge" on a queued item.
pub async fn post_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    req: &ChargeRequest<'_>,
) -> Result<AutoChargeResult, AppError> {
    let result = auto_charge(tx, &req.tenant_id, req.charge.clone()).await?;
    if req.apply_concessions && !result.skipped_duplicate {
        apply_concessions_best_effort(tx, req, &result).await?;
    }
    Ok(result)
}

/// Read `auto_charge_<module>` in a savepoint, so a failure leaves the
/// caller's transaction usable and answers `Unknown`.
pub async fn read_auto_billing(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    module: &str,
) -> Result<AutoBilling, AppError> {
    let mut savepoint = sqlx::Acquire::begin(&mut **tx).await?;
    match is_auto_billing_enabled(&mut savepoint, tenant_id, module).await {
        Ok(on) => {
            savepoint.commit().await?;
            Ok(if on {
                AutoBilling::On
            } else {
                AutoBilling::Off
            })
        }
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, module, "auto-billing setting unreadable; charge queued");
            Ok(AutoBilling::Unknown)
        }
    }
}

/// The error's class, for the queue. Never the message: a database error's
/// text can quote the row, and the row is a patient's.
#[must_use]
pub const fn reason_for(error: &AppError) -> &'static str {
    match error {
        AppError::Database(_) => "charge_failed:database",
        AppError::BadRequest(_) | AppError::ValidationFailed(_) => "charge_failed:rejected",
        AppError::NotFound => "charge_failed:not_found",
        AppError::Conflict(_) => "charge_failed:conflict",
        AppError::Internal(_) | AppError::Config(_) => "charge_failed:internal",
        _ => "charge_failed:other",
    }
}

/// Refuse (404) a patient who is not this hospital's or has been deleted,
/// before a stock record or a charge names them. A bypass role skips the
/// access gate, so the gate alone does not prove the id is real.
pub async fn require_live_patient(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let live: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM patients \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_one(&mut *conn)
    .await?;
    if live {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

/// Queue a charge whose patient nobody named: an implant used on no one.
///
/// Queued whatever the auto-billing setting says: the implant is the
/// hospital's debt to the vendor either way, so it is never skipped.
/// `req.charge.patient_id` is ignored; the desk names the patient on the row.
pub async fn queue_patient_unknown(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    req: &ChargeRequest<'_>,
) -> Result<ChargeOutcome, AppError> {
    check_quantity(req)?;
    queue_charge(tx, req, None, REASON_IMPLANT_NO_PATIENT).await
}

/// Write the charge to the attention queue in the caller's transaction. A
/// second failure of the same charge while one is open adds nothing.
async fn queue_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    req: &ChargeRequest<'_>,
    patient_id: Option<Uuid>,
    reason: &str,
) -> Result<ChargeOutcome, AppError> {
    let c = &req.charge;
    sqlx::query(
        "INSERT INTO charge_attention_items \
         (tenant_id, source_module, setting_module, source_entity_id, patient_id, \
          encounter_id, charge_code, quantity, description_override, unit_price_override, \
          tax_percent_override, apply_concessions, reason, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) \
         ON CONFLICT (tenant_id, source_module, source_entity_id) \
           WHERE status = 'open' AND deleted_at IS NULL DO NOTHING",
    )
    .bind(req.tenant_id)
    .bind(&c.source)
    .bind(req.setting_module)
    .bind(c.source_id)
    .bind(patient_id)
    .bind(c.encounter_id)
    .bind(&c.charge_code)
    .bind(c.quantity)
    .bind(&c.description_override)
    .bind(c.unit_price_override)
    .bind(c.tax_percent_override)
    .bind(req.apply_concessions)
    .bind(reason)
    .bind(req.requested_by)
    .execute(&mut **tx)
    .await?;
    tracing::warn!(source = %c.source, source_id = %c.source_id, reason, "charge queued for attention");
    Ok(ChargeOutcome::Queued)
}
