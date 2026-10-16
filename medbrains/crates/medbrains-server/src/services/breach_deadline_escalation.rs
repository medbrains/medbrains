//! Breach reporting deadlines — escalate an overdue clock once.
//!
//! A security incident assessed as CERT-In reportable must be reported within
//! 6 hours of noticing; a personal-data breach needs the Board's detailed
//! report within 72 hours (`docs/compliance/INCIDENT-RESPONSE.md` §6). The
//! incidents screen shows both as countdowns, but a countdown nobody is
//! looking at expires silently. This pass marks each overdue clock
//! (`cert_in_escalated_at` / `board_escalated_at`) and notifies whoever can
//! act: the incident's assignee and reporter, and every user holding
//! `security.breach.manage` or a bypass role.
//!
//! Same shape as `enquiry_sla_escalation`: mark-and-collect in one statement
//! so overlapping passes never notify twice; a failed notification is logged
//! and does not roll back the mark — the register's red countdown is the
//! guaranteed surface, the notification only the nudge.

use std::time::Duration;

use medbrains_core::permissions;
use medbrains_core::security::{BOARD_REPORT_HOURS, CERT_IN_REPORT_HOURS};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Five minutes: small against a 6-hour clock, cheap against an index that
/// holds only incidents with an open clock.
const PASS_INTERVAL_SECS: u64 = 300;

/// Recipients per incident. A hospital has a handful of people who can file;
/// the cap stops a misconfigured role from paging the whole staff.
const MAX_RECIPIENTS: i64 = 50;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            for clock in [Clock::CertIn, Clock::Board] {
                match escalate(&pool, clock).await {
                    Ok(count) if count > 0 => {
                        tracing::warn!(
                            escalated = count,
                            clock = clock.label(),
                            "breach reporting deadline missed"
                        );
                    }
                    Ok(_) => {}
                    Err(error) => {
                        tracing::error!(%error, clock = clock.label(), "breach deadline escalation pass failed");
                    }
                }
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(Clone, Copy)]
enum Clock {
    CertIn,
    Board,
}

impl Clock {
    const fn label(self) -> &'static str {
        match self {
            Self::CertIn => "cert_in",
            Self::Board => "board",
        }
    }

    /// Marks overdue, unescalated clocks of this kind and returns them.
    /// Only fixed SQL fragments are chosen here; no input reaches the text.
    const fn sql(self) -> &'static str {
        match self {
            Self::CertIn => {
                "WITH due AS ( \
                    SELECT id FROM security_incidents \
                    WHERE deleted_at IS NULL AND is_cert_in_reportable \
                      AND cert_in_report_date IS NULL AND cert_in_escalated_at IS NULL \
                      AND now() > discovered_at + make_interval(hours => $1) \
                    LIMIT 500) \
                 UPDATE security_incidents s SET cert_in_escalated_at = now() \
                 FROM due WHERE s.id = due.id \
                 RETURNING s.id, s.tenant_id, s.incident_number, s.assigned_to, s.reported_by"
            }
            Self::Board => {
                "WITH due AS ( \
                    SELECT id FROM security_incidents \
                    WHERE deleted_at IS NULL AND is_personal_data_breach \
                      AND board_report_sent_at IS NULL AND board_escalated_at IS NULL \
                      AND now() > discovered_at + make_interval(hours => $1) \
                    LIMIT 500) \
                 UPDATE security_incidents s SET board_escalated_at = now() \
                 FROM due WHERE s.id = due.id \
                 RETURNING s.id, s.tenant_id, s.incident_number, s.assigned_to, s.reported_by"
            }
        }
    }

    const fn hours(self) -> i64 {
        match self {
            Self::CertIn => CERT_IN_REPORT_HOURS,
            Self::Board => BOARD_REPORT_HOURS,
        }
    }

    const fn what(self) -> &'static str {
        match self {
            Self::CertIn => "CERT-In report (6 hours)",
            Self::Board => "Data Protection Board detailed report (72 hours)",
        }
    }
}

#[derive(sqlx::FromRow)]
struct Overdue {
    id: Uuid,
    tenant_id: Uuid,
    incident_number: String,
    assigned_to: Option<Uuid>,
    reported_by: Option<Uuid>,
}

/// One pass for one clock. Returns how many incidents were escalated.
///
/// # Errors
/// The marking query's error propagates — a pass that cannot read the
/// register must not report zero overdue, which is what a healthy one says.
async fn escalate(pool: &PgPool, clock: Clock) -> Result<u64, AppError> {
    let overdue = sqlx::query_as::<_, Overdue>(clock.sql())
        .bind(i32::try_from(clock.hours()).unwrap_or(i32::MAX))
        .fetch_all(pool)
        .await?;

    for incident in &overdue {
        if let Err(error) = notify(pool, clock, incident).await {
            tracing::error!(%error, incident = %incident.id, "could not notify about an overdue breach report");
        }
    }
    Ok(overdue.len() as u64)
}

async fn notify(pool: &PgPool, clock: Clock, incident: &Overdue) -> Result<(), sqlx::Error> {
    let title = format!("Overdue: {}", clock.what());
    // No personal data in the notification: the incident number is enough to
    // open the record, and the record is permission-gated.
    let body = format!(
        "Incident {} is past its {}. File it now and record it on the incident.",
        incident.incident_number,
        clock.what()
    );
    let named: Vec<Uuid> = [incident.assigned_to, incident.reported_by]
        .into_iter()
        .flatten()
        .collect();
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO notifications \
            (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, u.id, 'breach_deadline', $2, $3, 'security', 'security_incident', $4, '/security' \
         FROM users u \
         WHERE u.tenant_id = $1 AND u.is_active AND u.deleted_at IS NULL \
           AND (u.id = ANY($5) \
                OR u.role::text IN ('super_admin', 'hospital_admin') \
                OR COALESCE(u.access_matrix -> 'extra', '[]'::jsonb) ? $6 \
                OR EXISTS (SELECT 1 FROM roles r \
                           WHERE r.tenant_id = u.tenant_id AND r.code = u.role::text \
                             AND r.deleted_at IS NULL AND r.permissions ? $6)) \
           AND NOT COALESCE(u.access_matrix -> 'denied', '[]'::jsonb) ? $6 \
         LIMIT $7",
    )
    .bind(incident.tenant_id)
    .bind(&title)
    .bind(&body)
    .bind(incident.id)
    .bind(&named)
    .bind(permissions::security::breach::MANAGE)
    .bind(MAX_RECIPIENTS)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO security_incident_updates (tenant_id, incident_id, update_type, description) \
         VALUES ($1, $2, 'escalation', $3)",
    )
    .bind(incident.tenant_id)
    .bind(incident.id)
    .bind(&title)
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}
