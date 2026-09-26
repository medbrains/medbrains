//! Configured queues (RFCs/modules/RFC-MODULE-token-queues.md, P1a,
//! scenarios 1, 3, 4 and 5).

mod common;

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
    .bind(format!("QC{suffix}"))
    .bind(format!("Queue config {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

async fn configure(app: &common::TestApp, csrf: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/queues"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("create queue");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn queue(department: Uuid, extra: Value) -> Value {
    let mut body = json!({
        "name": "General OPD", "module": "opd", "scope": "department", "scope_id": department,
        "prefix": "gen", "start_at": 100, "pad_width": 3, "reset_rule": "daily",
        "max_tokens_per_period": null, "lifecycle": "permanent",
        "valid_from": null, "valid_until": null, "status": "active",
        "early_issue_minutes": 0,
    });
    if let (Some(base), Some(add)) = (body.as_object_mut(), extra.as_object()) {
        base.extend(add.clone());
    }
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

/// Scenario 1 — Given the admin sets prefix GEN from 100, Then the next tokens
/// are GEN-100, GEN-101 (the prefix is upper-cased, as a slip needs).
#[tokio::test]
async fn the_admins_numbering_is_the_number_on_the_slip() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (status, _) = configure(&app, &csrf, queue(department, json!({}))).await;
    assert_eq!(status, StatusCode::OK);

    let (_, first) = issue(&app, &csrf, department).await;
    let (_, second) = issue(&app, &csrf, department).await;
    assert_eq!(first["number"], "GEN-100");
    assert_eq!(second["number"], "GEN-101");
}

/// Scenario 3 — Given a limit of 2, When a third token is asked for, Then the
/// desk is told the queue is full, in words, not an error.
#[tokio::test]
async fn a_full_queue_says_so() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    configure(
        &app,
        &csrf,
        queue(department, json!({ "max_tokens_per_period": 2 })),
    )
    .await;
    for _ in 0..2 {
        assert_eq!(issue(&app, &csrf, department).await.0, StatusCode::OK);
    }
    let (status, body) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(
        body.to_string().contains("full for today — 2 of 2"),
        "{body}"
    );
}

/// Scenario 4 — a paused queue, and a camp queue outside its days, take nobody.
#[tokio::test]
async fn a_paused_or_finished_queue_takes_nobody() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let paused = own_department(&app).await;
    configure(&app, &csrf, queue(paused, json!({ "status": "paused" }))).await;
    let (status, body) = issue(&app, &csrf, paused).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body.to_string().contains("is paused"), "{body}");

    let camp = own_department(&app).await;
    configure(
        &app,
        &csrf,
        queue(
            camp,
            json!({ "name": "Village camp", "lifecycle": "temporary",
                    "valid_from": "2020-01-01", "valid_until": "2020-01-02" }),
        ),
    )
    .await;
    let (status, body) = issue(&app, &csrf, camp).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(
        body.to_string().contains("runs 01 Jan to 02 Jan only"),
        "{body}"
    );
}

/// Scenario 5 — one live queue per module and place; closing frees the place.
#[tokio::test]
async fn one_live_queue_per_place() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, first) = configure(&app, &csrf, queue(department, json!({}))).await;
    let (status, _) = configure(&app, &csrf, queue(department, json!({ "prefix": "B" }))).await;
    assert_eq!(status, StatusCode::CONFLICT);

    let id = first["id"].as_str().expect("queue id");
    let resp = app
        .client
        .put(app.url(&format!("/api/queues/{id}")))
        .header("x-csrf-token", &csrf)
        .json(&queue(department, json!({ "status": "closed" })))
        .send()
        .await
        .expect("close");
    assert_eq!(resp.status(), StatusCode::OK);
    let (status, _) = configure(&app, &csrf, queue(department, json!({ "prefix": "B" }))).await;
    assert_eq!(status, StatusCode::OK, "a closed queue frees its place");
}

/// A place nobody configured keeps the built-in numbering.
#[tokio::test]
async fn an_unconfigured_place_is_unchanged() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, token) = issue(&app, &csrf, department).await;
    assert_eq!(token["number"], "T-001");
    assert!(token.get("queue_id").is_none_or(Value::is_null));
}

async fn set_categories(
    app: &common::TestApp,
    csrf: &str,
    queue_id: &str,
    body: Value,
) -> StatusCode {
    app.client
        .put(app.url(&format!("/api/queues/{queue_id}/categories")))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("set categories")
        .status()
}

async fn issue_with(
    app: &common::TestApp,
    csrf: &str,
    department: Uuid,
    priority: &str,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "module": "opd", "scope": "department", "scope_id": department, "priority": priority }))
        .send()
        .await
        .expect("issue");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn call_next(app: &common::TestApp, csrf: &str, department: Uuid) -> Value {
    app.client
        .post(app.url("/api/tokens/call-next"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "module": "opd", "scope": "department", "scope_id": department }))
        .send()
        .await
        .expect("call next")
        .json()
        .await
        .expect("called token")
}

fn lane(code: &str, label: &str, rank: i16) -> Value {
    json!({ "code": code, "label": label, "rank": rank, "kiosk_selectable": false, "is_active": true })
}

/// P1b, scenario 9 — Given a queue with a "Staff" lane ahead of normal, When a
/// normal patient arrives first, Then staff is called first; And an urgent
/// patient still beats every configured lane.
#[tokio::test]
async fn a_queue_calls_its_own_lanes_but_never_ahead_of_an_emergency() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, q) = configure(&app, &csrf, queue(department, json!({ "start_at": 1 }))).await;
    let queue_id = q["id"].as_str().expect("queue id");
    let status = set_categories(
        &app,
        &csrf,
        queue_id,
        json!([lane("staff", "Staff", 3), lane("normal", "General", 6)]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (_, normal) = issue_with(&app, &csrf, department, "normal").await;
    let (_, staff) = issue_with(&app, &csrf, department, "staff").await;
    assert_eq!(
        staff["priority_label"], "Staff",
        "the console shows the queue's own name"
    );
    let (_, urgent) = issue_with(&app, &csrf, department, "urgent").await;

    assert_eq!(call_next(&app, &csrf, department).await["id"], urgent["id"]);
    assert_eq!(call_next(&app, &csrf, department).await["id"], staff["id"]);
    assert_eq!(call_next(&app, &csrf, department).await["id"], normal["id"]);
}

/// A protected patient is never ordered behind an ordinary one, no emergency
/// lane can be configured, and a lane the queue does not offer is refused.
#[tokio::test]
async fn category_rules_that_protect_patients() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, q) = configure(&app, &csrf, queue(department, json!({}))).await;
    let queue_id = q["id"].as_str().expect("queue id");

    let behind = json!([
        lane("elderly", "Senior citizen", 8),
        lane("normal", "General", 5)
    ]);
    assert_eq!(
        set_categories(&app, &csrf, queue_id, behind).await,
        StatusCode::BAD_REQUEST
    );
    let emergency = json!([lane("urgent", "Fast track", 3)]);
    assert_eq!(
        set_categories(&app, &csrf, queue_id, emergency).await,
        StatusCode::BAD_REQUEST
    );

    let (status, _) = issue_with(&app, &csrf, department, "staff").await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "this queue offers no staff lane"
    );
}

async fn set_sessions(
    app: &common::TestApp,
    csrf: &str,
    queue_id: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .put(app.url(&format!("/api/queues/{queue_id}/sessions")))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("set sessions");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// The hospital's local time now, as HH:MM, and minutes since midnight.
async fn local_minutes(app: &common::TestApp) -> i64 {
    sqlx::query_scalar(
        "SELECT (EXTRACT(HOUR FROM now() AT TIME ZONE t.timezone) * 60 \
                 + EXTRACT(MINUTE FROM now() AT TIME ZONE t.timezone))::bigint \
           FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("local time")
}

fn hhmm(minutes: i64) -> String {
    if minutes >= 24 * 60 {
        return "23:59:59".to_owned();
    }
    let m = minutes.max(0);
    format!("{:02}:{:02}:00", m / 60, m % 60)
}

/// P1c, scenario 22 — Given OPD tokens are given out 09:00–13:00 only, When the
/// desk asks outside those hours, Then it is told when tokens resume (or that
/// the queue has closed for today), not given a token.
#[tokio::test]
async fn outside_its_hours_a_queue_says_when_tokens_resume() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, q) = configure(&app, &csrf, queue(department, json!({}))).await;
    let queue_id = q["id"].as_str().expect("queue id");
    let now = local_minutes(&app).await;
    // A session two hours ahead, or — late at night — one that has ended.
    let (opens, closes, expected) = if now < 20 * 60 {
        (
            now + 120,
            now + 180,
            format!("is closed — tokens from {}", &hhmm(now + 120)[..5]),
        )
    } else {
        (now - 180, now - 120, "has closed for today".to_owned())
    };
    let hours = json!([{ "label": "Clinic", "days": [], "opens": hhmm(opens), "closes": hhmm(closes), "prefix": null }]);
    assert_eq!(
        set_sessions(&app, &csrf, queue_id, hours).await.0,
        StatusCode::OK
    );

    let (status, body) = issue(&app, &csrf, department).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains(&expected), "{expected} in {body}");

    // Clearing the hours gives tokens out all day again.
    assert_eq!(
        set_sessions(&app, &csrf, queue_id, json!([])).await.0,
        StatusCode::OK
    );
    assert_eq!(issue(&app, &csrf, department).await.0, StatusCode::OK);
}

/// P1c, scenario 2 — a queue that restarts its numbers each session numbers
/// under the session's own prefix, and refuses hours that would let two
/// waiting patients hold the same number.
#[tokio::test]
async fn a_session_queue_numbers_under_the_sessions_prefix() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = own_department(&app).await;
    let (_, q) = configure(&app, &csrf, queue(department, json!({ "start_at": 1 }))).await;
    let queue_id = q["id"].as_str().expect("queue id");
    let now = local_minutes(&app).await;
    let current = json!({ "label": "Now", "days": [], "opens": hhmm(now - 60), "closes": hhmm(now + 60), "prefix": "m" });
    assert_eq!(
        set_sessions(&app, &csrf, queue_id, json!([current]))
            .await
            .0,
        StatusCode::OK
    );

    let to_session = queue(
        department,
        json!({ "start_at": 1, "reset_rule": "session" }),
    );
    let resp = app
        .client
        .put(app.url(&format!("/api/queues/{queue_id}")))
        .header("x-csrf-token", &csrf)
        .json(&to_session)
        .send()
        .await
        .expect("switch to session numbering");
    assert_eq!(resp.status(), StatusCode::OK);

    let (_, first) = issue(&app, &csrf, department).await;
    let (_, second) = issue(&app, &csrf, department).await;
    assert_eq!(first["number"], "M-001", "the session prefix, upper-cased");
    assert_eq!(second["number"], "M-002");

    // Two sessions with no prefix of their own would both hand out M-001.
    let same = json!([
        { "label": "Morning", "days": [], "opens": "09:00:00", "closes": "13:00:00", "prefix": null },
        { "label": "Evening", "days": [], "opens": "16:00:00", "closes": "19:00:00", "prefix": null },
    ]);
    let (status, body) = set_sessions(&app, &csrf, queue_id, same).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
}
