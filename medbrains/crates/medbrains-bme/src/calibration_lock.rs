//! Out-of-calibration equipment is locked out of patient use.
//!
//! NABH FMS and NABL (ISO 15189 §5.3) require that equipment past its
//! calibration date, or found out of tolerance, is withdrawn from service
//! until it is recalibrated. "Why this calibration locks" is defined once, in
//! SQL — `bme_calibration_lock_reason(c)` (migration 1066) — and used here, by
//! the hourly sweep and by the analyser ingest that refuses results from a
//! locked instrument.
//!
//! A lock is lifted only by recording a passing calibration (status
//! calibrated, in tolerance, next due date in the future). There is no
//! override: an analyser past calibration must not produce patient results.
//! Returning the equipment to `active` is a deliberate step on the equipment
//! register, not a side effect of unlocking.

use medbrains_core::bme::BmeCalibration;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// Most rows one pass locks; the next pass picks up the rest.
const SWEEP_BATCH: i64 = 500;

#[derive(Debug, sqlx::FromRow)]
struct LockedCalibration {
    id: Uuid,
    tenant_id: Uuid,
    equipment_id: Uuid,
    locked_reason: Option<String>,
}

/// Lock every calibration that is overdue or out of tolerance and not yet
/// locked — one row (`only`, after a write) or the whole table (the sweep) —
/// and take its equipment out of service. Each lock is audited; `actor` is
/// `None` when the system did it. Returns the ids it locked.
pub async fn lock_out_of_calibration(
    tx: &mut Transaction<'_, Postgres>,
    only: Option<Uuid>,
    actor: Option<Uuid>,
) -> Result<Vec<Uuid>, AppError> {
    let rows = sqlx::query_as::<_, LockedCalibration>(
        "WITH target AS ( \
             SELECT c.id FROM bme_calibrations c \
              WHERE NOT c.is_locked AND c.deleted_at IS NULL \
                AND bme_calibration_lock_reason(c) IS NOT NULL \
                AND ($1::uuid IS NULL OR c.id = $1) \
              LIMIT $2 \
         ), locked AS ( \
             UPDATE bme_calibrations c SET \
                 is_locked = true, locked_at = now(), \
                 locked_reason = bme_calibration_lock_reason(c), \
                 calibration_status = CASE \
                     WHEN c.calibration_status IN ('calibrated', 'due') \
                      AND c.next_due_date < CURRENT_DATE \
                     THEN 'overdue'::bme_calibration_status \
                     ELSE c.calibration_status END \
               FROM target t WHERE c.id = t.id \
             RETURNING c.id, c.tenant_id, c.equipment_id, c.locked_reason \
         ), out_of_service AS ( \
             UPDATE bme_equipment e SET status = 'out_of_service'::bme_equipment_status \
               FROM locked l \
              WHERE e.id = l.equipment_id AND e.tenant_id = l.tenant_id \
                AND e.status = 'active' \
             RETURNING e.id \
         ) \
         SELECT id, tenant_id, equipment_id, locked_reason FROM locked",
    )
    .bind(only)
    .bind(SWEEP_BATCH)
    .fetch_all(&mut **tx)
    .await?;

    for row in &rows {
        let values = serde_json::json!({
            "equipment_id": row.equipment_id,
            "reason": row.locked_reason,
        });
        AuditLogger::log(
            tx,
            &AuditEntry {
                tenant_id: row.tenant_id,
                user_id: actor,
                action: "bme.calibration.locked",
                entity_type: "bme_calibrations",
                entity_id: Some(row.id),
                old_values: None,
                new_values: Some(&values),
                ip_address: None,
            },
        )
        .await?;
    }
    Ok(rows.into_iter().map(|r| r.id).collect())
}

/// Take a manually locked calibration's equipment out of service too.
pub async fn take_out_of_service(
    tx: &mut Transaction<'_, Postgres>,
    equipment_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE bme_equipment SET status = 'out_of_service'::bme_equipment_status \
          WHERE id = $1 AND status = 'active'",
    )
    .bind(equipment_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Audit a lock someone set by hand, or a lock lifted by a passing
/// calibration (`action` names which).
pub async fn audit_lock_change(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    row: &BmeCalibration,
    action: &str,
) -> Result<(), AppError> {
    let values = serde_json::json!({
        "equipment_id": row.equipment_id,
        "reason": row.locked_reason,
        "calibration_status": row.calibration_status,
        "next_due_date": row.next_due_date,
    });
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "bme_calibrations",
            entity_id: Some(row.id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// One pass of the system sweep: lock what has fallen overdue since the last
/// pass. Runs on a pool that bypasses RLS, across tenants.
pub async fn sweep(pool: &PgPool) -> Result<usize, AppError> {
    let mut tx = pool.begin().await?;
    let locked = lock_out_of_calibration(&mut tx, None, None).await?;
    tx.commit().await?;
    Ok(locked.len())
}
