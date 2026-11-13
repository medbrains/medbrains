//! The two timers behind file requests.
//!
//! * **Escalation**, every minute: a request past its due time, or a file a
//!   runner could not find, is told to everyone holding
//!   `mrd.file_request.supervise` as an in-app notification (the
//!   notification listener pushes it live). There is no outbox handler for a
//!   late file, so nothing is queued there: an outbox row with no handler
//!   ends `undelivered`, and a notification row is the delivery. A request is
//!   marked escalated only when somebody was told; with no supervisor it stays
//!   unescalated, is retried, and the queue still shows it late. Each hospital
//!   gets at most [`PER_TENANT_LIMIT`] of a pass, so one hospital with nobody to
//!   tell cannot fill every pass and starve the rest.
//! * **Day end**, every fifteen minutes, after a request's visit day (hospital
//!   clock): a request never picked up is closed as `cancelled` / `day_ended`
//!   once its visit is over (completed or cancelled, or a pull-list row that
//!   never got one), so yesterday's errands never crowd today's queue while an
//!   evening clinic past midnight keeps its file. A picked-up file is never
//!   closed by the job: its runner still holds it, so the supervisor is told
//!   once that it is out overnight, and a person returns it.
//! * **Pull list**, every fifteen minutes from 18:00 on the hospital's clock:
//!   tomorrow's appointments become pre-pulled requests. Idempotent, so later
//!   bookings join on the next run.
//!
//! The worker pool reads across hospitals; each change runs in its own
//! hospital's unit of work as the system actor, so one bad row never stops
//! the rest.

use std::time::Duration;

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_kernel::Actor;
use medbrains_notifications::NewNotification;
use medbrains_notifications::notify_permission_holders;
use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// One pass a minute: the default due time is ten minutes.
const PASS_INTERVAL_SECS: u64 = 60;
/// The pull list is built on every fifteenth pass.
const PULL_EVERY_PASSES: u64 = 15;
/// The hour (hospital clock) from which tomorrow's pull list is built: after
/// the day's bookings mostly close, early enough to pull files that evening.
// ponytail: fixed hour; a tenant setting when a hospital asks for another.
const PULL_LIST_FROM_HOUR: i32 = 18;
/// Requests escalated per pass, across every hospital.
const PASS_LIMIT: i64 = 200;
/// Requests escalated per pass for any one hospital.
pub const PER_TENANT_LIMIT: i64 = 20;
/// Hospitals given a pull list per pass.
const TENANT_LIMIT: i64 = 1000;

/// Run both timers forever on the worker pool.
/// Runs on `spawn_forever`: the loop cannot return and stop the pass unseen.
pub fn spawn(pool: PgPool) {
    medbrains_server_core::background::spawn_forever(module_path!(), async move {
        let mut pass: u64 = 0;
        loop {
            match escalate_late(&pool).await {
                Ok(n) if n > 0 => tracing::warn!(n, "MRD file requests escalated"),
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "MRD file escalation pass failed"),
            }
            if pass.is_multiple_of(PULL_EVERY_PASSES) {
                match close_ended_days(&pool).await {
                    Ok(n) if n > 0 => tracing::info!(n, "MRD file requests closed at day end"),
                    Ok(_) => {}
                    Err(error) => tracing::error!(%error, "MRD day-end close failed"),
                }
                match build_tomorrows_pull_lists(&pool).await {
                    Ok(n) if n > 0 => tracing::info!(n, "MRD pull list requests written"),
                    Ok(_) => {}
                    Err(error) => tracing::error!(%error, "MRD pull list pass failed"),
                }
            }
            pass = pass.wrapping_add(1);
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// Escalate every late or not-found request not yet escalated. Returns how
/// many were told to someone.
pub async fn escalate_late(pool: &PgPool) -> Result<u64, AppError> {
    let due: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, tenant_id FROM ( \
           SELECT id, tenant_id, due_at, \
                  row_number() OVER (PARTITION BY tenant_id ORDER BY due_at) AS nth \
             FROM mrd_file_requests \
            WHERE deleted_at IS NULL AND escalated_at IS NULL \
              AND (status = 'not_found' \
                   OR (status IN ('requested', 'picked') AND due_at < now()))) late \
          WHERE nth <= $2 \
          ORDER BY due_at LIMIT $1",
    )
    .bind(PASS_LIMIT)
    .bind(PER_TENANT_LIMIT)
    .fetch_all(pool)
    .await?;
    let mut told = 0u64;
    for (id, tenant_id) in due {
        match escalate_one(pool, tenant_id, id).await {
            Ok(true) => told += 1,
            Ok(false) => {}
            Err(error) => tracing::error!(request_id = %id, %error, "MRD file escalation failed"),
        }
    }
    Ok(told)
}

/// The request as the supervisor is told about it.
#[derive(sqlx::FromRow)]
struct Claimed {
    status: String,
    record_number: String,
    destination: Option<String>,
    due_at: DateTime<Utc>,
}

/// What the supervisor reads. The record number and the clinic, never the
/// patient's name: a notification is seen on a lock screen.
fn message(c: &Claimed, now: DateTime<Utc>) -> (&'static str, String) {
    let to = c.destination.as_deref().unwrap_or("the clinic");
    if c.status == "not_found" {
        return (
            "File not found",
            format!(
                "File {} for {to} is not on its shelf. Find it or tell the clinic.",
                c.record_number
            ),
        );
    }
    let late = (now - c.due_at).num_minutes().max(0);
    (
        "File request late",
        format!(
            "File {} for {to} is {late} min past its due time.",
            c.record_number
        ),
    )
}

/// Claim one request and tell the supervisors, together. Rolled back (left
/// unescalated, retried next pass) when nobody holds the permission.
async fn escalate_one(pool: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<bool, AppError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let claimed: Option<Claimed> = sqlx::query_as(
        "UPDATE mrd_file_requests f SET escalated_at = now() \
           FROM mrd_medical_records r \
          WHERE f.id = $1 AND f.tenant_id = $2 AND r.id = f.medical_record_id \
            AND f.escalated_at IS NULL AND f.deleted_at IS NULL \
            AND (f.status = 'not_found' OR (f.status IN ('requested', 'picked') AND f.due_at < now())) \
         RETURNING f.status, r.record_number, \
                   NULLIF(concat_ws(', ', \
                       (SELECT u.full_name FROM users u WHERE u.id = f.doctor_id), \
                       (SELECT d.name FROM departments d WHERE d.id = f.department_id)), '') \
                     AS destination, f.due_at",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(claimed) = claimed else {
        return Ok(false);
    };
    let (title, body) = message(&claimed, Utc::now());
    let mut savepoint = sqlx::Acquire::begin(&mut *tx).await?;
    let told = notify_permission_holders(
        &mut savepoint,
        tenant_id,
        permissions::mrd::file_request::SUPERVISE,
        Uuid::nil(),
        |user_id| NewNotification {
            user_id,
            kind: "warning",
            title,
            body: Some(&body),
            category: Some("Medical Records"),
            entity_type: Some("mrd_file_requests"),
            entity_id: Some(id),
            action_url: Some("/mrd#file-requests"),
        },
    )
    .await?;
    if told == 0 {
        tracing::warn!(request_id = %id, "MRD file request late, but nobody supervises files");
        return Ok(false);
    }
    savepoint.commit().await?;
    tx.commit().await?;
    Ok(true)
}

/// The day-end pass, hospital by hospital on each one's clock: close what
/// can be closed, flag what is out overnight. Returns how many it closed.
pub async fn close_ended_days(pool: &PgPool) -> Result<u64, AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT tenant_id FROM mrd_file_requests \
          WHERE deleted_at IS NULL AND status IN ('requested', 'picked', 'not_found') \
            AND visit_date <= CURRENT_DATE \
          LIMIT $1",
    )
    .bind(TENANT_LIMIT)
    .fetch_all(pool)
    .await?;
    let mut closed = 0u64;
    for tenant_id in tenants {
        match close_ended_day(pool, tenant_id).await {
            Ok(n) => closed += n,
            Err(error) => tracing::error!(%tenant_id, %error, "MRD day-end close failed"),
        }
        if let Err(error) = flag_out_overnight(pool, tenant_id).await {
            tracing::error!(%tenant_id, %error, "MRD overnight flag failed");
        }
    }
    Ok(closed)
}

/// One hospital's day-end close: requests from an earlier day that were
/// never picked up and whose visit is over (or that never had a visit).
async fn close_ended_day(pool: &PgPool, tenant_id: Uuid) -> Result<u64, AppError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let done = sqlx::query(
        "UPDATE mrd_file_requests f SET status = 'cancelled', closed_reason = 'day_ended' \
          WHERE f.tenant_id = $1 AND f.deleted_at IS NULL \
            AND f.status IN ('requested', 'not_found') \
            AND f.visit_date < CURRENT_DATE \
            AND NOT EXISTS (SELECT 1 FROM encounters e \
                             WHERE e.id = f.encounter_id AND e.tenant_id = f.tenant_id \
                               AND e.status NOT IN ('completed', 'cancelled'))",
    )
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(done.rows_affected())
}

/// A picked file still out after its visit day, as the supervisor is told.
#[derive(sqlx::FromRow)]
struct OutOvernight {
    id: Uuid,
    record_number: String,
    runner: Option<String>,
}

/// Tell the supervisors, once per file, that a picked-up file was neither
/// delivered nor returned by the end of its day (and its visit is over, so an
/// evening clinic past midnight is not flagged). Rolled back (retried next
/// pass) when nobody holds the permission. Returns how many were flagged.
async fn flag_out_overnight(pool: &PgPool, tenant_id: Uuid) -> Result<usize, AppError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let rows: Vec<OutOvernight> = sqlx::query_as(
        "UPDATE mrd_file_requests f SET overnight_flagged_at = now() \
           FROM mrd_medical_records r \
          WHERE f.tenant_id = $1 AND r.id = f.medical_record_id AND f.deleted_at IS NULL \
            AND f.status = 'picked' AND f.visit_date < CURRENT_DATE \
            AND f.overnight_flagged_at IS NULL \
            AND NOT EXISTS (SELECT 1 FROM encounters e \
                             WHERE e.id = f.encounter_id AND e.tenant_id = f.tenant_id \
                               AND e.status NOT IN ('completed', 'cancelled')) \
         RETURNING f.id, r.record_number, \
                   (SELECT u.full_name FROM users u WHERE u.id = f.picked_by) AS runner",
    )
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    if rows.is_empty() {
        return Ok(0);
    }
    let mut savepoint = sqlx::Acquire::begin(&mut *tx).await?;
    for row in &rows {
        let body = overnight_message(row);
        let told = notify_permission_holders(
            &mut savepoint,
            tenant_id,
            permissions::mrd::file_request::SUPERVISE,
            Uuid::nil(),
            |user_id| NewNotification {
                user_id,
                kind: "warning",
                title: "File out overnight",
                body: Some(&body),
                category: Some("Medical Records"),
                entity_type: Some("mrd_file_requests"),
                entity_id: Some(row.id),
                action_url: Some("/mrd#file-requests"),
            },
        )
        .await?;
        if told == 0 {
            tracing::warn!(%tenant_id, "MRD file out overnight, but nobody supervises files");
            return Ok(0);
        }
    }
    savepoint.commit().await?;
    tx.commit().await?;
    Ok(rows.len())
}

/// The overnight message: the file and who has it, never the patient.
fn overnight_message(row: &OutOvernight) -> String {
    format!(
        "File {} was picked up by {} and neither delivered nor returned. Return it to its shelf.",
        row.record_number,
        row.runner.as_deref().unwrap_or("a runner")
    )
}

/// Build tomorrow's pull list for every hospital whose clock is past
/// [`PULL_LIST_FROM_HOUR`]. Returns how many requests it wrote.
pub async fn build_tomorrows_pull_lists(pool: &PgPool) -> Result<u64, AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT tenant_id FROM appointments \
          WHERE appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2 \
            AND status IN ('scheduled', 'confirmed') AND deleted_at IS NULL \
            AND encounter_id IS NULL \
          LIMIT $1",
    )
    .bind(TENANT_LIMIT)
    .fetch_all(pool)
    .await?;
    let mut written = 0u64;
    for tenant_id in tenants {
        match pull_for(pool, tenant_id).await {
            Ok(n) => written += n,
            Err(error) => tracing::error!(%tenant_id, %error, "MRD pull list failed"),
        }
    }
    Ok(written)
}

/// One hospital's pull list for tomorrow, if its evening has begun.
async fn pull_for(pool: &PgPool, tenant_id: Uuid) -> Result<u64, AppError> {
    let mut tx = medbrains_kernel::begin(pool, Actor::system(tenant_id)).await?;
    let (evening, tomorrow): (bool, NaiveDate) =
        sqlx::query_as("SELECT EXTRACT(HOUR FROM localtime)::int >= $1, CURRENT_DATE + 1")
            .bind(PULL_LIST_FROM_HOUR)
            .fetch_one(&mut *tx)
            .await?;
    if !evening {
        return Ok(0);
    }
    let written = super::pull_list::generate(&mut tx, tenant_id, tomorrow, None).await?;
    tx.commit().await?;
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::{Claimed, message};
    use chrono::{Duration, Utc};

    #[test]
    fn the_supervisor_is_told_the_file_and_clinic_never_the_patient() {
        let now = Utc::now();
        let late = Claimed {
            status: "requested".to_owned(),
            record_number: "MRD-7".to_owned(),
            destination: Some("Dr Rao, Cardiology".to_owned()),
            due_at: now - Duration::minutes(12),
        };
        let (title, body) = message(&late, now);
        assert_eq!(title, "File request late");
        assert_eq!(
            body,
            "File MRD-7 for Dr Rao, Cardiology is 12 min past its due time."
        );
        let lost = Claimed {
            status: "not_found".to_owned(),
            destination: None,
            ..late
        };
        assert!(message(&lost, now).1.contains("not on its shelf"));
    }
}
