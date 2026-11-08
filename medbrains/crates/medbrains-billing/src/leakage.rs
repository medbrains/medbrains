//! Revenue leakage, first check: orders done for a patient that no bill carries.
//!
//! A lab test verified, an image reported or a procedure completed with no
//! charge goes on the charge attention queue (migrations 1411, 1416) with
//! reason `unbilled_order`, priced from the tariff.
//!
//! The discharge final-bill checklist catches these only for inpatients and
//! only at the end; outpatients and day-care patients were never caught. This
//! check runs daily for every hospital (`medbrains-server`
//! `services::unbilled_orders`) and on demand from the queue screen.
//!
//! An order is **not** flagged when:
//! - a bill line already names it (`invoice_items.source_id`), or the visit's
//!   bill carries a hand-entered line with its charge code;
//! - it is on the queue already, whatever the status: a dismissed order is a
//!   decision and is never raised again;
//! - a package covers it: the patient's active package subscription includes
//!   the test or procedure, or a billing package on the visit's bill lists it;
//! - its tariff is an explicit ₹0 (a scheme or policy exemption);
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

/// The queue reason every row this check writes carries.
pub const REASON_UNBILLED_ORDER: &str = "unbilled_order";
/// Orders done this recently are still the desk's to bill, not a leak.
pub const GRACE_HOURS: i32 = 2;
/// Orders older than this are past any claim window; not raised.
pub const LOOKBACK_DAYS: i32 = 90;
/// Rows written per statement.
const BATCH: i64 = 500;
/// Statements per hospital per run: at most 10,000 rows, the rest next run.
const MAX_BATCHES: usize = 20;

/// One batch: find done, unbilled, uncovered orders and queue them, in one
/// statement. `$1` tenant, `$2` grace hours, `$3` look-back days, `$4` batch
/// size, `$5` the person running it (NULL for the daily pass).
const QUEUE_BATCH: &str = "\
WITH done AS ( \
  SELECT 'lab'::text AS module, lo.id AS order_id, lo.patient_id, lo.encounter_id, \
         COALESCE(lo.department_id, t.department_id, e.department_id) AS department_id, \
         t.code AS charge_code, t.name AS description, t.price AS catalog_price, \
         COALESCE(lo.verified_at, lo.completed_at, lo.updated_at) AS service_at, \
         lo.test_id, NULL::uuid AS procedure_id \
    FROM lab_orders lo \
    JOIN lab_test_catalog t ON t.id = lo.test_id AND t.tenant_id = lo.tenant_id \
    LEFT JOIN encounters e ON e.id = lo.encounter_id AND e.tenant_id = lo.tenant_id \
   WHERE lo.tenant_id = $1 AND lo.deleted_at IS NULL AND lo.status = 'verified' \
     AND lo.camp_id IS NULL AND NOT COALESCE(e.is_dummy, false) \
  UNION ALL \
  SELECT 'radiology', ro.id, ro.patient_id, ro.encounter_id, e.department_id, \
         COALESCE(re.charge_code, 'RAD-' || rm.code), \
         COALESCE(re.name, rm.name) || COALESCE(' — ' || ro.body_part, ''), NULL::numeric, \
         COALESCE(ro.completed_at, ro.updated_at), NULL::uuid, NULL::uuid \
    FROM radiology_orders ro \
    JOIN radiology_modalities rm ON rm.id = ro.modality_id AND rm.tenant_id = ro.tenant_id \
    LEFT JOIN radiology_exams re ON re.id = ro.exam_id AND re.tenant_id = ro.tenant_id \
    LEFT JOIN encounters e ON e.id = ro.encounter_id AND e.tenant_id = ro.tenant_id \
   WHERE ro.tenant_id = $1 AND ro.deleted_at IS NULL AND ro.status IN ('reported', 'verified') \
     AND NOT ro.is_dummy AND NOT COALESCE(e.is_dummy, false) \
  UNION ALL \
  SELECT 'procedure', po.id, po.patient_id, po.encounter_id, \
         COALESCE(pc.department_id, e.department_id), pc.code, pc.name, pc.base_price, \
         COALESCE(po.completed_at, po.updated_at), NULL::uuid, po.procedure_id \
    FROM procedure_orders po \
    JOIN procedure_catalog pc ON pc.id = po.procedure_id AND pc.tenant_id = po.tenant_id \
    LEFT JOIN encounters e ON e.id = po.encounter_id AND e.tenant_id = po.tenant_id \
   WHERE po.tenant_id = $1 AND po.deleted_at IS NULL AND po.status = 'completed' \
     AND NOT COALESCE(e.is_dummy, false) \
), due AS ( \
  SELECT d.*, COALESCE(payer.price, d.catalog_price, cm.base_price) AS unit_price \
    FROM done d \
    LEFT JOIN charge_master cm ON cm.tenant_id = $1 AND cm.code = d.charge_code \
         AND cm.is_active AND cm.deleted_at IS NULL \
    LEFT JOIN LATERAL ( \
      SELECT rpi.override_price AS price \
        FROM patient_insurance pi \
        JOIN tpa_rate_cards rc ON rc.tenant_id = pi.tenant_id \
             AND rc.insurance_provider = pi.insurance_provider \
             AND (pi.tpa_name IS NULL OR rc.tpa_name = pi.tpa_name) \
             AND rc.is_active AND rc.deleted_at IS NULL \
             AND (rc.valid_from IS NULL OR rc.valid_from <= d.service_at::date) \
             AND (rc.valid_to IS NULL OR rc.valid_to >= d.service_at::date) \
        JOIN rate_plans rp ON rp.id = rc.rate_plan_id AND rp.tenant_id = rc.tenant_id \
             AND rp.is_active AND rp.deleted_at IS NULL \
        JOIN rate_plan_items rpi ON rpi.rate_plan_id = rp.id AND rpi.tenant_id = rp.tenant_id \
             AND rpi.charge_code = d.charge_code AND rpi.deleted_at IS NULL \
       WHERE pi.tenant_id = $1 AND pi.patient_id = d.patient_id AND pi.is_active \
         AND pi.deleted_at IS NULL \
         AND d.service_at::date BETWEEN pi.valid_from AND pi.valid_until \
       ORDER BY pi.priority LIMIT 1) payer ON true \
   WHERE d.service_at < now() - make_interval(hours => $2) \
     AND d.service_at >= now() - make_interval(days => $3) \
     AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.tenant_id = $1 \
           AND ii.source = d.module::charge_source AND ii.source_id = d.order_id) \
     AND NOT EXISTS (SELECT 1 FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
          WHERE ii.tenant_id = $1 AND i.encounter_id = d.encounter_id \
            AND ii.charge_code = d.charge_code AND ii.source_id IS NULL \
            AND ii.deleted_at IS NULL AND i.deleted_at IS NULL AND i.status <> 'cancelled') \
     AND NOT EXISTS (SELECT 1 FROM charge_attention_items a WHERE a.tenant_id = $1 \
           AND a.source_module = d.module AND a.source_entity_id = d.order_id \
           AND a.deleted_at IS NULL) \
     AND NOT EXISTS (SELECT 1 FROM patient_package_subscriptions s \
           JOIN doctor_package_inclusions inc ON inc.package_id = s.package_id \
                AND inc.tenant_id = s.tenant_id AND inc.deleted_at IS NULL \
          WHERE s.tenant_id = $1 AND s.patient_id = d.patient_id AND s.status = 'active' \
            AND s.deleted_at IS NULL AND d.service_at BETWEEN s.purchased_at AND s.valid_until \
            AND (inc.test_id = d.test_id OR inc.procedure_id = d.procedure_id)) \
     AND NOT EXISTS (SELECT 1 FROM invoices i \
           JOIN invoice_items ii ON ii.invoice_id = i.id AND ii.tenant_id = i.tenant_id \
                AND ii.deleted_at IS NULL \
           JOIN billing_packages bp ON bp.tenant_id = i.tenant_id AND bp.code = ii.charge_code \
                AND bp.deleted_at IS NULL \
           JOIN billing_package_items bpi ON bpi.package_id = bp.id \
                AND bpi.tenant_id = bp.tenant_id AND bpi.charge_code = d.charge_code \
                AND bpi.deleted_at IS NULL \
          WHERE i.tenant_id = $1 AND i.encounter_id = d.encounter_id \
            AND i.deleted_at IS NULL AND i.status <> 'cancelled') \
), picked AS ( \
  SELECT * FROM due WHERE unit_price IS DISTINCT FROM 0 ORDER BY service_at, order_id LIMIT $4 \
) \
INSERT INTO charge_attention_items \
  (tenant_id, source_module, setting_module, source_entity_id, patient_id, encounter_id, \
   department_id, service_at, charge_code, quantity, description_override, \
   unit_price_override, apply_concessions, reason, created_by) \
SELECT $1, module, module, order_id, patient_id, encounter_id, department_id, service_at, \
       charge_code, 1, description, unit_price, false, 'unbilled_order', $5 \
  FROM picked \
ON CONFLICT (tenant_id, source_module, source_entity_id) \
  WHERE status = 'open' AND deleted_at IS NULL DO NOTHING";

/// Queue every done-but-unbilled order of the transaction's hospital, in
/// batches of [`BATCH`], one statement each. Returns how many were queued.
///
/// Re-running adds nothing: an order on the queue in any status is skipped,
/// and the open-row unique index answers a concurrent run.
pub async fn queue_unbilled_orders(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    run_by: Option<Uuid>,
) -> Result<u64, AppError> {
    let mut queued = 0;
    for _ in 0..MAX_BATCHES {
        let written = sqlx::query(QUEUE_BATCH)
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

/// What one run of the check found.
#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub queued: u64,
}

/// Run the check in one unit of work for `actor`'s hospital and audit the
/// run: who (or the system), and how many it queued.
pub async fn run_for(pool: &PgPool, actor: Actor) -> Result<u64, AppError> {
    let run_by = (!actor.user_id.is_nil()).then_some(actor.user_id);
    let mut tx = medbrains_kernel::begin(pool, actor).await?;
    let queued = queue_unbilled_orders(&mut tx, actor.tenant_id, run_by).await?;
    let detail = serde_json::json!({ "queued": queued });
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: actor.tenant_id,
            user_id: run_by,
            action: "billing.leakage.scan",
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
        match run_for(pool, Actor::system(tenant_id)).await {
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
    let queued = run_for(&state.db, Actor::from_claims(&claims)).await?;
    Ok(Json(ScanResult { queued }))
}
