//! Where a returning no-show goes back — GitHub #1520.
//!
//! Requeue existed but always sent the patient to the very back. For someone
//! who stepped out for two minutes that means sitting through the whole
//! afternoon again, which is why desks quietly refuse to do it and wave the
//! patient in instead — the queue then says one thing and the room does another.
//!
//! The issue names the two policies a hospital may want: back of the queue, or
//! a few places down. These tests pin both, and pin that the position promised
//! is the position `call_next` actually honours.

mod common;

use reqwest::StatusCode;
use std::sync::LazyLock;
use uuid::Uuid;

/// The recall policy is one row per tenant, and these tests share a tenant, so
/// they cannot set it concurrently — one test's teardown is another's setting.
/// The queue itself is still isolated per test by its own department; only the
/// policy needs serialising.
static POLICY: LazyLock<tokio::sync::Mutex<()>> = LazyLock::new(|| tokio::sync::Mutex::new(()));

async fn tenant_of(app: &common::TestApp) -> Uuid {
    let row: (Uuid,) = sqlx::query_as("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    row.0
}

/// A department of this test's own — these suites share one database and run
/// concurrently, and this one renumbers a whole queue.
async fn a_department(app: &common::TestApp, tenant: Uuid) -> Uuid {
    // Codes are constrained to ^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$.
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("RC{suffix}"))
    .bind(format!("Recall {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("create an isolated department");
    row.0
}

/// The whole point of the issue is that this is configurable, so the tests set
/// it the way an admin screen would.
async fn set_recall_after(app: &common::TestApp, tenant: Uuid, after: Option<i64>) {
    match after {
        Some(n) => {
            sqlx::query(
                "INSERT INTO tenant_settings (tenant_id, category, key, value) \
                 VALUES ($1, 'queue', 'missed_token_recall_after', $2::jsonb) \
                 ON CONFLICT (tenant_id, category, key) \
                 DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL",
            )
            .bind(tenant)
            .bind(n.to_string())
            .execute(&app.db)
            .await
            .expect("set the recall policy");
        }
        None => {
            sqlx::query(
                "DELETE FROM tenant_settings \
                 WHERE tenant_id = $1 AND category = 'queue' \
                   AND key = 'missed_token_recall_after'",
            )
            .bind(tenant)
            .execute(&app.db)
            .await
            .expect("clear the recall policy");
        }
    }
}

async fn issue(app: &common::TestApp, csrf: &str, department: Uuid) -> serde_json::Value {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": Uuid::new_v4(),
        }))
        .send()
        .await
        .expect("issue request");
    assert_eq!(resp.status(), StatusCode::OK, "issue should succeed");
    resp.json().await.expect("issued token json")
}

async fn no_show_then_requeue(
    app: &common::TestApp,
    csrf: &str,
    token: &serde_json::Value,
) -> serde_json::Value {
    let id = token["id"].as_str().expect("token id");
    for step in ["no-show", "requeue"] {
        let resp = app
            .client
            .post(app.url(&format!("/api/tokens/{id}/{step}")))
            .header("x-csrf-token", csrf)
            .send()
            .await
            .expect("transition request");
        let status = resp.status();
        let body = resp.text().await.expect("body");
        assert_eq!(status, StatusCode::OK, "{step} failed: {body}");
        if step == "requeue" {
            return serde_json::from_str(&body).expect("requeued token json");
        }
    }
    unreachable!()
}

/// How many waiting tokens this queue would call before the given one.
async fn ahead_of(app: &common::TestApp, department: Uuid, token: &serde_json::Value) -> i64 {
    let seq = token["seq"].as_i64().expect("seq");
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tokens \
          WHERE module = 'opd' AND scope = 'department' AND scope_id = $1 \
            AND token_date = CURRENT_DATE AND status = 'waiting' AND seq < $2",
    )
    .bind(department)
    .bind(seq)
    .fetch_one(&app.db)
    .await
    .expect("count ahead");
    row.0
}

/// Given no policy configured — which is every tenant until an admin says
/// otherwise — When a returning patient is requeued, Then they go to the back,
/// exactly as before this change.
#[tokio::test]
async fn the_default_is_still_the_back_of_the_queue() {
    let _policy = POLICY.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of(&app).await;
    let department = a_department(&app, tenant).await;
    set_recall_after(&app, tenant, None).await;

    let missed = issue(&app, &csrf, department).await;
    for _ in 0..4 {
        issue(&app, &csrf, department).await;
    }

    let back = no_show_then_requeue(&app, &csrf, &missed).await;
    assert_eq!(
        ahead_of(&app, department, &back).await,
        4,
        "with no policy set the returning patient waits behind everybody",
    );
}

/// Given a hospital that recalls after 3, When a returning patient is requeued,
/// Then exactly three patients are called before them — not the whole queue.
#[tokio::test]
async fn a_configured_recall_puts_them_three_places_down() {
    let _policy = POLICY.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of(&app).await;
    let department = a_department(&app, tenant).await;
    set_recall_after(&app, tenant, Some(3)).await;

    let missed = issue(&app, &csrf, department).await;
    for _ in 0..5 {
        issue(&app, &csrf, department).await;
    }

    let recalled = no_show_then_requeue(&app, &csrf, &missed).await;
    assert_eq!(
        ahead_of(&app, department, &recalled).await,
        3,
        "the patient waits behind three people and no more",
    );

    set_recall_after(&app, tenant, None).await;
}

/// Given a recall policy but a queue shorter than it, When a patient is
/// requeued, Then they go to the back. There is no fourth place to hold in a
/// queue of two, and inventing one would put them ahead of people still waiting.
#[tokio::test]
async fn a_short_queue_falls_back_to_the_end() {
    let _policy = POLICY.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of(&app).await;
    let department = a_department(&app, tenant).await;
    set_recall_after(&app, tenant, Some(3)).await;

    let missed = issue(&app, &csrf, department).await;
    issue(&app, &csrf, department).await;

    let recalled = no_show_then_requeue(&app, &csrf, &missed).await;
    assert_eq!(
        ahead_of(&app, department, &recalled).await,
        1,
        "only one patient was waiting, so the back is one place down",
    );

    set_recall_after(&app, tenant, None).await;
}

/// Given a recall that opens a place mid-queue, When the queue is read, Then
/// everyone who was already waiting keeps their order relative to each other.
///
/// They each lose one place to the returning patient — that is the policy — but
/// nobody may overtake anybody else as a side effect of the renumbering.
#[tokio::test]
async fn nobody_waiting_is_reordered_against_anybody_else() {
    let _policy = POLICY.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of(&app).await;
    let department = a_department(&app, tenant).await;
    set_recall_after(&app, tenant, Some(2)).await;

    let missed = issue(&app, &csrf, department).await;
    let mut others = Vec::new();
    for _ in 0..5 {
        others.push(issue(&app, &csrf, department).await);
    }

    no_show_then_requeue(&app, &csrf, &missed).await;

    let order: Vec<(Uuid, i32)> = sqlx::query_as(
        "SELECT id, seq FROM tokens \
          WHERE module = 'opd' AND scope = 'department' AND scope_id = $1 \
            AND token_date = CURRENT_DATE AND status = 'waiting' \
          ORDER BY seq",
    )
    .bind(department)
    .fetch_all(&app.db)
    .await
    .expect("read the queue");

    let position = |id: &str| {
        let id: Uuid = id.parse().expect("uuid");
        order.iter().position(|(row, _)| *row == id)
    };
    let mut previous = None;
    for token in &others {
        let at = position(token["id"].as_str().expect("id")).expect("still waiting");
        if let Some(before) = previous {
            assert!(
                at > before,
                "tokens issued in order must still be in that order",
            );
        }
        previous = Some(at);
    }

    set_recall_after(&app, tenant, None).await;
}

/// Given a recalled patient, When the room calls next repeatedly, Then they are
/// called in the position they were promised.
///
/// The count and the call order are computed separately, so this is the
/// assertion that actually matters: a position the queue does not honour is
/// worse than no policy at all.
#[tokio::test]
async fn the_promised_position_is_the_one_that_gets_called() {
    let _policy = POLICY.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant_of(&app).await;
    let department = a_department(&app, tenant).await;
    set_recall_after(&app, tenant, Some(2)).await;

    let missed = issue(&app, &csrf, department).await;
    for _ in 0..4 {
        issue(&app, &csrf, department).await;
    }
    let recalled = no_show_then_requeue(&app, &csrf, &missed).await;

    // Two patients ahead, so the recalled token is the third one called.
    let mut called_third = None;
    for turn in 1..=3 {
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
        if turn == 3 {
            called_third = called["id"].as_str().map(ToOwned::to_owned);
        }
    }

    assert_eq!(
        called_third.as_deref(),
        recalled["id"].as_str(),
        "recalled after two, so the third call must be theirs",
    );

    set_recall_after(&app, tenant, None).await;
}
