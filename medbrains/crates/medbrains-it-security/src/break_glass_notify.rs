//! Who is told when someone breaks the glass. Emergency access is legitimate
//! only if it is seen at once: the people who review it, the heads of the
//! department the user works in, and the doctor who last treated the patient.
//! The message names the event, not the patient — the record stays behind
//! its own permission.

use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_core::permissions;

/// Enough to reach every reviewer without a runaway insert. The people this
/// event names — reviewers, heads, the patient's doctor — are told before
/// the blanket administrators, so the cap never squeezes them out.
const MAX_RECIPIENTS: i64 = 200;

pub(crate) struct BreakGlassStarted<'a> {
    pub event_id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub user_department_ids: &'a [Uuid],
    pub patient_id: Uuid,
    pub reason: &'a str,
}

pub(crate) async fn notify(
    tx: &mut Transaction<'_, Postgres>,
    started: &BreakGlassStarted<'_>,
) -> Result<u64, sqlx::Error> {
    let actor: Option<String> =
        sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1 AND tenant_id = $2")
            .bind(started.user_id)
            .bind(started.tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
    let body = format!(
        "{} used emergency access to a patient record. Reason given: {}",
        actor.as_deref().unwrap_or("A staff member"),
        started.reason
    );
    let sent = sqlx::query(
        "INSERT INTO notifications \
            (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, u.id, 'break_glass', 'Emergency access used', $2, 'security', \
                'break_glass_event', $3, '/audit?tab=break-glass' \
           FROM users u \
          WHERE u.tenant_id = $1 AND u.is_active AND u.deleted_at IS NULL AND u.id <> $4 \
            AND ( \
                 u.role::text IN ('super_admin', 'hospital_admin') \
              OR COALESCE(u.access_matrix -> 'extra', '[]'::jsonb) ? $5 \
              OR EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = u.tenant_id \
                           AND r.code = u.role::text AND r.deleted_at IS NULL \
                           AND r.permissions ? $5) \
              OR u.id IN (SELECT e.user_id FROM departments d \
                            JOIN employees e ON e.id = d.head_employee_id \
                           WHERE d.tenant_id = $1 AND d.id = ANY($6) AND e.user_id IS NOT NULL) \
              OR u.id = (SELECT enc.doctor_id FROM encounters enc \
                          WHERE enc.tenant_id = $1 AND enc.patient_id = $7 \
                            AND enc.deleted_at IS NULL AND enc.doctor_id IS NOT NULL \
                          ORDER BY enc.created_at DESC LIMIT 1) \
            ) \
            AND NOT COALESCE(u.access_matrix -> 'denied', '[]'::jsonb) ? $5 \
          ORDER BY \
            CASE WHEN u.role::text IN ('super_admin', 'hospital_admin') THEN 1 ELSE 0 END, \
            u.created_at \
          LIMIT $8",
    )
    .bind(started.tenant_id)
    .bind(&body)
    .bind(started.event_id)
    .bind(started.user_id)
    .bind(permissions::audit::REVIEW)
    .bind(started.user_department_ids)
    .bind(started.patient_id)
    .bind(MAX_RECIPIENTS)
    .execute(&mut **tx)
    .await?;
    Ok(sent.rows_affected())
}
