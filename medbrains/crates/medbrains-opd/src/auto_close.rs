//! Closing OPD visits the doctor never closed.
//!
//! At a small clinic the doctor sees the patient and moves on; nobody presses
//! "complete", so the visit stays open and the board stays full all day. A
//! hospital that turns this on (`tenant_settings` `opd.auto_close_after_minutes`,
//! 15 to 1440; absent or 0 is off, the default) has every started visit, the
//! visit's own queue row called or in consultation, closed once that many
//! minutes have passed since the patient was called in. A patient still waiting
//! is never touched: they have not been seen.
//!
//! The close is the doctor's close (`close_visit_in_tx`): visit, appointment,
//! consultation charge, bill, token and the `opd.consultation.completed` event.
//! Notes are not signed or changed. The visit carries
//! `close_reason = 'auto_inactivity'` and an audit row by the system.
//!
//! Every five minutes, per hospital: one bounded `UPDATE … RETURNING` under the
//! hospital's tenant context, the side effects, one commit. A row closes once:
//! the update only takes rows still open, and a failed pass rolls back whole.

use medbrains_kernel as kernel;
use std::ops::RangeInclusive;
use std::time::Duration;

use axum::extract::State;
use axum::{Extension, Json};
use kernel::audit::AuditEntry;
use medbrains_core::encounter::{OpdQueue, QueueStatus};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// The minutes a hospital may set; anything else is refused on save and read
/// as off, so a bad value never closes visits early.
pub const MINUTES_RANGE: RangeInclusive<i32> = 15..=1440;
/// Visits closed per hospital per pass. The rest wait five minutes.
pub const MAX_PER_PASS: i64 = 500;
/// What the visit's `close_reason` says when this pass closed it.
pub const CLOSE_REASON: &str = "auto_inactivity";
const PASS_INTERVAL_SECS: u64 = 300;

/// One visit the pass closed, with what is left to announce after commit.
#[derive(Debug)]
pub struct ClosedVisit {
    pub queue: OpdQueue,
    pub token: Option<medbrains_tokens::Token>,
    /// The doctor (else whoever registered the visit) the charge and the
    /// completed event are made in the name of, as when the doctor closes it.
    pub actor: Uuid,
}

/// The stored setting as minutes, or `None` (off) for absent, 0, or anything
/// outside [`MINUTES_RANGE`].
#[must_use]
pub fn minutes_from_setting(value: &serde_json::Value) -> Option<i32> {
    let minutes = i32::try_from(value.as_i64()?).ok()?;
    MINUTES_RANGE.contains(&minutes).then_some(minutes)
}

/// Run the pass every five minutes, for the life of the server.
pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        loop {
            if let Err(error) = run_pass(&state).await {
                tracing::error!(%error, "OPD auto-close pass failed");
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// One pass over every active hospital. One hospital's failure is logged and
/// the rest still run; its visits stay open until a later pass succeeds.
async fn run_pass(state: &AppState) -> Result<(), AppError> {
    let pool = &state.db;
    let tenants = sqlx::query_scalar!("SELECT id FROM tenants WHERE is_active")
        .fetch_all(pool)
        .await?;
    for tenant_id in tenants {
        match close_due_for_tenant(&state.db, tenant_id).await {
            Ok(closed) => announce(state, tenant_id, &closed).await,
            Err(error) => {
                tracing::error!(%tenant_id, %error, "OPD auto-close failed for hospital");
            }
        }
    }
    Ok(())
}

/// After commit: the board, the completed event and the screens, per visit.
async fn announce(state: &AppState, tenant_id: Uuid, closed: &[ClosedVisit]) {
    if !closed.is_empty() {
        tracing::info!(%tenant_id, closed = closed.len(), "OPD visits closed automatically");
    }
    for visit in closed {
        let announced =
            crate::announce_visit_closed(state, visit.actor, &visit.queue, visit.token.as_ref());
        if let Err(error) = announced.await {
            tracing::error!(%tenant_id, queue_id = %visit.queue.id, %error,
                "auto-closed visit not announced");
        }
    }
}

/// Close one hospital's visits that are past its setting.
///
/// Nothing when the setting is off. Under the hospital's tenant context with
/// the system as the audit actor; one transaction, so a failure closes nothing.
pub async fn close_due_for_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<ClosedVisit>, AppError> {
    let mut tx = kernel::actor_tx(pool, &tenant_id, &Uuid::nil(), None).await?;
    let Some(minutes) = read_minutes(&mut tx, tenant_id).await? else {
        return Ok(Vec::new());
    };
    let queues = claim_due(&mut tx, tenant_id, minutes).await?;
    let actors = mark_encounters(&mut tx, tenant_id, &queues).await?;
    let mut closed = Vec::with_capacity(queues.len());
    for queue in queues {
        // `claim_due` takes only rows with somebody to name.
        let actor = queue
            .doctor_id
            .or_else(|| actors.get(&queue.encounter_id).copied());
        let actor =
            actor.ok_or_else(|| AppError::Internal("auto-close row with no actor".into()))?;
        let token = crate::close_visit_in_tx(
            &mut tx,
            Actor {
                tenant_id,
                user_id: actor,
            },
            &queue,
        )
        .await?;
        audit_close(&mut tx, &queue, minutes).await?;
        closed.push(ClosedVisit {
            queue,
            token,
            actor,
        });
    }
    tx.commit().await?;
    Ok(closed)
}

/// The hospital's setting, read in the pass's transaction.
async fn read_minutes(conn: &mut PgConnection, tenant_id: Uuid) -> Result<Option<i32>, AppError> {
    let value = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'opd' AND key = 'auto_close_after_minutes' \
           AND deleted_at IS NULL",
        tenant_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(value.as_ref().and_then(minutes_from_setting))
}

/// Close the queue rows past the window, in one statement: the visit's own row,
/// called or in consultation, called in (or, never called, last moved) more
/// than `minutes` ago. Rows another pass holds are skipped, not waited for.
async fn claim_due(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    minutes: i32,
) -> Result<Vec<OpdQueue>, AppError> {
    let rows = sqlx::query_as!(
        OpdQueue,
        r#"WITH due AS (
             SELECT q.id FROM opd_queues q JOIN encounters e ON e.id = q.encounter_id
              WHERE q.tenant_id = $1 AND q.deleted_at IS NULL AND q.kind = 'primary'
                AND q.status IN ('called'::queue_status, 'in_consultation'::queue_status)
                AND COALESCE(q.called_at, q.updated_at) < now() - make_interval(mins => $2)
                AND COALESCE(q.doctor_id, e.doctor_id, e.created_by) IS NOT NULL
              ORDER BY q.id LIMIT $3
              FOR UPDATE OF q SKIP LOCKED
           )
           UPDATE opd_queues q SET status = 'completed'::queue_status,
                  completed_at = now(), updated_at = now()
             FROM due WHERE q.id = due.id
           RETURNING q.id AS "id!", q.tenant_id AS "tenant_id!",
                     q.encounter_id AS "encounter_id!", q.department_id AS "department_id!",
                     q.doctor_id, q.token_number AS "token_number!",
                     q.status AS "status!: QueueStatus", q.queue_date AS "queue_date!",
                     q.called_at, q.completed_at, q.created_at AS "created_at!",
                     q.updated_at AS "updated_at!", q.kind AS "kind!", q.referral_id"#,
        tenant_id,
        minutes,
        MAX_PER_PASS
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows)
}

/// Mark the closed visits as closed automatically, in one statement, and
/// return each visit's doctor, else who registered it.
async fn mark_encounters(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    queues: &[OpdQueue],
) -> Result<std::collections::HashMap<Uuid, Uuid>, AppError> {
    if queues.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let ids: Vec<Uuid> = queues.iter().map(|q| q.encounter_id).collect();
    let rows = sqlx::query!(
        "UPDATE encounters SET close_reason = $3, updated_at = now() \
         WHERE tenant_id = $1 AND id = ANY($2) \
         RETURNING id, COALESCE(doctor_id, created_by) AS actor",
        tenant_id,
        &ids[..],
        CLOSE_REASON
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|r| Some((r.id, r.actor?)))
        .collect())
}

/// The audit row: the system closed this visit, after this many minutes.
async fn audit_close(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue: &OpdQueue,
    minutes: i32,
) -> Result<(), AppError> {
    let new_values = serde_json::json!({
        "queue_id": queue.id,
        "close_reason": CLOSE_REASON,
        "auto_close_after_minutes": minutes,
    });
    kernel::audit::append(
        tx,
        &AuditEntry {
            tenant_id: queue.tenant_id,
            user_id: None,
            action: "opd.visit.auto_closed",
            entity_type: "encounter",
            entity_id: Some(queue.encounter_id),
            old_values: None,
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// The hospital's auto-close setting as the OPD screen shows and saves it.
#[derive(Debug, Serialize, Deserialize)]
pub struct OpdAutoCloseSetting {
    /// Minutes after the patient is called in; `None` is off.
    pub after_minutes: Option<i32>,
}

/// `GET /api/opd/auto-close`
pub async fn get_auto_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OpdAutoCloseSetting>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let after_minutes = read_minutes(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(OpdAutoCloseSetting { after_minutes }))
}

/// `PUT /api/opd/auto-close`: `null` or 0 turns it off; otherwise 15 to 1440.
pub async fn update_auto_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OpdAutoCloseSetting>,
) -> Result<Json<OpdAutoCloseSetting>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let minutes = body.after_minutes.unwrap_or(0);
    if minutes != 0 && !MINUTES_RANGE.contains(&minutes) {
        return Err(AppError::BadRequest(
            "Close visits automatically after 15 to 1440 minutes, or turn it off".into(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'opd', 'auto_close_after_minutes', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
                       value = EXCLUDED.value, updated_at = now()",
        claims.tenant_id,
        serde_json::Value::from(minutes)
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(OpdAutoCloseSetting {
        after_minutes: (minutes != 0).then_some(minutes),
    }))
}

#[cfg(test)]
mod tests {
    use super::minutes_from_setting;
    use serde_json::json;

    #[test]
    fn only_minutes_in_range_turn_it_on() {
        assert_eq!(minutes_from_setting(&json!(60)), Some(60));
        assert_eq!(minutes_from_setting(&json!(15)), Some(15));
        assert_eq!(minutes_from_setting(&json!(1440)), Some(1440));
        for off in [
            json!(0),
            json!(14),
            json!(1441),
            json!(-5),
            json!("60"),
            json!(null),
        ] {
            assert_eq!(minutes_from_setting(&off), None, "{off}");
        }
    }
}
