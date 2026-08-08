//! Queue position and wait estimate — GitHub #1125.
//!
//! The feature was marked Done, but the estimate was `position * 5` and the
//! position ignored priority while the queue is called priority-first. So the
//! number a patient was given disagreed with the order they would be called in,
//! and the minutes attached to it were a constant.
//!
//! These tests pin the part that matters: the position must agree with the call
//! order. The pace is measured from the department's own throughput, which no
//! fixed assertion can pin without freezing the clock — so it is checked for
//! self-consistency rather than an exact figure.

mod common;

use reqwest::StatusCode;
use uuid::Uuid;

/// A department of this test's own — these suites share one database and run
/// concurrently, so a queue anyone else writes to cannot be asserted on.
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
    .bind(format!("WT{suffix}"))
    .bind(format!("Wait Test {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("create an isolated department");
    row.0
}

async fn create_token(
    app: &common::TestApp,
    csrf: &str,
    department: Uuid,
    priority: &str,
) -> serde_json::Value {
    let resp = app
        .client
        .post(app.url("/api/tv/tokens"))
        .header("x-csrf-token", csrf)
        // No patient: queue_tokens.patient_id carries an FK to patients, and
        // these tests are about queue position, not who is in the queue.
        .json(&serde_json::json!({
            "department_id": department,
            "priority": priority,
        }))
        .send()
        .await
        .expect("create token request");
    let status = resp.status();
    let body = resp.text().await.expect("response body");
    assert_eq!(status, StatusCode::OK, "token creation failed: {body}");
    serde_json::from_str(&body).expect("token json")
}

/// `queue_position` is 1-based — 1 means "you are next" — so the number of
/// people ahead is one less.
fn position_of(token: &serde_json::Value) -> i64 {
    token["queue_position"].as_i64().expect("queue_position")
}

fn ahead_of(token: &serde_json::Value) -> i64 {
    position_of(token) - 1
}

fn wait_of(token: &serde_json::Value) -> i64 {
    token["estimated_wait_minutes"]
        .as_i64()
        .expect("estimated_wait_minutes")
}

/// Given ordinary patients already waiting, When another ordinary patient takes
/// a token, Then their position counts everyone ahead of them.
#[tokio::test]
async fn position_counts_the_ordinary_queue() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    for _ in 0..3 {
        create_token(&app, &csrf, department, "normal").await;
    }
    let mine = create_token(&app, &csrf, department, "normal").await;

    assert_eq!(
        ahead_of(&mine),
        3,
        "three ordinary patients were already waiting"
    );
}

/// Given emergency cases waiting, When an ordinary patient takes a token, Then
/// they are counted behind those cases — the queue is called priority-first, so
/// a position that ignored priority was a promise the queue would not keep.
#[tokio::test]
async fn an_ordinary_patient_is_counted_behind_priority_cases() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    create_token(&app, &csrf, department, "normal").await;
    create_token(&app, &csrf, department, "emergency_referral").await;
    create_token(&app, &csrf, department, "pregnant").await;

    let mine = create_token(&app, &csrf, department, "normal").await;
    assert_eq!(
        ahead_of(&mine),
        3,
        "one ordinary patient plus two priority cases are all called first",
    );
}

/// Given ordinary patients waiting, When a priority case arrives, Then it is
/// counted ahead of them rather than behind — arriving last does not mean being
/// seen last.
#[tokio::test]
async fn a_priority_case_jumps_the_queue_in_the_count_too() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    for _ in 0..4 {
        create_token(&app, &csrf, department, "normal").await;
    }
    let urgent = create_token(&app, &csrf, department, "emergency_referral").await;

    assert_eq!(
        position_of(&urgent),
        1,
        "an emergency case is called next, however many ordinary patients wait",
    );
}

/// Given a department with no completed patients yet, When a token is issued,
/// Then the estimate falls back to the assumed pace rather than inventing one
/// from no data.
#[tokio::test]
async fn the_estimate_falls_back_before_the_department_has_a_pace() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    for _ in 0..2 {
        create_token(&app, &csrf, department, "normal").await;
    }
    let mine = create_token(&app, &csrf, department, "normal").await;

    assert_eq!(ahead_of(&mine), 2);
    assert_eq!(
        wait_of(&mine),
        10,
        "two ahead at the assumed five minutes each, until real throughput exists",
    );
}

/// Given a queue, When positions and waits are read, Then the wait is a whole
/// multiple of the position — the estimate must stay a function of the queue,
/// never a number drifting on its own.
#[tokio::test]
async fn the_wait_stays_proportional_to_the_position() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    let first = create_token(&app, &csrf, department, "normal").await;
    for _ in 0..2 {
        create_token(&app, &csrf, department, "normal").await;
    }
    let last = create_token(&app, &csrf, department, "normal").await;

    assert_eq!(wait_of(&first), 0, "nobody ahead is no wait");
    assert!(
        wait_of(&last) > 0 && wait_of(&last) % ahead_of(&last) == 0,
        "the wait should be the number ahead times a per-patient pace",
    );
}
