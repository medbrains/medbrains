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

/// Where an unbilled order stands when the desk posts it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OrderNow {
    /// Still done, and no bill carries it.
    Unbilled,
    /// A bill already carries it, by its id or by hand.
    Billed,
    /// No longer done: cancelled, deleted or un-verified.
    Gone,
}

/// Re-run the detector's "done" and "already billed" checks for one order
/// (or use of stock, by `reason`), in the caller's transaction, so posting
/// cannot bill it twice.
pub(crate) async fn order_now(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    (reason, module): (&str, &str),
    order_id: Uuid,
) -> Result<OrderNow, AppError> {
    let recheck = if reason == REASON_UNBILLED_CONSUMPTION {
        sql::RECHECK_CONSUMPTION
    } else {
        sql::RECHECK
    };
    let billed: Option<bool> = sqlx::query_scalar(recheck)
        .bind(tenant_id)
        .bind(module)
        .bind(order_id)
        .fetch_optional(&mut *conn)
        .await?;
    Ok(match billed {
        None => OrderNow::Gone,
        Some(true) => OrderNow::Billed,
        Some(false) => OrderNow::Unbilled,
    })
}

/// Before an unbilled order is posted: it must have a price, still be done,
/// and still be on no bill. A cancelled order's row is dismissed (committed)
/// and the post answers 409; a billed one answers 409 and stays open for the
/// desk to dismiss with that reason. Takes the unit of work so it can commit.
pub(crate) async fn check_unbilled_order(
    mut tx: medbrains_kernel::Tx,
    claims: &Claims,
    item: &crate::charge_attention::ChargeAttentionItem,
) -> Result<medbrains_kernel::Tx, AppError> {
    if item.unit_price_override.is_none() {
        return Err(AppError::BadRequest(
            "Set a tariff for this service first.".to_owned(),
        ));
    }
    let now = order_now(
        &mut tx,
        claims.tenant_id,
        (item.reason.as_str(), item.source_module.as_str()),
        item.source_entity_id,
    )
    .await?;
    match now {
        OrderNow::Unbilled => Ok(tx),
        OrderNow::Billed => Err(AppError::Conflict(
            "This order is already on a bill. Dismiss it with that reason.".to_owned(),
        )),
        OrderNow::Gone => {
            crate::charge_attention::mark_dismissed(&mut tx, claims, item.id, "Order cancelled")
                .await?;
            tx.commit().await?;
            Err(AppError::Conflict(
                "This order was cancelled, so it has been dismissed.".to_owned(),
            ))
        }
    }
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
