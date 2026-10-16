//! Turns record access into alerts someone reviews (NABH IMS, DPDP security
//! safeguards). Every patient record opened is in `access_log`; nobody reads a
//! log. Each pass looks at the last ten minutes and raises an alert for:
//!
//! - **a flagged record** — a VIP or otherwise sensitive patient marked
//!   "alert on access"; the people named on the flag are notified;
//! - **after hours** — opened between 22:00 and 06:00 hospital time by someone
//!   not clocked in on a shift (night staff on duty are expected);
//! - **bulk** — one person opening more than `BULK_PATIENTS` different patients
//!   within an hour, which is what copying records out looks like.
//!
//! One alert per person, patient and kind per day: the overlap between passes
//! and a busy night repeat nothing. Alerts appear on Audit → Access alerts.

use std::time::Duration;

use sqlx::PgPool;

const PASS_INTERVAL_SECS: u64 = 300;
/// Distinct patients in an hour before it is a bulk read.
pub const BULK_PATIENTS: i64 = 50;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match scan_once(&pool).await {
                Ok(raised) if raised > 0 => tracing::warn!(raised, "access alerts raised"),
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "access alert scan failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// Not raised already today for this person, patient and kind.
const NOT_YET: &str = "NOT EXISTS (SELECT 1 FROM access_alerts a \
     WHERE a.tenant_id = l.tenant_id AND a.user_id = l.user_id AND a.patient_id = l.patient_id \
       AND a.access_type = $1 AND a.created_at > now() - interval '24 hours')";

/// One pass over the last ten minutes. Returns how many alerts it raised.
pub async fn scan_once(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let flagged: i64 = sqlx::query_scalar(&format!(
        "WITH raised AS ( \
           INSERT INTO access_alerts \
             (tenant_id, patient_id, user_id, access_type, module, ip_address, is_authorized, notes) \
           SELECT DISTINCT ON (l.tenant_id, l.user_id, l.patient_id) \
                  l.tenant_id, l.patient_id, l.user_id, $1, l.module, l.ip_address, \
                  (cardinality(COALESCE(s.access_restricted_to, '{{}}')) = 0 \
                     OR l.user_id = ANY(s.access_restricted_to)), \
                  'Opened a record flagged ' || s.sensitivity_type \
             FROM access_log l \
             JOIN sensitive_patients s ON s.tenant_id = l.tenant_id AND s.patient_id = l.patient_id \
                  AND s.deleted_at IS NULL AND s.alert_on_access \
            WHERE l.created_at > now() - interval '10 minutes' AND l.deleted_at IS NULL \
              AND l.patient_id IS NOT NULL AND {NOT_YET} \
            ORDER BY l.tenant_id, l.user_id, l.patient_id, l.created_at DESC \
           RETURNING id, tenant_id, patient_id), \
         told AS (INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT r.tenant_id, n.user_id, 'access_alert', 'Flagged record opened', \
                'A record you asked to be told about was opened. See Audit, Access alerts.', \
                'security', 'access_alert', r.id, '/audit' \
           FROM raised r \
           JOIN sensitive_patients s ON s.tenant_id = r.tenant_id AND s.patient_id = r.patient_id \
                AND s.deleted_at IS NULL \
           CROSS JOIN LATERAL unnest(s.notify_users) AS n(user_id) \
         RETURNING 1) \
         SELECT COUNT(*) FROM raised"
    ))
    .bind("sensitive_record")
    .fetch_one(pool)
    .await?;

    let after_hours = sqlx::query(&format!(
        "INSERT INTO access_alerts \
           (tenant_id, patient_id, user_id, access_type, module, ip_address, notes) \
         SELECT DISTINCT ON (l.tenant_id, l.user_id, l.patient_id) \
                l.tenant_id, l.patient_id, l.user_id, $1, l.module, l.ip_address, \
                'Opened at ' || to_char(l.created_at AT TIME ZONE COALESCE(t.timezone, 'UTC'), 'HH24:MI') \
                  || ' with no shift clocked in' \
           FROM access_log l \
           JOIN tenants t ON t.id = l.tenant_id \
          WHERE l.created_at > now() - interval '10 minutes' AND l.deleted_at IS NULL \
            AND l.patient_id IS NOT NULL \
            AND (extract(hour FROM l.created_at AT TIME ZONE COALESCE(t.timezone, 'UTC')) >= 22 \
                 OR extract(hour FROM l.created_at AT TIME ZONE COALESCE(t.timezone, 'UTC')) < 6) \
            AND NOT EXISTS (SELECT 1 FROM attendance_records ar \
                  JOIN employees e ON e.id = ar.employee_id \
                 WHERE e.tenant_id = l.tenant_id AND e.user_id = l.user_id \
                   AND ar.deleted_at IS NULL AND ar.check_in <= l.created_at \
                   AND (ar.check_out IS NULL OR ar.check_out >= l.created_at)) \
            AND {NOT_YET} \
          ORDER BY l.tenant_id, l.user_id, l.patient_id, l.created_at DESC"
    ))
    .bind("after_hours")
    .execute(pool)
    .await?;

    let bulk = sqlx::query(
        "INSERT INTO access_alerts (tenant_id, patient_id, user_id, access_type, notes) \
         SELECT DISTINCT ON (l.tenant_id, l.user_id) l.tenant_id, l.patient_id, l.user_id, $1, \
                'Opened ' || b.patients || ' different patients within an hour' \
           FROM (SELECT tenant_id, user_id, COUNT(DISTINCT patient_id) AS patients \
                   FROM access_log \
                  WHERE created_at > now() - interval '1 hour' AND deleted_at IS NULL \
                    AND patient_id IS NOT NULL \
                  GROUP BY tenant_id, user_id \
                 HAVING COUNT(DISTINCT patient_id) > $2) b \
           JOIN access_log l ON l.tenant_id = b.tenant_id AND l.user_id = b.user_id \
                AND l.created_at > now() - interval '1 hour' AND l.patient_id IS NOT NULL \
          WHERE NOT EXISTS (SELECT 1 FROM access_alerts a \
                 WHERE a.tenant_id = l.tenant_id AND a.user_id = l.user_id AND a.access_type = $1 \
                   AND a.created_at > now() - interval '24 hours') \
          ORDER BY l.tenant_id, l.user_id, l.created_at DESC",
    )
    .bind("bulk_access")
    .bind(BULK_PATIENTS)
    .execute(pool)
    .await?;

    Ok(flagged.unsigned_abs() + after_hours.rows_affected() + bulk.rows_affected())
}
