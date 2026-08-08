//! Printing a queue token slip — GitHub #1663.
//!
//! The issue was marked Done and the data endpoint did exist, but two things
//! were missing: there was no printable template registered at all, so
//! `/api/documents/render` refused `queue_token_slip` outright; and the wait
//! time named in the issue title was hard-coded `None`, so every slip printed
//! without one.
//!
//! What these tests pin is the pairing: the slip and the board must quote the
//! same wait for the same queue. Paper outlives the screen it was printed from,
//! so a slip that disagrees with the board is worse than one that says nothing.

mod common;

use reqwest::StatusCode;
use uuid::Uuid;

/// A department of this test's own — these suites share one database and run
/// concurrently, so a wait computed from a queue anyone else writes to cannot
/// be asserted on.
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
    .bind(format!("SP{suffix}"))
    .bind(format!("Slip Print {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("create an isolated department");
    row.0
}

/// Issue a queue token and return the board's own view of it.
async fn issue_token(
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
        // nothing here turns on who is in the queue.
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

async fn slip_data(app: &common::TestApp, token_id: &str) -> serde_json::Value {
    let resp = app
        .client
        .get(app.url(&format!("/api/print-data/token-slip/{token_id}")))
        .send()
        .await
        .expect("token slip request");
    let status = resp.status();
    let body = resp.text().await.expect("response body");
    assert_eq!(status, StatusCode::OK, "token slip failed: {body}");
    serde_json::from_str(&body).expect("slip json")
}

/// Given a token issued behind others, When its slip is fetched, Then the wait
/// is the one the board quoted — not blank, and not a second opinion.
#[tokio::test]
async fn the_slip_quotes_the_same_wait_the_board_does() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    for _ in 0..3 {
        issue_token(&app, &csrf, department, "normal").await;
    }
    let token = issue_token(&app, &csrf, department, "normal").await;
    let board_wait = token["estimated_wait_minutes"]
        .as_i64()
        .expect("the board quotes a wait");

    let slip = slip_data(&app, token["id"].as_str().expect("token id")).await;

    assert_eq!(
        slip["estimated_wait_minutes"].as_i64(),
        Some(board_wait),
        "the printed slip must not disagree with the screen",
    );
    assert!(
        board_wait > 0,
        "three patients were ahead, so the wait cannot be nothing",
    );
}

/// Given a token, When its slip is fetched, Then it carries the four things the
/// patient reads off it while waiting: number, department, doctor slot and the
/// wait. A slip missing any of them is not worth the paper.
#[tokio::test]
async fn the_slip_carries_what_the_patient_needs_to_read() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    let token = issue_token(&app, &csrf, department, "normal").await;
    let slip = slip_data(&app, token["id"].as_str().expect("token id")).await;

    assert_eq!(
        slip["token_number"], token["token_number"],
        "the number on the slip is the number that will be called",
    );
    assert_eq!(
        slip["department_name"], token["department_name"],
        "the slip must name the department it queues for",
    );
    // `doctor_name` is legitimately null when no doctor is assigned yet, but
    // the field itself must be present or the template cannot lay it out.
    assert!(slip.get("doctor_name").is_some(), "doctor slot must exist");
    assert!(
        slip["qr_code_data"]
            .as_str()
            .is_some_and(|q| q.contains("MBTOKEN:")),
        "the slip carries a scannable token reference",
    );
}

/// Given a priority case, When its slip is fetched, Then the wait reflects it
/// being called first. The wait is derived from call order, so a priority token
/// printing an ordinary wait would be the queue lying on paper.
#[tokio::test]
async fn a_priority_case_prints_no_wait_behind_ordinary_patients() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    for _ in 0..4 {
        issue_token(&app, &csrf, department, "normal").await;
    }
    let urgent = issue_token(&app, &csrf, department, "emergency_referral").await;

    let slip = slip_data(&app, urgent["id"].as_str().expect("token id")).await;

    assert_eq!(
        slip["estimated_wait_minutes"].as_i64(),
        Some(0),
        "an emergency case is called next, so nobody is ahead to wait for",
    );
}

/// Given the slip template, When a document render is asked for a real token,
/// Then the request is accepted rather than refused as unknown.
///
/// This is the whole gap the issue left: the data endpoint worked all along,
/// but no template was registered and no context builder existed, so
/// `/api/documents/render` answered "unknown template 'queue_token_slip'".
///
/// The assertion stops at acceptance because producing the PDF needs Gotenberg,
/// which no test environment here runs — a 503 for an unconfigured renderer
/// still proves the template resolved and its context was built, which is the
/// part this change is responsible for.
#[tokio::test]
async fn a_slip_can_actually_be_rendered_as_a_document() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department = a_department(&app).await;

    let token = issue_token(&app, &csrf, department, "normal").await;

    let resp = app
        .client
        .post(app.url("/api/documents/render"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "template_code": "queue_token_slip",
            "source_id": token["id"],
        }))
        .send()
        .await
        .expect("render request");

    let status = resp.status();
    let body = resp.text().await.expect("response body");
    assert_ne!(
        status,
        StatusCode::BAD_REQUEST,
        "the slip must not be refused as an unknown template: {body}",
    );
    assert!(
        !body.contains("no context builder"),
        "the slip template must know how to fetch its own data: {body}",
    );
}
