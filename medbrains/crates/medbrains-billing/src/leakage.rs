//! Revenue leakage: care given to a patient that no bill carries.
//!
//! A lab test verified, an image reported or a procedure completed with no
//! charge goes on the charge attention queue (migrations 1411, 1416) with
//! reason `unbilled_order`, priced from the tariff. Stock used on a patient
//! with no charge (a store consumable issued as chargeable, billable ward
//! stock, consignment stock, a registry implant) goes on it as
//! `unbilled_consumption` (migration 1421), under the same rules below.
//!
//! The discharge final-bill checklist catches these only for inpatients and
//! only at the end; outpatients and day-care patients were never caught. This
//! check runs daily for every hospital (`medbrains-server`
//! `services::unbilled_orders`) and on demand from the queue screen.
//!
//! An order is **not** flagged when:
//! - a bill line already names it (`invoice_items.source_id`), or any of the
//!   patient's bills from a week before the service on carries a hand-entered
//!   line under a code the service is billed by;
//! - its module's `auto_charge_<module>` setting is off: that hospital bills
//!   the service by hand at the counter;
//! - it is on the queue already, whatever the status: a dismissed order is a
//!   decision and is never raised again;
//! - a package covers it: the patient's active package subscription includes
//!   the test or procedure, or a billing package on the visit's bill lists it;
//! - a rate card or rate plan prices it at an explicit ₹0 (an exemption). A
//!   catalogue or charge-master ₹0 is "no tariff", not "free": the row is
//!   raised unpriced and cannot be posted until a tariff is set;
//! - it came from a free health camp, or is dummy (training) data;
//! - it was done less than [`GRACE_HOURS`] ago (the desk is still billing
//!   it) or more than [`LOOKBACK_DAYS`] ago (past any claim window).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Serialize;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

mod sql;

/// The queue reason of an order done and never billed.
pub const REASON_UNBILLED_ORDER: &str = "unbilled_order";
/// The queue reason of stock used on a patient and never billed.
pub const REASON_UNBILLED_CONSUMPTION: &str = "unbilled_consumption";
/// The rows seen and worked under `billing.leakage.*`, as a SQL list: what
/// the detector finds, and the implant used with no patient named.
pub(crate) const LEAKAGE_REASONS_SQL: &str =
    "('unbilled_order', 'unbilled_consumption', 'implant_no_patient')";
/// Orders done this recently are still the desk's to bill, not a leak.
pub const GRACE_HOURS: i32 = 2;
/// Orders older than this are past any claim window; not raised.
pub const LOOKBACK_DAYS: i32 = 90;
/// Rows written per statement.
const BATCH: i64 = 500;
/// Statements per hospital per run: at most 10,000 rows, the rest next run.
const MAX_BATCHES: usize = 20;
/// An on-demand run waits this long after the hospital's last run.
const THROTTLE_MINUTES: i32 = 10;
/// The audit action every run writes, and the throttle reads.
const SCAN_ACTION: &str = "billing.leakage.scan";

/// Queue every done-but-unbilled order and every unbilled use of stock of
/// the transaction's hospital. Returns how many were queued.
///
/// Re-running adds nothing: a record on the queue in any status is skipped,
/// and the open-row unique index answers a concurrent run.
pub async fn queue_unbilled_orders(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    run_by: Option<Uuid>,
) -> Result<u64, AppError> {
    let orders = queue_batches(conn, sql::QUEUE_BATCH, tenant_id, run_by).await?;
    let stock = queue_batches(conn, sql::QUEUE_CONSUMPTION_BATCH, tenant_id, run_by).await?;
    Ok(orders + stock)
}

/// Run one detector statement in batches of [`BATCH`], at most
/// [`MAX_BATCHES`] of them. Returns how many rows it queued.
async fn queue_batches(
    conn: &mut PgConnection,
    batch_sql: &str,
    tenant_id: Uuid,
    run_by: Option<Uuid>,
) -> Result<u64, AppError> {
    let mut queued = 0;
    for _ in 0..MAX_BATCHES {
        let written = sqlx::query(batch_sql)
            .bind(tenant_id)
            .bind(GRACE_HOURS)
            .bind(LOOKBACK_DAYS)
            .bind(BATCH)
            .bind(run_by)
            .execute(&mut *conn)
            .await?
            .rows_affected();
        queued += written;
        if written < BATCH.unsigned_abs() {
            break;
        }
    }
    Ok(queued)
}

/// Hold the hospital's scan lock until the transaction ends, so two runs
/// (or a click and the daily pass) never interleave.
async fn lock_scans(conn: &mut PgConnection, tenant_id: Uuid) -> Result<(), AppError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('billing.leakage.scan:' || $1, 0))")
        .bind(tenant_id.to_string())
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// Whether a run of this hospital is on the audit chain within
/// [`THROTTLE_MINUTES`]. Read under [`lock_scans`].
async fn ran_recently(conn: &mut PgConnection, tenant_id: Uuid) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM audit_log WHERE tenant_id = $1 AND action = $2 \
           AND created_at > now() - make_interval(mins => $3))",
    )
    .bind(tenant_id)
    .bind(SCAN_ACTION)
    .bind(THROTTLE_MINUTES)
    .fetch_one(&mut *conn)
    .await?)
}

/// Where a queued order or use of stock stands when the desk posts it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OrderNow {
    /// Still done, and no bill carries it; how many are still to bill (net
    /// of returns, for stock).
    Unbilled(i32),
    /// A bill already carries it, by its id or by hand.
    Billed,
    /// No longer stands: cancelled, deleted, un-verified, or all returned.
    Gone,
}

/// Re-run the detector's "done" and "already billed" checks for one order
/// or (when `stock`) one use of stock, in the caller's transaction, so
/// posting cannot bill it twice or bill what came back.
pub(crate) async fn order_now(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    (stock, module): (bool, &str),
    order_id: Uuid,
) -> Result<OrderNow, AppError> {
    let recheck = if stock {
        sql::RECHECK_CONSUMPTION
    } else {
        sql::RECHECK
    };
    let now: Option<(bool, i32)> = sqlx::query_as(recheck)
        .bind(tenant_id)
        .bind(module)
        .bind(order_id)
        .fetch_optional(&mut *conn)
        .await?;
    Ok(match now {
        None => OrderNow::Gone,
        Some((true, _)) => OrderNow::Billed,
        Some((false, quantity)) => OrderNow::Unbilled(quantity),
    })
}

/// Before a queued charge is posted, in the posting unit of work.
///
/// - A row the detector found, or an implant with no patient named, must
///   carry a price (a ₹0 implant is "no tariff").
/// - An order or a use of stock must still stand and be on no bill. Stock
///   returned since it was queued posts only what is left (the row is
///   lowered to match); all of it returned, or an order cancelled, dismisses
///   the row (committed) and answers 409. One already billed answers 409 and
///   stays open for the desk to dismiss with that reason.
///
/// Returns the unit of work and the quantity to bill.
pub(crate) async fn check_before_post(
    mut tx: medbrains_kernel::Tx,
    claims: &Claims,
    item: &crate::charge_attention::ChargeAttentionItem,
) -> Result<(medbrains_kernel::Tx, i32), AppError> {
    let detected =
        item.reason == REASON_UNBILLED_ORDER || item.reason == REASON_UNBILLED_CONSUMPTION;
    let stock = item.reason == REASON_UNBILLED_CONSUMPTION || item.source_module == "consumable";
    require_price(item, detected)?;
    if item.reason == medbrains_server_services::billing::REASON_IMPLANT_NO_PATIENT {
        require_not_registry_duplicate(&mut tx, claims.tenant_id, item).await?;
    }
    if !detected && !stock {
        return Ok((tx, item.quantity));
    }
    let key = (stock, item.source_module.as_str());
    match order_now(&mut tx, claims.tenant_id, key, item.source_entity_id).await? {
        OrderNow::Unbilled(left) if left < item.quantity => {
            lower_quantity(&mut tx, claims.tenant_id, item.id, left).await?;
            Ok((tx, left))
        }
        OrderNow::Unbilled(_) => Ok((tx, item.quantity)),
        OrderNow::Billed => Err(AppError::Conflict(
            "This is already on a bill. Dismiss it with that reason.".to_owned(),
        )),
        OrderNow::Gone => {
            let why = if stock {
                "Stock returned or removed"
            } else {
                "Order cancelled"
            };
            crate::charge_attention::mark_dismissed(&mut tx, claims, item.id, why).await?;
            tx.commit().await?;
            Err(AppError::Conflict(format!(
                "{why} since it was queued, so it has been dismissed."
            )))
        }
    }
}

/// A found row or an implant with no patient named posts only with a price.
fn require_price(
    item: &crate::charge_attention::ChargeAttentionItem,
    detected: bool,
) -> Result<(), AppError> {
    let implant = item.reason == medbrains_server_services::billing::REASON_IMPLANT_NO_PATIENT;
    let unpriced = match item.unit_price_override {
        None => detected || implant,
        Some(price) => implant && price.is_zero(),
    };
    if unpriced {
        return Err(AppError::BadRequest(
            "Set a tariff for this service first.".to_owned(),
        ));
    }
    Ok(())
}

/// Refuse (409) to post a store usage that would bill a patient for more
/// units of the batch than the implant registry says they received.
///
/// The OT can enter the implant first, which records its usage and bills it;
/// the store may then record the same implant again with no patient. Named
/// after the fact, it would bill the patient twice. When the patient has any
/// registry entry on the batch, the units used on them may not exceed the
/// entries: the desk dismisses the duplicate, or the second implant is
/// entered in the registry first.
async fn require_not_registry_duplicate(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    item: &crate::charge_attention::ChargeAttentionItem,
) -> Result<(), AppError> {
    let (entries, units): (i64, i64) = sqlx::query_as(
        "WITH mv AS (SELECT batch_stock_id, patient_id FROM store_stock_movements \
                      WHERE id = $2 AND tenant_id = $1) \
         SELECT (SELECT COUNT(*) FROM implant_registry r, mv \
                  WHERE r.tenant_id = $1 AND r.batch_stock_id = mv.batch_stock_id \
                    AND r.patient_id = mv.patient_id AND r.deleted_at IS NULL), \
                (SELECT COALESCE(SUM(-m.quantity), 0)::int8 FROM store_stock_movements m, mv \
                  WHERE m.tenant_id = $1 AND m.batch_stock_id = mv.batch_stock_id \
                    AND m.patient_id = mv.patient_id AND m.deleted_at IS NULL \
                    AND m.reference_type = 'consignment_usage')",
    )
    .bind(tenant_id)
    .bind(item.source_entity_id)
    .fetch_one(&mut *conn)
    .await?;
    if entries > 0 && units > entries {
        return Err(AppError::Conflict(format!(
            "The implant registry has {entries} implant(s) of this batch for this patient, \
             and this would bill unit {units}. Dismiss it as a duplicate, or enter the \
             second implant in the registry first."
        )));
    }
    Ok(())
}

/// Lower the queued quantity to what is left to bill.
async fn lower_quantity(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
    quantity: i32,
) -> Result<(), AppError> {
    sqlx::query("UPDATE charge_attention_items SET quantity = $3 WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(tenant_id)
        .bind(quantity)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// What one run of the check found.
#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub queued: u64,
}

/// Run the check in one unit of work for `actor`'s hospital, audited.
///
/// The audit entry says who (or the system) and how many it queued. Runs of
/// one hospital are serialised; a `throttled` run within [`THROTTLE_MINUTES`] of the last
/// one is refused with 429.
pub async fn run_for(pool: &PgPool, actor: Actor, throttled: bool) -> Result<u64, AppError> {
    let run_by = (!actor.user_id.is_nil()).then_some(actor.user_id);
    let mut tx = medbrains_kernel::begin(pool, actor).await?;
    lock_scans(&mut tx, actor.tenant_id).await?;
    if throttled && ran_recently(&mut tx, actor.tenant_id).await? {
        return Err(AppError::TooManyRequests(
            "The check ran in the last 10 minutes. Try again shortly.".to_owned(),
        ));
    }
    let queued = queue_unbilled_orders(&mut tx, actor.tenant_id, run_by).await?;
    let detail = serde_json::json!({ "queued": queued });
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: actor.tenant_id,
            user_id: run_by,
            action: SCAN_ACTION,
            entity_type: "charge_attention_items",
            entity_id: None,
            old_values: None,
            new_values: Some(&detail),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(queued)
}

/// The daily pass: every active hospital, one unit of work each. A hospital
/// that fails is logged and the rest still run; the count is of rows queued.
pub async fn run_daily(pool: &PgPool) -> Result<u64, AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE is_active AND deleted_at IS NULL ORDER BY id LIMIT 10000",
    )
    .fetch_all(pool)
    .await?;
    let mut queued = 0;
    for tenant_id in tenants {
        match run_for(pool, Actor::system(tenant_id), false).await {
            Ok(n) => queued += n,
            Err(error) => tracing::error!(%error, %tenant_id, "unbilled-orders check failed"),
        }
    }
    Ok(queued)
}

/// `POST /api/billing/charge-attention/unbilled-scan` — run the check now
/// for the caller's hospital.
pub async fn scan_unbilled_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ScanResult>, AppError> {
    require_permission(&claims, permissions::billing::leakage::RESOLVE)?;
    let queued = run_for(&state.db, Actor::from_claims(&claims), true).await?;
    Ok(Json(ScanResult { queued }))
}
