//! A nurse call nobody answers has to reach somebody (NABH CL-3).
//!
//! Escalation already existed as a *colour*. The ward board computed it on
//! read — amber past the tenant's first threshold, red past the second — and
//! that was the whole of it. Nobody was told. A charge nurse found out about
//! an unanswered call by happening to look at a screen, which is a
//! coincidence rather than a control, and at three in the morning there is
//! nobody looking at the screen.
//!
//! This pass tells them. Two tiers, the same thresholds the board uses
//! (`nurse_call_escalate_secs`, `nurse_call_supervisor_secs`), so the colour
//! on the wall and the notification in somebody's hand agree about when a
//! call went late.
//!
//! `acknowledged` does not stop the clock. A nurse pressing "Seen" has taken
//! the call, not answered it, and the same rule already governs
//! `is_open_nurse_call` in the shared core — the patient is still waiting.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Every thirty seconds. The first tier fires at two minutes by default, so a
/// slower pass would make the notification later than the thing it reports.
const PASS_INTERVAL_SECS: u64 = 30;
const DEFAULT_ESCALATE_SECS: i32 = 120;
const DEFAULT_SUPERVISOR_SECS: i32 = 300;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_unanswered(&pool).await {
                Ok(escalated) if escalated > 0 => {
                    tracing::warn!(escalated, "nurse calls escalated — unanswered");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "nurse call escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct LateCall {
    id: Uuid,
    tenant_id: Uuid,
    request_type: String,
    waiting_seconds: i32,
    escalation_level: Option<String>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    department_id: Option<Uuid>,
    /// Whoever took the call, if anybody did — their supervisor is the second
    /// tier.
    supervisor_id: Option<Uuid>,
}

/// Which tier a wait has reached, or `None` while it is still within time.
fn tier_for(waiting_seconds: i32, escalate_secs: i32, supervisor_secs: i32) -> Option<&'static str> {
    if waiting_seconds >= supervisor_secs {
        Some("supervisor")
    } else if waiting_seconds >= escalate_secs {
        Some("charge_nurse")
    } else {
        None
    }
}

/// Whether `tier` is further along than what the call has already reached.
///
/// A call that sat through both thresholds while the pass was down escalates
/// straight to supervisor and does not also send the charge-nurse message
/// afterwards: the later tier subsumes the earlier one.
fn advances(current: Option<&str>, tier: &str) -> bool {
    matches!((current, tier), (None, _) | (Some("charge_nurse"), "supervisor"))
}

async fn escalate_unanswered(pool: &PgPool) -> Result<u64, AppError> {
    // One statement for every tenant's late calls. The thresholds come from
    // each tenant's own settings, falling back to the same defaults the board
    // uses, so a hospital that widened its window does not get notifications
    // its own board calls premature.
    let late = sqlx::query_as!(
        LateCall,
        "SELECT r.id AS \"id!\", r.tenant_id AS \"tenant_id!\", \
                r.request_type::text AS \"request_type!\", \
                GREATEST(0, EXTRACT(EPOCH FROM (now() - r.created_at))::int) \
                  AS \"waiting_seconds!\", \
                r.escalation_level AS \"escalation_level?\", \
                b.bed_number AS \"bed_number?\", w.name AS \"ward_name?\", \
                a.department_id AS \"department_id?\", \
                ack.supervisor_id AS \"supervisor_id?\" \
           FROM bedside_nurse_requests r \
           LEFT JOIN admissions a ON a.id = r.admission_id AND a.tenant_id = r.tenant_id \
           LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = r.tenant_id \
           LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = r.tenant_id \
           LEFT JOIN users ack ON ack.id = r.acknowledged_by \
           LEFT JOIN tenant_settings esc \
             ON esc.tenant_id = r.tenant_id AND esc.category = 'clinical' \
            AND esc.key = 'nurse_call_escalate_secs' \
          WHERE r.completed_at IS NULL \
            AND r.deleted_at IS NULL \
            AND EXTRACT(EPOCH FROM (now() - r.created_at))::int >= \
                COALESCE((esc.value #>> '{}')::int, $1) \
          ORDER BY r.created_at \
          LIMIT 500",
        DEFAULT_ESCALATE_SECS,
    )
    .fetch_all(pool)
    .await?;

    let mut escalated = 0u64;
    for call in late {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &call.tenant_id).await?;

        let escalate_secs = medbrains_server_core::tenant_config::setting_i32(
            &mut tx,
            &call.tenant_id,
            medbrains_server_core::tenant_config::keys::NURSE_CALL_ESCALATE_SECS,
            DEFAULT_ESCALATE_SECS,
        )
        .await?;
        let supervisor_secs = medbrains_server_core::tenant_config::setting_i32(
            &mut tx,
            &call.tenant_id,
            medbrains_server_core::tenant_config::keys::NURSE_CALL_SUPERVISOR_SECS,
            DEFAULT_SUPERVISOR_SECS,
        )
        .await?;

        let Some(tier) = tier_for(call.waiting_seconds, escalate_secs, supervisor_secs) else {
            continue;
        };
        if !advances(call.escalation_level.as_deref(), tier) {
            continue;
        }

        // Who to tell. The charge nurse is whoever holds the ward's duty
        // roster right now; the supervisor tier goes above the nurse who took
        // the call. Either may be missing, and a missing recipient is logged
        // rather than silently swallowed — an escalation nobody receives is
        // the failure this whole pass exists to prevent.
        let recipient = if tier == "supervisor" {
            call.supervisor_id
        } else {
            super::on_call::current_on_call(&mut tx, call.tenant_id, call.department_id)
                .await?
                .and_then(|contact| contact.user_id)
        };

        let where_it_is = match (call.bed_number.as_deref(), call.ward_name.as_deref()) {
            (Some(bed), Some(ward)) => format!("{ward}, bed {bed}"),
            (Some(bed), None) => format!("bed {bed}"),
            (None, Some(ward)) => ward.to_owned(),
            (None, None) => "an unassigned bed".to_owned(),
        };
        let minutes = call.waiting_seconds / 60;

        if let Some(user_id) = recipient {
            // A notification failure must not abandon the batch or roll back
            // the mark: re-firing every thirty seconds would bury the ward in
            // the same message. A failed statement aborts the whole
            // transaction, so the insert runs under a savepoint — rolling
            // back to it keeps the mark below writable.
            let mut notify = sqlx::Connection::begin(&mut *tx).await?;
            let sent = sqlx::query!(
                "INSERT INTO notifications \
                    (tenant_id, user_id, kind, title, body, category, \
                     entity_type, entity_id, action_url) \
                 VALUES ($1, $2, 'sla_breach', $3, $4, 'nursing', \
                         'bedside_nurse_request', $5, '/nursing#calls')",
                call.tenant_id,
                user_id,
                if tier == "supervisor" {
                    "Nurse call still unanswered"
                } else {
                    "Nurse call overdue"
                },
                format!(
                    "A {} call from {where_it_is} has been waiting {minutes} minutes.",
                    call.request_type.replace('_', " ")
                ),
                call.id,
            )
            .execute(&mut *notify)
            .await;
            match sent {
                Ok(_) => notify.commit().await?,
                Err(error) => {
                    notify.rollback().await?;
                    tracing::error!(%error, call_id = %call.id, "nurse call escalation notify failed");
                }
            }
        } else {
            tracing::error!(
                call_id = %call.id, tier, ward = ?call.ward_name,
                "nurse call overdue and nobody to escalate to — no on-call nurse on the \
                 roster and no supervisor on the account that took it"
            );
        }

        sqlx::query!(
            "UPDATE bedside_nurse_requests \
                SET escalation_level = $1, escalated_at = now(), escalated_to = $2 \
              WHERE id = $3 AND tenant_id = $4",
            tier,
            recipient,
            call.id,
            call.tenant_id,
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        escalated += 1;
    }

    Ok(escalated)
}

#[cfg(test)]
mod tests {
    use super::{advances, tier_for};

    #[test]
    fn a_call_inside_its_window_escalates_to_nobody() {
        assert_eq!(tier_for(0, 120, 300), None);
        assert_eq!(tier_for(119, 120, 300), None);
    }

    #[test]
    fn the_tiers_fire_on_their_thresholds() {
        assert_eq!(tier_for(120, 120, 300), Some("charge_nurse"));
        assert_eq!(tier_for(299, 120, 300), Some("charge_nurse"));
        assert_eq!(tier_for(300, 120, 300), Some("supervisor"));
    }

    #[test]
    fn a_tenant_that_widened_its_window_is_obeyed() {
        // The board reads the same settings; the two must not disagree about
        // when a call went late.
        assert_eq!(tier_for(120, 600, 900), None);
        assert_eq!(tier_for(600, 600, 900), Some("charge_nurse"));
    }

    #[test]
    fn each_tier_fires_once_and_a_gap_does_not_replay_the_first() {
        assert!(advances(None, "charge_nurse"));
        assert!(advances(Some("charge_nurse"), "supervisor"));
        // Already told, and told again every thirty seconds, is how a ward
        // learns to ignore the notification.
        assert!(!advances(Some("charge_nurse"), "charge_nurse"));
        assert!(!advances(Some("supervisor"), "supervisor"));
        // A pass that was down through both thresholds goes straight to the
        // supervisor and does not send the earlier message afterwards.
        assert!(!advances(Some("supervisor"), "charge_nurse"));
    }
}
