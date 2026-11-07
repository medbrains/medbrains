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

/// Post `req`'s charge, or put it on the attention queue.
///
/// Returns `Err` only when the queue row itself cannot be written; the
/// caller's transaction then fails as a whole, which is the honest outcome.
pub async fn charge_or_queue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    req: ChargeRequest<'_>,
) -> Result<ChargeOutcome, AppError> {
    let setting = read_setting(tx, &req.tenant_id, req.setting_module).await?;
    settle(tx, setting, &req).await
}

/// `charge_or_queue` for several charges from one action under one setting
/// (an OT completion's surgery, anaesthesia, time and consumables): the
/// setting is read once, from the first request, not once per line.
pub async fn charge_or_queue_all(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    reqs: &[ChargeRequest<'_>],
) -> Result<(), AppError> {
    let Some(first) = reqs.first() else {
        return Ok(());
    };
    let setting = read_setting(tx, &first.tenant_id, first.setting_module).await?;
    for req in reqs {
        settle(tx, setting, req).await?;
    }
    Ok(())
}

/// Post, skip or queue one charge given the setting's answer.
async fn settle(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    setting: Option<bool>,
    req: &ChargeRequest<'_>,
) -> Result<ChargeOutcome, AppError> {
    match setting {
        Some(false) => Ok(ChargeOutcome::Disabled),
        None => queue_charge(tx, req, REASON_SETTING_UNREADABLE).await,
        Some(true) => match post_charge(tx, req).await {
            Ok(result) => Ok(ChargeOutcome::Posted(result)),
            Err(error) => queue_charge(tx, req, reason_for(&error)).await,
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

/// `Some(on)` when the setting was read, `None` when it could not be. The
/// read runs in a savepoint so a failure leaves the caller's transaction
/// usable.
async fn read_setting(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    module: &str,
) -> Result<Option<bool>, AppError> {
    let mut savepoint = sqlx::Acquire::begin(&mut **tx).await?;
    match is_auto_billing_enabled(&mut savepoint, tenant_id, module).await {
        Ok(on) => {
            savepoint.commit().await?;
            Ok(Some(on))
        }
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, module, "auto-billing setting unreadable; charge queued");
            Ok(None)
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

/// Write the charge to the attention queue in the caller's transaction. A
/// second failure of the same charge while one is open adds nothing.
async fn queue_charge(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    req: &ChargeRequest<'_>,
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
    .bind(c.patient_id)
    .bind(c.encounter_id)
    .bind(&c.charge_code)
    .bind(c.quantity.max(1))
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
