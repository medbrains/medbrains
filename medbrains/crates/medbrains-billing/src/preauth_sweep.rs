//! The pre-auth used-up sweep (revenue integrity RFC wave 1.3).
//!
//! The invoice trigger (migration 1423) raises a `preauth_used_up` row the
//! moment a bill reaches 80% of the approval, but it must never fail a bill,
//! so when it cannot run it only records the failure. This sweep is the
//! durable signal behind it: every hour, for each hospital, it re-runs the
//! same check (`preauth_usage_raise`) for every insured visit still in
//! hospital, bounded, and reports how many trigger failures it found. A visit
//! whose check fails here too gets a `preauth_approval_unknown` row, so the
//! desk sees "could not check", never silence.

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;

/// Visits re-checked per hospital per pass; the oldest admissions first.
// ponytail: a hospital with more than this many insured inpatients is
// covered over successive passes only if the order rotates; page by id then.
const VISITS_PER_PASS: i64 = 2000;

/// What one hospital's pass found.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct SweepReport {
    /// Insured open visits re-checked.
    pub checked: u64,
    /// Visits at or past 80% (a row raised or refreshed).
    pub used_up: u64,
    /// Visits whose approval, or whose check, could not be read.
    pub unknown: u64,
    /// Trigger failures recorded since the last pass, now stamped as swept.
    pub trigger_failures: u64,
}

#[derive(sqlx::FromRow)]
#[allow(clippy::struct_field_names)]
struct Visit {
    encounter_id: Uuid,
    patient_id: Uuid,
    prior_auth_id: Uuid,
}

/// Insured visits still in hospital: an approved, unexpired pre-auth on an
/// admitted (not discharged) admission.
async fn open_visits(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
) -> Result<Vec<Visit>, AppError> {
    Ok(sqlx::query_as::<_, Visit>(
        "SELECT DISTINCT ON (a.encounter_id) a.encounter_id, a.patient_id, p.id AS prior_auth_id \
           FROM admissions a \
           JOIN prior_auth_requests p ON p.tenant_id = a.tenant_id \
            AND p.encounter_id = a.encounter_id AND p.deleted_at IS NULL \
            AND p.status IN ('approved', 'partially_approved') \
            AND (p.expires_at IS NULL OR p.expires_at > now()) \
          WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.status = 'admitted' \
          ORDER BY a.encounter_id, p.responded_at DESC NULLS LAST \
          LIMIT $2",
    )
    .bind(tenant_id)
    .bind(VISITS_PER_PASS)
    .fetch_all(conn)
    .await?)
}

/// The visit's check in a savepoint; on failure, a "could not check" row.
async fn check_visit(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    v: &Visit,
) -> Result<&'static str, AppError> {
    let mut savepoint = sqlx::Acquire::begin(&mut **tx).await?;
    let outcome: Result<String, sqlx::Error> =
        sqlx::query_scalar("SELECT preauth_usage_raise($1, $2, $3)")
            .bind(tenant_id)
            .bind(v.encounter_id)
            .bind(v.patient_id)
            .fetch_one(&mut *savepoint)
            .await;
    match outcome {
        Ok(o) => {
            savepoint.commit().await?;
            Ok(match o.as_str() {
                "preauth_used_up" => "used_up",
                "preauth_approval_unknown" => "unknown",
                _ => "fine",
            })
        }
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, encounter_id = %v.encounter_id, "pre-auth sweep check failed");
            unknown_row(tx, tenant_id, v).await?;
            Ok("unknown")
        }
    }
}

/// Raise (or keep) the visit's open row as `preauth_approval_unknown`.
async fn unknown_row(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    v: &Visit,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO charge_attention_items \
           (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id, \
            reason, evidence, service_at) \
         VALUES ($1, 'preauth_used_up', 'prior_auth', $2, $3, $4, 'preauth_approval_unknown', \
                 '{\"approved_amount\": null, \"check_failed\": true}', now()) \
         ON CONFLICT (tenant_id, source_module, source_entity_id) \
           WHERE status = 'open' AND deleted_at IS NULL \
         DO UPDATE SET reason = 'preauth_approval_unknown', updated_at = now()",
    )
    .bind(tenant_id)
    .bind(v.prior_auth_id)
    .bind(v.patient_id)
    .bind(v.encounter_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One hospital's pass, in one unit of work for the system actor, audited.
pub async fn sweep_for(pool: &PgPool, tenant_id: Uuid) -> Result<SweepReport, AppError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let mut report = SweepReport::default();
    for v in open_visits(&mut tx, tenant_id).await? {
        report.checked += 1;
        match check_visit(&mut tx, tenant_id, &v).await? {
            "used_up" => report.used_up += 1,
            "unknown" => report.unknown += 1,
            _ => {}
        }
    }
    let failures = sqlx::query(
        "UPDATE preauth_check_failures SET swept_at = now() \
          WHERE tenant_id = $1 AND swept_at IS NULL AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;
    report.trigger_failures = failures.rows_affected();
    let detail = serde_json::to_value(report).map_err(|e| AppError::Internal(e.to_string()))?;
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id,
            user_id: None,
            action: "billing.preauth_usage.sweep",
            entity_type: "charge_attention_items",
            entity_id: None,
            old_values: None,
            new_values: Some(&detail),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(report)
}

/// Every active hospital, one unit of work each.
///
/// A hospital that fails is logged and the rest still run. Trigger failures are logged as a warning,
/// since each one is a check that did not run when the bill changed.
pub async fn sweep_all(pool: &PgPool) -> Result<SweepReport, AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE is_active AND deleted_at IS NULL ORDER BY id LIMIT 10000",
    )
    .fetch_all(pool)
    .await?;
    let mut total = SweepReport::default();
    for tenant_id in tenants {
        match sweep_for(pool, tenant_id).await {
            Ok(r) => {
                if r.trigger_failures > 0 {
                    tracing::warn!(%tenant_id, failures = r.trigger_failures, "pre-auth trigger failures swept");
                }
                total.checked += r.checked;
                total.used_up += r.used_up;
                total.unknown += r.unknown;
                total.trigger_failures += r.trigger_failures;
            }
            Err(error) => tracing::error!(%error, %tenant_id, "pre-auth sweep failed"),
        }
    }
    Ok(total)
}
