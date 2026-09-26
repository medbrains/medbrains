//! Hold (RFCs/modules/RFC-MODULE-token-queues.md, P2b, scenario 31).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn own_department(app: &common::TestApp) -> Uuid {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("HD{suffix}"))
    .bind(format!("Hold {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given A (first), B and C waiting, When A is sent for an ECG and put on hold,
/// Then Call next calls B, not A; And when A is back, A is called before C —
/// their place was kept.
#[tokio::test]
async fn a_patient_on_hold_keeps_their_place_but_is_not_called() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let dept = own_department(&app).await;
    let issue = json!({ "module": "opd", "scope": "department", "scope_id": dept });
    let mut ids = Vec::new();
    for _ in 0..3 {
        let (_, token) = post(&app, &csrf, "/api/tokens/issue", issue.clone()).await;
        ids.push(token["id"].as_str().expect("id").to_owned());
    }
    let (a, b, c) = (&ids[0], &ids[1], &ids[2]);
    let call_next = || post(&app, &csrf, "/api/tokens/call-next", issue.clone());

    let (status, held) = post(
        &app,
        &csrf,
        &format!("/api/tokens/{a}/advance"),
        json!({ "status": "on_hold" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{held}");
    assert_eq!(held["status"], "on_hold");
    assert_eq!(
        call_next().await.1["id"],
        b.as_str(),
        "the held patient is passed over"
    );

    let (status, back) = post(
        &app,
        &csrf,
        &format!("/api/tokens/{a}/advance"),
        json!({ "status": "waiting" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{back}");
    assert_eq!(back["status"], "waiting");
    assert_eq!(
        call_next().await.1["id"],
        a.as_str(),
        "back in the same place, before C"
    );
    assert_eq!(call_next().await.1["id"], c.as_str());
}

/// A held patient who walks back up to the counter can be called at once, and
/// a called patient cannot be put on hold (that is a no-show or a recall).
#[tokio::test]
async fn hold_follows_the_desk() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let dept = own_department(&app).await;
    let issue = json!({ "module": "opd", "scope": "department", "scope_id": dept });
    let (_, token) = post(&app, &csrf, "/api/tokens/issue", issue).await;
    let id = token["id"].as_str().expect("id");

    post(
        &app,
        &csrf,
        &format!("/api/tokens/{id}/advance"),
        json!({ "status": "on_hold" }),
    )
    .await;
    let (status, called) = post(&app, &csrf, &format!("/api/tokens/{id}/call"), json!({})).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "called straight from hold: {called}"
    );

    let (status, body) = post(
        &app,
        &csrf,
        &format!("/api/tokens/{id}/advance"),
        json!({ "status": "on_hold" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.to_string().contains("cannot be set to on hold"),
        "{body}"
    );
}
