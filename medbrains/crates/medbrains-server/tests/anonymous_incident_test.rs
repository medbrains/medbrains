//! An anonymous incident report names nobody (NABH just culture): not the
//! incident row, not the NABH sentinel register mirrored from it, not the
//! outbox event, not the HTTP audit row. A named report still names its
//! reporter, so the checks below would see one if it leaked.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn report(app: &common::TestApp, csrf: &str, title: &str, anonymous: bool) -> Value {
    let resp = app
        .client
        .post(app.url("/api/quality/incidents"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "title": title,
            "incident_type": "sentinel_event",
            "severity": "sentinel",
            "incident_date": "2026-10-12",
            "is_anonymous": anonymous,
        }))
        .send()
        .await
        .expect("report");
    assert_eq!(resp.status(), StatusCode::OK);
    resp.json().await.expect("incident json")
}

async fn audit_rows(
    app: &common::TestApp,
    since: chrono::DateTime<chrono::Utc>,
) -> Vec<Option<Uuid>> {
    // The HTTP audit row is written off the request path; give it a moment.
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    sqlx::query_scalar(
        "SELECT user_id FROM audit_log \
          WHERE action = 'create_quality' AND created_at >= $1 ORDER BY created_at",
    )
    .bind(since)
    .fetch_all(&app.db)
    .await
    .expect("audit rows")
}

#[tokio::test]
async fn an_anonymous_report_is_stored_mirrored_and_audited_without_its_reporter() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let tag = Uuid::new_v4().simple().to_string();

    let since = chrono::Utc::now();
    let anon = report(&app, &csrf, &format!("Anonymous {tag}"), true).await;
    assert!(anon["reported_by"].is_null(), "response names the reporter");
    let id: Uuid = anon["id"].as_str().expect("id").parse().expect("uuid");

    let stored: Option<Uuid> =
        sqlx::query_scalar("SELECT reported_by FROM quality_incidents WHERE id = $1")
            .bind(id)
            .fetch_one(&app.db)
            .await
            .expect("row");
    assert_eq!(stored, None, "the row stores the reporter");

    let register: Uuid = sqlx::query_scalar(
        "SELECT reported_by FROM nabh_sentinel_event_register \
          WHERE source_module = 'quality_incidents' AND source_record_id = $1",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("sentinel register row");
    assert_eq!(
        register,
        Uuid::nil(),
        "the NABH register names the reporter"
    );

    let events = app
        .outbox_rows("quality.incident.reported", &id.to_string())
        .await;
    assert!(!events.is_empty(), "no outbox event");
    for event in &events {
        assert!(
            !event.to_string().contains(&admin.to_string()),
            "the outbox event names the reporter: {event}"
        );
    }

    let anon_audit = audit_rows(&app, since).await;
    assert!(
        anon_audit.contains(&None),
        "the anonymous report was not audited at all"
    );
    assert!(
        !anon_audit.contains(&Some(admin)),
        "the audit row names the reporter"
    );

    // The same checks see a named reporter — they are not blind.
    let since = chrono::Utc::now();
    let named = report(&app, &csrf, &format!("Named {tag}"), false).await;
    assert_eq!(
        named["reported_by"].as_str(),
        Some(admin.to_string().as_str())
    );
    assert!(audit_rows(&app, since).await.contains(&Some(admin)));

    // And the database refuses a writer that forgets.
    let refused = sqlx::query("UPDATE quality_incidents SET reported_by = $2 WHERE id = $1")
        .bind(id)
        .bind(admin)
        .execute(&app.db)
        .await;
    assert!(refused.is_err(), "an anonymous row accepted a reporter");
}
