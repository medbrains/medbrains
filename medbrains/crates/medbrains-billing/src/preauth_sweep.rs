//! The pre-auth used-up sweep (revenue integrity RFC wave 1.3).
//!
//! The invoice trigger (migration 1423) raises a `preauth_used_up` row the
//! moment a bill reaches the hospital's threshold of the approval, but it
//! must never fail a bill, so when it cannot run it only records the failure.
//! This sweep is the durable signal behind it: every hour, for each hospital,
//! it re-runs the same check (`preauth_usage_raise`) for insured visits still
//! in hospital, a bounded page at a time from where the last pass stopped,
//! and reports the trigger failures on the visits it re-checked. It also
//! catches the visit whose pre-auth expires with no bill change
//! (`preauth_missing_or_expired`). A visit whose check fails here too gets a
//! `preauth_approval_unknown` row, so the desk sees "could not check", never
//! silence. A patient who has left takes their admission's open "no usable
//! pre-auth" and room rows with them, and one no longer insured their "no
//! usable pre-auth" row: the pass closes those as the system, which also
//! keeps the desk's open room rows to patients still in a bed.
//! Trigger failures no pass has stamped within an hour of being recorded
//! (a bill with no visit, or a visit no longer in hospital) are counted and
//! warned about, so they are never silent either.

use std::collections::HashMap;

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;

/// Visits re-checked per hospital per pass, in visit-id order from where the
/// hospital's last pass stopped, so a larger hospital is covered over
/// successive passes.
pub const VISITS_PER_PASS: i64 = 2000;
/// A trigger failure still unswept this long after it was recorded has
/// outlived a pass (the sweep runs hourly) and is warned about.
const STALE_FAILURE_MINUTES: i32 = 60;

/// What one hospital's pass found.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct SweepReport {
    /// Insured open visits re-checked.
    pub checked: u64,
    /// Visits at or past the threshold (a row raised or refreshed).
    pub used_up: u64,
    /// Insured visits with no usable pre-auth (expired, unlinked, none).
    pub missing: u64,
    /// Visits whose approval, or whose check, could not be read.
    pub unknown: u64,
    /// Trigger failures on the visits re-checked, now stamped as swept.
    pub trigger_failures: u64,
    /// Trigger failures older than a pass that no pass could stamp.
    pub stale_trigger_failures: u64,
    /// Open admission rows ("no usable pre-auth", room) closed because the
    /// patient is no longer admitted, or no longer insured.
    pub closed_stale: u64,
    /// The last visit checked when the page was full: where the next pass
    /// starts. `None` once the hospital's visits are all covered.
    #[serde(skip)]
    pub next_after: Option<Uuid>,
}

#[derive(sqlx::FromRow)]
#[allow(clippy::struct_field_names)]
struct Visit {
    admission_id: Uuid,
    encounter_id: Uuid,
    patient_id: Uuid,
    /// The usable pre-auth, if the visit has one.
    prior_auth_id: Option<Uuid>,
}

/// Insured visits still in hospital, after visit `after`: an admitted or
/// transferred (not discharged) admission with an approved, unexpired pre-auth, or whose
/// patient has a policy in force (so a missing or expired pre-auth is seen).
async fn open_visits(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    (after, page_size): (Option<Uuid>, i64),
) -> Result<Vec<Visit>, AppError> {
    Ok(sqlx::query_as::<_, Visit>(
        "SELECT * FROM ( \
           SELECT DISTINCT ON (a.encounter_id) a.id AS admission_id, a.encounter_id, \
                  a.patient_id, \
                  (SELECT p.id FROM prior_auth_requests p \
                    WHERE p.tenant_id = a.tenant_id AND p.encounter_id = a.encounter_id \
                      AND p.deleted_at IS NULL \
                      AND p.status IN ('approved', 'partially_approved') \
                      AND (p.expires_at IS NULL OR p.expires_at > now()) \
                    ORDER BY p.responded_at DESC NULLS LAST, p.created_at DESC LIMIT 1) \
                    AS prior_auth_id \
             FROM admissions a \
            WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
              AND a.status IN ('admitted', 'transferred') \
              AND ($3::uuid IS NULL OR a.encounter_id > $3) \
            ORDER BY a.encounter_id, a.created_at DESC) v \
          WHERE v.prior_auth_id IS NOT NULL OR EXISTS ( \
                SELECT 1 FROM patient_insurance pi \
                 WHERE pi.tenant_id = $1 AND pi.patient_id = v.patient_id \
                   AND pi.deleted_at IS NULL AND pi.is_active \
                   AND current_date BETWEEN pi.valid_from AND pi.valid_until) \
          ORDER BY v.encounter_id LIMIT $2",
    )
    .bind(tenant_id)
    .bind(page_size)
    .bind(after)
    .fetch_all(conn)
    .await?)
}

/// What one visit's check found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Found {
    Fine,
    UsedUp,
    Missing,
    Unknown,
}

/// The visit's check in a savepoint; on failure, a "could not check" row.
async fn check_visit(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    v: &Visit,
) -> Result<Found, AppError> {
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
                "preauth_used_up" => Found::UsedUp,
                "preauth_missing_or_expired" => Found::Missing,
                "preauth_approval_unknown" => Found::Unknown,
                _ => Found::Fine,
            })
        }
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, encounter_id = %v.encounter_id, "pre-auth sweep check failed");
            unknown_row(tx, tenant_id, v).await?;
            Ok(Found::Unknown)
        }
    }
}

/// Raise (or keep) the visit's open row as `preauth_approval_unknown`: on
/// the pre-auth when the visit has one, else on the admission (the row a
/// missing pre-auth would have raised).
async fn unknown_row(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    v: &Visit,
) -> Result<(), AppError> {
    let (source, subject) = v
        .prior_auth_id
        .map_or(("admission_preauth", v.admission_id), |pa| {
            ("prior_auth", pa)
        });
    sqlx::query(
        "INSERT INTO charge_attention_items \
           (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id, \
            reason, evidence, service_at) \
         VALUES ($1, 'preauth_used_up', $5, $2, $3, $4, 'preauth_approval_unknown', \
                 '{\"approved_amount\": null, \"check_failed\": true}', now()) \
         ON CONFLICT (tenant_id, source_module, source_entity_id) \
           WHERE status = 'open' AND deleted_at IS NULL \
         DO UPDATE SET reason = 'preauth_approval_unknown', updated_at = now()",
    )
    .bind(tenant_id)
    .bind(subject)
    .bind(v.patient_id)
    .bind(v.encounter_id)
    .bind(source)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Close, as the system, up to `limit` open admission rows whose fact
/// stopped being true: "no usable pre-auth" and room rows of a patient no
/// longer admitted (`discharged`), and "no usable pre-auth" rows of a
/// patient with no policy in force any more (`not_insured`), whom the
/// trigger and the visit page no longer reach.
async fn close_stale(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    limit: i64,
) -> Result<u64, AppError> {
    let done = sqlx::query(
        "WITH stale AS ( \
           SELECT o.id, CASE WHEN a.status IN ('admitted', 'transferred') \
                              AND a.deleted_at IS NULL \
                             THEN 'not_insured' ELSE 'discharged' END AS why \
             FROM charge_attention_items o \
             JOIN admissions a ON a.id = o.source_entity_id AND a.tenant_id = o.tenant_id \
            WHERE o.tenant_id = $1 AND o.status = 'open' AND o.deleted_at IS NULL \
              AND o.source_module IN ('admission_preauth', 'admission_room') \
              AND (a.status NOT IN ('admitted', 'transferred') OR a.deleted_at IS NOT NULL \
                   OR (o.source_module = 'admission_preauth' AND NOT EXISTS ( \
                       SELECT 1 FROM patient_insurance pi \
                        WHERE pi.tenant_id = o.tenant_id AND pi.patient_id = o.patient_id \
                          AND pi.deleted_at IS NULL AND pi.is_active \
                          AND current_date BETWEEN pi.valid_from AND pi.valid_until))) \
            ORDER BY o.created_at LIMIT $2) \
         UPDATE charge_attention_items c SET status = 'actioned', resolved_at = now(), \
                evidence = COALESCE(c.evidence, '{}'::jsonb) \
                           || jsonb_build_object('resolution', stale.why), \
                updated_at = now() \
           FROM stale WHERE c.id = stale.id",
    )
    .bind(tenant_id)
    .bind(limit)
    .execute(&mut **tx)
    .await?;
    Ok(done.rows_affected())
}

/// Trigger failures recorded more than a pass ago and still unswept.
async fn stale_failures(tx: &mut medbrains_kernel::Tx, tenant_id: Uuid) -> Result<u64, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM preauth_check_failures \
          WHERE tenant_id = $1 AND swept_at IS NULL AND deleted_at IS NULL \
            AND created_at < now() - make_interval(mins => $2)",
    )
    .bind(tenant_id)
    .bind(STALE_FAILURE_MINUTES)
    .fetch_one(&mut **tx)
    .await?;
    Ok(u64::try_from(n).unwrap_or_default())
}

/// One hospital's pass over up to `page_size` visits after `after` (`None`:
/// the first; [`VISITS_PER_PASS`] in service).
///
/// One unit of work for the system actor, audited. Only the trigger failures
/// on the bills of the visits it re-checked are stamped.
pub async fn sweep_for(
    pool: &PgPool,
    tenant_id: Uuid,
    (after, page_size): (Option<Uuid>, i64),
) -> Result<SweepReport, AppError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let mut report = SweepReport {
        closed_stale: close_stale(&mut tx, tenant_id, page_size).await?,
        ..SweepReport::default()
    };
    let visits = open_visits(&mut tx, tenant_id, (after, page_size)).await?;
    for v in &visits {
        report.checked += 1;
        match check_visit(&mut tx, tenant_id, v).await? {
            Found::UsedUp => report.used_up += 1,
            Found::Missing => report.missing += 1,
            Found::Unknown => report.unknown += 1,
            Found::Fine => {}
        }
    }
    let page_full = i64::try_from(visits.len()).is_ok_and(|n| n >= page_size);
    report.next_after = visits.last().filter(|_| page_full).map(|v| v.encounter_id);
    let checked: Vec<Uuid> = visits.iter().map(|v| v.encounter_id).collect();
    let failures = sqlx::query(
        "UPDATE preauth_check_failures f SET swept_at = now() \
           FROM invoices i \
          WHERE f.tenant_id = $1 AND f.swept_at IS NULL AND f.deleted_at IS NULL \
            AND i.id = f.invoice_id AND i.tenant_id = f.tenant_id \
            AND i.encounter_id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&checked)
    .execute(&mut *tx)
    .await?;
    report.trigger_failures = failures.rows_affected();
    report.stale_trigger_failures = stale_failures(&mut tx, tenant_id).await?;
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

/// Every active hospital, one unit of work each, each from where its last
/// pass stopped (`cursors`, kept by the caller between passes).
///
/// A hospital that fails is logged and the rest still run. Trigger failures are logged as a warning,
/// since each one is a check that did not run when the bill changed.
pub async fn sweep_all(
    pool: &PgPool,
    cursors: &mut HashMap<Uuid, Uuid>,
) -> Result<SweepReport, AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE is_active AND deleted_at IS NULL ORDER BY id LIMIT 10000",
    )
    .fetch_all(pool)
    .await?;
    let mut total = SweepReport::default();
    for tenant_id in tenants {
        let after = cursors.get(&tenant_id).copied();
        match sweep_for(pool, tenant_id, (after, VISITS_PER_PASS)).await {
            Ok(r) => {
                match r.next_after {
                    Some(next) => cursors.insert(tenant_id, next),
                    None => cursors.remove(&tenant_id),
                };
                if r.trigger_failures > 0 {
                    tracing::warn!(%tenant_id, failures = r.trigger_failures, "pre-auth trigger failures swept");
                }
                if r.stale_trigger_failures > 0 {
                    tracing::warn!(
                        %tenant_id,
                        failures = r.stale_trigger_failures,
                        "pre-auth trigger failures older than a pass, not swept"
                    );
                }
                total.checked += r.checked;
                total.used_up += r.used_up;
                total.missing += r.missing;
                total.unknown += r.unknown;
                total.trigger_failures += r.trigger_failures;
                total.stale_trigger_failures += r.stale_trigger_failures;
                total.closed_stale += r.closed_stale;
            }
            Err(error) => tracing::error!(%error, %tenant_id, "pre-auth sweep failed"),
        }
    }
    Ok(total)
}
