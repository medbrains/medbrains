//! Record access becomes alerts a reviewer sees: a flagged patient opened
//! (and the people named on the flag told), a record opened at night by
//! someone not on shift, and one person opening dozens of patients in an
//! hour. One alert per person, patient and kind per day.

use crate::common;

use medbrains_server::services::access_alert_scan::{BULK_PATIENTS, scan_once};
use uuid::Uuid;

async fn count(db: &sqlx::PgPool, user: Uuid, kind: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM access_alerts WHERE user_id = $1 AND access_type = $2")
        .bind(user)
        .bind(kind)
        .fetch_one(db)
        .await
        .expect("count")
}

#[tokio::test]
async fn access_patterns_raise_one_alert_each() {
    let app = common::spawn_app().await;
    let db = &app.db;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(db)
            .await
            .expect("admin");
    let t = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let patients: Vec<Uuid> = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT $1, 'UH-AA-' || $2 || '-' || g, 'Scan', 'Patient' || g, 'female', '9000000000' \
           FROM generate_series(1, $3) g RETURNING id",
    )
    .bind(tenant)
    .bind(&t)
    .bind(i32::try_from(BULK_PATIENTS + 1).unwrap_or(51))
    .fetch_all(db)
    .await
    .expect("patients");
    // A reader: a fresh user so earlier alerts don't interfere.
    let reader: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role) \
         SELECT tenant_id, 'scan_' || $2, 'scan_' || $2 || '@e2e.medbrains.localhost', password_hash, \
                'Scan Reader', 'doctor' FROM users WHERE id = $1 RETURNING id",
    )
    .bind(admin)
    .bind(t.to_lowercase())
    .fetch_one(db)
    .await
    .expect("reader");

    // The first patient is flagged; the admin is to be told.
    sqlx::query(
        "INSERT INTO sensitive_patients (tenant_id, patient_id, sensitivity_type, reason, alert_on_access, notify_users, created_by) \
         VALUES ($1, $2, 'vip', 'Minister', true, ARRAY[$3]::uuid[], $3)",
    )
    .bind(tenant)
    .bind(patients[0])
    .bind(admin)
    .execute(db)
    .await
    .expect("flag");

    // The reader opens every one of them now.
    sqlx::query(
        "INSERT INTO access_log (tenant_id, user_id, entity_type, entity_id, patient_id, action, module) \
         SELECT $1, $2, 'patients', p, p, 'view', 'patients' FROM unnest($3::uuid[]) p",
    )
    .bind(tenant)
    .bind(reader)
    .bind(&patients)
    .execute(db)
    .await
    .expect("access");

    // Make "now" 23:00 at the hospital, so it is after hours and nobody is on shift.
    let utc_hour: i32 =
        sqlx::query_scalar("SELECT extract(hour FROM now() AT TIME ZONE 'UTC')::int")
            .fetch_one(db)
            .await
            .expect("hour");
    let offset = (23 - utc_hour).rem_euclid(24);
    let offset = if offset > 12 { offset - 24 } else { offset };
    // Etc/GMT signs are inverted: Etc/GMT-5 is UTC+5.
    let zone = format!("Etc/GMT{:+}", -offset);
    let previous: Option<String> = sqlx::query_scalar("SELECT timezone FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(db)
        .await
        .expect("tz");
    sqlx::query("UPDATE tenants SET timezone = $2 WHERE id = $1")
        .bind(tenant)
        .bind(&zone)
        .execute(db)
        .await
        .expect("tz");

    let raised = scan_once(db).await;
    sqlx::query("UPDATE tenants SET timezone = $2 WHERE id = $1")
        .bind(tenant)
        .bind(previous)
        .execute(db)
        .await
        .expect("restore");
    raised.expect("scan");

    assert_eq!(
        count(db, reader, "sensitive_record").await,
        1,
        "the flagged record"
    );
    assert_eq!(
        count(db, reader, "bulk_access").await,
        1,
        "one bulk alert for the person"
    );
    assert_eq!(
        count(db, reader, "after_hours").await,
        i64::try_from(patients.len()).unwrap_or(0),
        "each record opened at night"
    );
    let told: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND kind = 'access_alert' AND created_at > now() - interval '1 minute'",
    )
    .bind(admin)
    .fetch_one(db)
    .await
    .expect("told");
    assert!(told >= 1, "the person named on the flag is told");

    // A second pass raises nothing new.
    scan_once(db).await.expect("scan again");
    assert_eq!(count(db, reader, "sensitive_record").await, 1);
    assert_eq!(count(db, reader, "bulk_access").await, 1);
}
