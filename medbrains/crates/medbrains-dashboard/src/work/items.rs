//! The counts behind `GET /api/users/me/work`: one small query per item, each scoped to the
//! caller's own work by an assignment edge (notified to me, my queue, my drafts, assigned to me).
//!
//! Every query names the tenant and runs under the caller's RLS context. Each stops reading at
//! [`COUNT_CEILING`] rows, so a count costs the same however far behind a hospital is.

use chrono::{DateTime, Utc};
use medbrains_kernel::Actor;
use serde::Serialize;
use sqlx::PgConnection;
use uuid::Uuid;

/// Counts stop at this many rows; the launcher shows one less, followed by "+".
pub const COUNT_CEILING: i64 = 100;
/// A patient waiting longer than this many minutes is called out on the OPD card.
pub const LONG_WAIT_MINUTES: i32 = 30;

/// One item of work the launcher can count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Key {
    /// Critical lab values notified or escalated to me and not yet acknowledged.
    LabCritical,
    /// Patients waiting in my OPD queue today.
    OpdWaiting,
    /// My clinical notes still in draft.
    NotesUnsigned,
    /// Approval requests waiting for my decision.
    Approvals,
}

/// A patient as the critical-value line names them, e.g. "A. Rao", UHID.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PatientLabel {
    pub name: String,
    pub uhid: String,
}

/// The one typed fact the web words under a count. Never free text; names a patient only in
/// `CriticalResult`, and only once the per-record access check has passed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Detail {
    /// The oldest unacknowledged critical value.
    CriticalResult {
        parameter: String,
        value: String,
        unit: Option<String>,
        reported_at: DateTime<Utc>,
        patient: Option<PatientLabel>,
    },
    /// How long the longest-waiting patient has waited, and how many are past the threshold.
    QueueWait {
        longest_minutes: i64,
        long_waits: i64,
        long_wait_minutes: i32,
    },
    /// When the oldest item happened (for notes, the time of care).
    OldestAt { at: DateTime<Utc> },
    /// The soonest decision deadline among the items.
    SoonestDue { at: DateTime<Utc> },
}

/// One item's answer before it is shaped for the screen. `subject` is the patient the detail
/// may name, held back until the caller's access to that patient is checked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Count {
    pub total: i64,
    pub detail: Option<Detail>,
    pub subject: Option<(Uuid, PatientLabel)>,
}

impl Count {
    /// A count with no detail line, as when there is nothing to describe.
    const fn bare(total: i64) -> Self {
        Self {
            total,
            detail: None,
            subject: None,
        }
    }
}

/// Count one item for `me` on the caller's open connection.
///
/// # Errors
/// The item's query failed; the caller turns that into `failed`, never into 0.
pub async fn count(conn: &mut PgConnection, key: Key, me: Actor) -> Result<Count, sqlx::Error> {
    match key {
        Key::LabCritical => lab_critical(conn, me).await,
        Key::OpdWaiting => opd_waiting(conn, me).await,
        Key::NotesUnsigned => notes_unsigned(conn, me).await,
        Key::Approvals => approvals(conn, me).await,
    }
}

/// "A. Rao": the first initial and the family name, as the mock and a ward board show it.
fn short_name(first: &str, last: &str) -> String {
    first
        .chars()
        .next()
        .map_or_else(|| last.to_owned(), |initial| format!("{initial}. {last}"))
}

/// Critical values notified or escalated to me, unacknowledged, with the oldest one described.
async fn lab_critical(conn: &mut PgConnection, me: Actor) -> Result<Count, sqlx::Error> {
    let total = sqlx::query_scalar!(
        r#"SELECT count(*) AS "total!" FROM (SELECT 1 FROM lab_critical_alerts
             WHERE tenant_id = $1 AND acknowledged_at IS NULL AND deleted_at IS NULL
               AND (notified_to = $2 OR escalated_to = $2) LIMIT $3) s"#,
        me.tenant_id,
        me.user_id,
        COUNT_CEILING,
    )
    .fetch_one(&mut *conn)
    .await?;
    if total == 0 {
        return Ok(Count::bare(0));
    }
    let oldest = sqlx::query!(
        r#"SELECT ca.patient_id, ca.parameter_name, ca.value, r.unit AS "unit?",
                  ca.created_at, p.first_name AS "first_name?", p.last_name AS "last_name?",
                  p.uhid AS "uhid?"
             FROM lab_critical_alerts ca
             LEFT JOIN lab_results r ON r.id = ca.result_id AND r.tenant_id = ca.tenant_id
             LEFT JOIN patients p ON p.id = ca.patient_id AND p.tenant_id = ca.tenant_id
            WHERE ca.tenant_id = $1 AND ca.acknowledged_at IS NULL AND ca.deleted_at IS NULL
              AND (ca.notified_to = $2 OR ca.escalated_to = $2)
            ORDER BY ca.created_at LIMIT 1"#,
        me.tenant_id,
        me.user_id,
    )
    .fetch_optional(&mut *conn)
    .await?;
    let Some(row) = oldest else {
        return Ok(Count::bare(total));
    };
    let label = match (row.first_name, row.last_name, row.uhid) {
        (Some(first), Some(last), Some(uhid)) => Some(PatientLabel {
            name: short_name(&first, &last),
            uhid,
        }),
        _ => None,
    };
    Ok(Count {
        total,
        detail: Some(Detail::CriticalResult {
            parameter: row.parameter_name,
            value: row.value,
            unit: row.unit,
            reported_at: row.created_at,
            patient: None,
        }),
        subject: label.map(|label| (row.patient_id, label)),
    })
}

/// Patients waiting for me in today's OPD queue (the hospital's own date), longest wait first.
async fn opd_waiting(conn: &mut PgConnection, me: Actor) -> Result<Count, sqlx::Error> {
    let row = sqlx::query!(
        r#"SELECT count(*) AS "total!",
                  floor(extract(epoch FROM now() - min(s.created_at)) / 60)::bigint AS longest,
                  count(*) FILTER (WHERE s.created_at < now() - make_interval(mins => $4))
                      AS "long_waits!"
             FROM (SELECT q.created_at FROM opd_queues q
                     JOIN encounters e ON e.id = q.encounter_id AND e.tenant_id = q.tenant_id
                    WHERE q.tenant_id = $1 AND q.doctor_id = $2 AND q.status = 'waiting'
                      AND q.deleted_at IS NULL AND e.deleted_at IS NULL
                      AND q.queue_date = (timezone(COALESCE(
                            (SELECT timezone FROM tenants WHERE id = $1), 'UTC'), now()))::date
                    ORDER BY q.created_at LIMIT $3) s"#,
        me.tenant_id,
        me.user_id,
        COUNT_CEILING,
        LONG_WAIT_MINUTES,
    )
    .fetch_one(&mut *conn)
    .await?;
    let detail = row.longest.map(|longest_minutes| Detail::QueueWait {
        longest_minutes,
        long_waits: row.long_waits,
        long_wait_minutes: LONG_WAIT_MINUTES,
    });
    Ok(Count {
        total: row.total,
        detail,
        subject: None,
    })
}

/// My notes still in draft, with when the oldest one's care happened.
async fn notes_unsigned(conn: &mut PgConnection, me: Actor) -> Result<Count, sqlx::Error> {
    let row = sqlx::query!(
        r#"SELECT count(*) AS "total!", min(s.service_at) AS oldest
             FROM (SELECT n.service_at FROM clinical_notes n
                    WHERE n.tenant_id = $1 AND n.author_id = $2 AND n.status = 'draft'
                      AND n.deleted_at IS NULL
                    ORDER BY n.service_at LIMIT $3) s"#,
        me.tenant_id,
        me.user_id,
        COUNT_CEILING,
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(Count {
        total: row.total,
        detail: row.oldest.map(|at| Detail::OldestAt { at }),
        subject: None,
    })
}

/// Pending approval requests I am an assignee on (the inbox's own rule), soonest deadline first.
async fn approvals(conn: &mut PgConnection, me: Actor) -> Result<Count, sqlx::Error> {
    let row = sqlx::query!(
        r#"SELECT count(*) AS "total!", min(s.sla_due_at) AS soonest
             FROM (SELECT r.sla_due_at FROM approval_requests r
                    WHERE r.tenant_id = $1 AND r.status = 'pending' AND r.deleted_at IS NULL
                      AND EXISTS (SELECT 1 FROM approval_step_assignees a
                                   WHERE a.request_id = r.id AND a.tenant_id = r.tenant_id
                                     AND a.user_id = $2)
                    ORDER BY r.sla_due_at NULLS LAST LIMIT $3) s"#,
        me.tenant_id,
        me.user_id,
        COUNT_CEILING,
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(Count {
        total: row.total,
        detail: row.soonest.map(|at| Detail::SoonestDue { at }),
        subject: None,
    })
}

#[cfg(test)]
mod tests {
    use super::short_name;

    #[test]
    fn a_patient_is_named_by_initial_and_family_name() {
        assert_eq!(short_name("Anita", "Rao"), "A. Rao");
        assert_eq!(short_name("", "Rao"), "Rao");
    }
}
