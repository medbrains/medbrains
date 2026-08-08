//! One token number for one visit — GitHub #1521.
//!
//! A patient walking OPD -> lab -> pharmacy should hold one slip, not three.
//! What must not change is who gets called: `seq` still orders every board, so
//! sharing the displayed number is the only behaviour these tests allow to move.

mod common;

use reqwest::StatusCode;
use uuid::Uuid;

/// A department of this test's own.
///
/// These tests run concurrently against one database, and a queue is keyed by
/// (module, scope, scope_id) — so sharing a seeded department would mean each
/// test counting and calling other tests' tokens. Position and call order can
/// only be asserted in a queue nobody else is writing to.
async fn a_department(app: &common::TestApp) -> Uuid {
    let tenant: (Uuid,) = sqlx::query_as("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    // Codes are constrained to ^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$.
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant.0)
    .bind(format!("VT{suffix}"))
    .bind(format!("Visit Test {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("create an isolated department");
    row.0
}

async fn issue(app: &common::TestApp, csrf: &str, body: serde_json::Value) -> serde_json::Value {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("issue request");
    assert_eq!(resp.status(), StatusCode::OK, "issue should succeed");
    resp.json().await.expect("issued token json")
}

fn number_of(token: &serde_json::Value) -> String {
    token["number"].as_str().expect("token number").to_owned()
}

fn seq_of(token: &serde_json::Value) -> i64 {
    token["seq"].as_i64().expect("token seq")
}

/// Given a patient registered and then sent to lab and pharmacy on one visit,
/// When each token is issued, Then all three carry the same number while each
/// keeps its own department sequence.
#[tokio::test]
async fn one_visit_carries_one_number_across_departments() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;
    let patient = Uuid::new_v4();
    let visit = Uuid::new_v4();

    let opd = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": patient, "visit_id": visit,
        }),
    )
    .await;
    let lab = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "lab", "scope": "department", "scope_id": department,
            "patient_id": patient, "visit_id": visit,
        }),
    )
    .await;
    let pharmacy = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "pharmacy", "scope": "department", "scope_id": department,
            "patient_id": patient, "visit_id": visit,
        }),
    )
    .await;

    assert_eq!(
        number_of(&lab),
        number_of(&opd),
        "the lab token should reuse the visit's number"
    );
    assert_eq!(
        number_of(&pharmacy),
        number_of(&opd),
        "the pharmacy token should reuse the visit's number",
    );

    // Each department still numbered its own position independently.
    assert!(seq_of(&opd) >= 1 && seq_of(&lab) >= 1 && seq_of(&pharmacy) >= 1);
}

/// Given a shared number, When a board calls next, Then it calls in `seq` order
/// exactly as before — the visit number must not influence who is called.
#[tokio::test]
async fn a_shared_number_does_not_change_who_is_called() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    // First in the queue is an ordinary token; a visit token joins behind it.
    let first = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": Uuid::new_v4(),
        }),
    )
    .await;
    let second = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": Uuid::new_v4(), "visit_id": Uuid::new_v4(),
        }),
    )
    .await;
    assert!(seq_of(&first) < seq_of(&second));

    let called: serde_json::Value = app
        .client
        .post(app.url("/api/tokens/call-next"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
        }))
        .send()
        .await
        .expect("call next")
        .json()
        .await
        .expect("called json");

    assert_eq!(
        called["id"], first["id"],
        "call order follows seq; a visit number must not jump the queue",
    );
}

/// Given the same patient attending twice in one day, When the second visit
/// issues a token, Then it gets its own number — the date is not the visit.
#[tokio::test]
async fn a_second_visit_the_same_day_gets_its_own_number() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;
    let patient = Uuid::new_v4();

    let morning = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": patient, "visit_id": Uuid::new_v4(),
        }),
    )
    .await;
    let evening = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": patient, "visit_id": Uuid::new_v4(),
        }),
    )
    .await;

    assert_ne!(
        number_of(&evening),
        number_of(&morning),
        "a separate visit is a separate slip, even on the same day",
    );
}

/// Given a token with people ahead of it, When the patient's tokens are read,
/// Then the position is reported — without it a shared number is unreadable on
/// a board.
#[tokio::test]
async fn my_tokens_reports_how_many_are_ahead() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;
    let patient = Uuid::new_v4();

    for _ in 0..3 {
        issue(
            &app,
            &csrf,
            serde_json::json!({
                "module": "opd", "scope": "department", "scope_id": department,
                "patient_id": Uuid::new_v4(),
            }),
        )
        .await;
    }
    issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": patient, "visit_id": Uuid::new_v4(),
        }),
    )
    .await;

    let mine: serde_json::Value = app
        .client
        .get(app.url(&format!("/api/tokens/mine?patient_id={patient}")))
        .send()
        .await
        .expect("my tokens")
        .json()
        .await
        .expect("my tokens json");

    let ahead = mine[0]["ahead"].as_i64().expect("ahead count");
    assert_eq!(ahead, 3, "three people were queued before them");

    // The token's own fields must stay at the top level. Adding position by
    // nesting the token one level down would break every existing client
    // silently, since they read `number` and `status` directly.
    assert!(
        mine[0]["number"].is_string(),
        "the response must stay flat, not nest the token"
    );
    assert!(
        mine[0]["status"].is_string(),
        "the response must stay flat, not nest the token"
    );
}

/// Given a priority case queued behind ordinary tokens, When position is read,
/// Then it reflects the call order rather than arrival — position must agree
/// with what `call_next` will actually do.
#[tokio::test]
async fn position_follows_priority_not_arrival() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;
    let patient = Uuid::new_v4();

    for _ in 0..2 {
        issue(
            &app,
            &csrf,
            serde_json::json!({
                "module": "opd", "scope": "department", "scope_id": department,
                "patient_id": Uuid::new_v4(),
            }),
        )
        .await;
    }
    issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": patient, "priority": "stat",
        }),
    )
    .await;

    let mine: serde_json::Value = app
        .client
        .get(app.url(&format!("/api/tokens/mine?patient_id={patient}")))
        .send()
        .await
        .expect("my tokens")
        .json()
        .await
        .expect("my tokens json");

    assert_eq!(
        mine[0]["ahead"].as_i64().expect("ahead count"),
        0,
        "a stat case is called first, so nobody is ahead of them",
    );
}

/// Given a module issuing without a visit, When the token is issued, Then it is
/// numbered exactly as before. Every caller that has not adopted visits yet must
/// be unaffected.
#[tokio::test]
async fn a_token_without_a_visit_numbers_as_before() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    let token = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": Uuid::new_v4(),
        }),
    )
    .await;

    assert!(token["visit_id"].is_null(), "no visit was asked for");
    assert_eq!(
        number_of(&token),
        format!("T-{:03}", seq_of(&token)),
        "an unvisited token still numbers from its own department sequence",
    );
}
