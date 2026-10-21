//! The breach register on a security incident: assessing it starts the
//! CERT-In (6 h) and Board (72 h) clocks from when it was noticed, each
//! regulatory notice is recorded once and lands on the timeline and the audit
//! chain, a notice whose clock does not apply is refused, and only
//! `security.breach.manage` may do any of it.

use crate::common;

use chrono::{DateTime, Duration, Utc};
use reqwest::{Client, RequestBuilder, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn nurse(app: &common::TestApp, admin_csrf: &str) -> (Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("brn_{tag}"), format!("Breach#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": "Breach Nurse",
            "role": "nurse",
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(resp.status(), StatusCode::OK);
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    (client, csrf)
}

fn at(v: &Value) -> DateTime<Utc> {
    v.as_str()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .expect("timestamp")
}

#[tokio::test]
async fn a_breach_starts_its_clocks_and_each_notice_is_recorded_once() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (status, incident) = send(
        &csrf,
        app.client
            .post(app.url("/api/security/incidents"))
            .json(&json!({
                "category": "data_breach",
                "description": "Discharge summaries emailed to the wrong insurer",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{incident}");
    let id = incident["id"].as_str().unwrap_or_default().to_owned();
    let url = |tail: &str| app.url(&format!("/api/security/incidents/{id}/{tail}"));
    let noticed = Utc::now() - Duration::hours(8);
    let assessment = json!({
        "discovered_at": noticed,
        "is_cert_in_reportable": true,
        "is_personal_data_breach": true,
        "breach_data_categories": ["health_records", "contact"],
        "principals_affected_estimate": 40,
    });

    // Without the permission: refused.
    let (nurse_client, nurse_csrf) = nurse(&app, &csrf).await;
    let (status, body) = send(
        &nurse_csrf,
        nurse_client.put(url("breach")).json(&assessment),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");

    // A notice before the incident is assessed has no clock to stop.
    let (status, body) = send(
        &csrf,
        app.client
            .post(url("notices"))
            .json(&json!({ "kind": "cert_in" })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");

    // A breach must name the data involved.
    let mut bare = assessment.clone();
    bare["breach_data_categories"] = json!([]);
    let (status, body) = send(&csrf, app.client.put(url("breach")).json(&bare)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    let (status, assessed) = send(&csrf, app.client.put(url("breach")).json(&assessment)).await;
    assert_eq!(status, StatusCode::OK, "{assessed}");
    let discovered = at(&assessed["discovered_at"]);
    assert_eq!(
        at(&assessed["cert_in_due_at"]),
        discovered + Duration::hours(6)
    );
    assert_eq!(
        at(&assessed["board_due_at"]),
        discovered + Duration::hours(72)
    );

    let cert_in = json!({ "kind": "cert_in", "reference": "CERTIN-2026-0042" });
    let (status, filed) = send(&csrf, app.client.post(url("notices")).json(&cert_in)).await;
    assert_eq!(status, StatusCode::OK, "{filed}");
    assert_eq!(filed["cert_in_reported"], json!(true));
    assert_eq!(filed["cert_in_reference"], json!("CERTIN-2026-0042"));
    let (status, body) = send(&csrf, app.client.post(url("notices")).json(&cert_in)).await;
    assert_eq!(status, StatusCode::CONFLICT, "recorded once: {body}");

    let (status, body) = send(
        &csrf,
        app.client
            .post(url("notices"))
            .json(&json!({ "kind": "principals" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a count is required: {body}"
    );
    let (status, body) = send(
        &csrf,
        app.client
            .post(url("notices"))
            .json(&json!({ "kind": "principals", "count": 38 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // Once notices have gone out, the incident cannot stop being a breach.
    let mut unflag = assessment.clone();
    unflag["is_personal_data_breach"] = json!(false);
    let (status, body) = send(&csrf, app.client.put(url("breach")).json(&unflag)).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");

    let (status, timeline) = send(&csrf, app.client.get(url("updates"))).await;
    assert_eq!(status, StatusCode::OK, "{timeline}");
    let kinds: Vec<String> = timeline
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter_map(|u| u["update_type"].as_str().map(str::to_owned))
        .collect();
    for kind in ["assessment", "cert_in", "principals"] {
        assert!(
            kinds.iter().any(|k| k == kind),
            "{kind} missing from {kinds:?}"
        );
    }

    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log \
         WHERE action = 'security_incident.breach' AND entity_id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert!(
        audited >= 3,
        "every breach act is on the audit chain: {audited}"
    );
}
