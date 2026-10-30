//! Recycled token numbers with a cool-off (RFCs/modules/RFC-MODULE-token-queues.md, P1d).
//!
//! A pharmacy calling 1 to 3 gives each number out again — but only once its
//! last holder finished at least the cool-off ago, and never while a holder can
//! still be called back. A second holder in the meantime is the wrong patient
//! handed the wrong medicine.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn own_department(app: &common::TestApp) -> Uuid {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("RC{suffix}"))
    .bind(format!("Recycling {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

/// A pharmacy pickup queue 1 .. 3 with the given rule, under a prefix of its
/// own: held numbers are checked across the hospital, and the dev database
/// keeps every earlier run's tokens.
async fn configure(app: &common::TestApp, csrf: &str, department: Uuid, extra: Value) -> Value {
    let prefix = format!(
        "R{}",
        &Uuid::new_v4().simple().to_string()[..5].to_uppercase()
    );
    let mut body = json!({
        "name": "Pharmacy pickup", "module": "opd", "scope": "department",
        "scope_id": department, "prefix": prefix, "start_at": 1, "pad_width": 1,
        "reset_rule": "recycle", "number_pool_size": 3, "reuse_cooloff_minutes": 30,
        "max_tokens_per_period": null, "lifecycle": "permanent",
        "valid_from": null, "valid_until": null, "status": "active",
        "early_issue_minutes": 0,
    });
    if let (Some(base), Some(add)) = (body.as_object_mut(), extra.as_object()) {
        base.extend(add.clone());
    }
    let resp = app
        .client
        .post(app.url("/api/queues"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("create queue");
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    assert_eq!(status, StatusCode::OK, "{body}");
    body
}

async fn issue(app: &common::TestApp, csrf: &str, department: Uuid) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "module": "opd", "scope": "department", "scope_id": department }))
        .send()
        .await
        .expect("issue");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn number(app: &common::TestApp, csrf: &str, department: Uuid) -> String {
    let (status, body) = issue(app, csrf, department).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["number"].as_str().unwrap_or_default().to_owned()
}

async fn step(app: &common::TestApp, csrf: &str, token: &Value, action: &str) {
    let id = token["id"].as_str().unwrap_or_default();
    let resp = app
        .client
        .post(app.url(&format!("/api/tokens/{id}/{action}")))
        .header("x-csrf-token", csrf)
        .json(&json!({}))
        .send()
        .await
        .expect("advance");
    assert_eq!(resp.status(), StatusCode::OK, "{action}");
}

/// Served and gone: as long ago as the test says.
async fn finished_minutes_ago(app: &common::TestApp, csrf: &str, token: &Value, minutes: i32) {
    step(app, csrf, token, "call").await;
    step(app, csrf, token, "complete").await;
    let id: Uuid = token["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or_default();
    sqlx::query("UPDATE tokens SET completed_at = now() - make_interval(mins => $2) WHERE id = $1")
        .bind(id)
        .bind(minutes)
        .execute(&app.db)
        .await
        .expect("backdate");
}

/// Given P-1 finished 10 minutes ago and the cool-off is 30, the next token is
/// not P-1; once 31 minutes have passed, P-1 goes round again.
#[tokio::test]
async fn a_number_waits_out_its_cooloff() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let queue = configure(&app, &csrf, department, json!({})).await;
    let p = |n: i32| format!("{}-{n}", queue["prefix"].as_str().unwrap_or_default());

    let (_, first) = issue(&app, &csrf, department).await;
    assert_eq!(first["number"], p(1).as_str());
    finished_minutes_ago(&app, &csrf, &first, 10).await;
    assert_eq!(number(&app, &csrf, department).await, p(2));
    assert_eq!(number(&app, &csrf, department).await, p(3));

    // All three in use or cooling: the desk is told when one frees up.
    let (status, body) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(
        body.to_string()
            .contains("All 3 numbers of Pharmacy pickup are in use or cooling off — next free at"),
        "{body}"
    );

    let id: Uuid = first["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or_default();
    sqlx::query("UPDATE tokens SET completed_at = now() - interval '31 minutes' WHERE id = $1")
        .bind(id)
        .execute(&app.db)
        .await
        .expect("backdate");
    let (status, again) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["number"], p(1).as_str());
    // The queue still orders by arrival: the reused number is the newest place.
    assert!(again["seq"].as_i64() > first["seq"].as_i64(), "{again}");
}

/// A waiting token, and today's no-show the desk can still requeue, keep their
/// numbers however long ago anything finished.
#[tokio::test]
async fn a_live_or_recallable_number_is_never_reissued() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let queue = configure(
        &app,
        &csrf,
        department,
        json!({ "number_pool_size": 2, "reuse_cooloff_minutes": 0 }),
    )
    .await;
    let prefix = queue["prefix"].as_str().unwrap_or_default();

    let (_, waiting) = issue(&app, &csrf, department).await;
    let (_, missed) = issue(&app, &csrf, department).await;
    assert_eq!(
        (waiting["number"].as_str(), missed["number"].as_str()),
        (
            Some(format!("{prefix}-1").as_str()),
            Some(format!("{prefix}-2").as_str())
        )
    );
    step(&app, &csrf, &missed, "no-show").await;

    let (status, body) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.to_string()
            .contains("All 2 numbers of Pharmacy pickup are in use"),
        "{body}"
    );

    // Back from the no-show: still the same number, and still nobody else's.
    step(&app, &csrf, &missed, "requeue").await;
    assert_eq!(issue(&app, &csrf, department).await.0, StatusCode::CONFLICT);
}

/// Ten desks at once never hand out the same number twice.
#[tokio::test]
async fn concurrent_issues_never_share_a_number() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    configure(&app, &csrf, department, json!({ "number_pool_size": 20 })).await;

    let numbers = futures::future::join_all((0..10).map(|_| number(&app, &csrf, department))).await;
    let distinct: std::collections::HashSet<_> = numbers.iter().collect();
    assert_eq!(distinct.len(), 10, "{numbers:?}");
}

/// Daily and never-reset queues number exactly as before.
#[tokio::test]
async fn daily_and_never_are_unchanged() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    for rule in ["daily", "never"] {
        let department = own_department(&app).await;
        let queue = configure(
            &app,
            &csrf,
            department,
            json!({ "reset_rule": rule, "number_pool_size": 3, "start_at": 100, "pad_width": 3 }),
        )
        .await;
        // A pool means nothing outside recycling, and is not kept.
        assert_eq!(queue["number_pool_size"], Value::Null, "{queue}");
        let (_, first) = issue(&app, &csrf, department).await;
        finished_minutes_ago(&app, &csrf, &first, 600).await;
        let prefix = queue["prefix"].as_str().unwrap_or_default();
        let numbers = [
            first["number"].as_str().unwrap_or_default().to_owned(),
            number(&app, &csrf, department).await,
            number(&app, &csrf, department).await,
            number(&app, &csrf, department).await,
        ];
        let expected = (100..104)
            .map(|n| format!("{prefix}-{n}"))
            .collect::<Vec<_>>();
        assert_eq!(numbers.to_vec(), expected, "{rule}");
    }
}

/// A recycling queue with no pool is refused, in words.
#[tokio::test]
async fn a_recycling_queue_needs_a_pool() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let resp = app
        .client
        .post(app.url("/api/queues"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "name": "No pool", "module": "opd", "scope": "department", "scope_id": department,
            "prefix": "P", "start_at": 1, "pad_width": 2, "reset_rule": "recycle",
            "max_tokens_per_period": null, "lifecycle": "permanent",
            "valid_from": null, "valid_until": null, "status": "active",
        }))
        .send()
        .await
        .expect("create queue");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = resp.text().await.unwrap_or_default();
    assert!(body.contains("needs how many go round"), "{body}");
}

/// Given P-1 was seen and its number has gone round to the next patient, When
/// a stale console tries to put the first P-1 back in the queue, Then it is
/// refused in words — two waiting P-1s is the mix-up recycling must prevent.
#[tokio::test]
async fn a_finished_token_whose_number_went_round_cannot_be_requeued() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    configure(
        &app,
        &csrf,
        department,
        json!({ "number_pool_size": 1, "reuse_cooloff_minutes": 0 }),
    )
    .await;

    let (_, first) = issue(&app, &csrf, department).await;
    finished_minutes_ago(&app, &csrf, &first, 1).await;
    let (status, second) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_eq!(second["number"], first["number"]);

    let id = first["id"].as_str().unwrap_or_default();
    let resp = app
        .client
        .post(app.url(&format!("/api/tokens/{id}/requeue")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("requeue");
    assert_eq!(resp.status(), StatusCode::CONFLICT);
    let body = resp.text().await.unwrap_or_default();
    assert!(body.contains("was already seen"), "{body}");
}
