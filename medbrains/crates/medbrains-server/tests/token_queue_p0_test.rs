//! Token queue P0 — the live defects found before the queues become
//! configurable (RFCs/modules/RFC-MODULE-token-queues.md §2, §8).
//!
//! Each test pins one defect: it failed against the code as it was and passes
//! against the fix.

mod common;

use futures::StreamExt;
use reqwest::StatusCode;
use uuid::Uuid;

/// The admin's tenant, and a department of this test's own so
/// concurrent suites never share a queue.
async fn own_department(app: &common::TestApp) -> (Uuid, Uuid) {
    // The admin's own tenant — the database also holds an RLS probe tenant.
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
    .fetch_one(&app.db)
    .await
    .expect("a tenant with a department");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("TQ{suffix}"))
    .bind(format!("Token queue {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("create an isolated department");
    (tenant, department)
}

async fn issue(app: &common::TestApp, csrf: &str, department: Uuid) -> serde_json::Value {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
        }))
        .send()
        .await
        .expect("issue request");
    assert_eq!(resp.status(), StatusCode::OK, "issue should succeed");
    resp.json().await.expect("issued token json")
}

async fn step(app: &common::TestApp, csrf: &str, id: &str, action: &str) -> StatusCode {
    let resp = app
        .client
        .post(app.url(&format!("/api/tokens/{id}/{action}")))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({}))
        .send()
        .await
        .expect("transition request");
    let status = resp.status();
    if status == StatusCode::BAD_REQUEST {
        eprintln!("{action}: {}", resp.text().await.unwrap_or_default());
    }
    status
}

async fn advance(app: &common::TestApp, csrf: &str, id: &str, status: &str) -> StatusCode {
    app.client
        .post(app.url(&format!("/api/tokens/{id}/advance")))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({ "status": status }))
        .send()
        .await
        .expect("advance request")
        .status()
}

/// Given a completed token, When a stale console sets it back to waiting or
/// marks it a no-show, Then both are refused with 409 and the token stays
/// completed. Going back into a queue is `requeue`, which decides the position.
#[tokio::test]
async fn a_completed_token_cannot_be_moved_backwards() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, department) = own_department(&app).await;
    let token = issue(&app, &csrf, department).await;
    let id = token["id"].as_str().expect("token id");

    for action in ["call", "serve", "complete"] {
        assert_eq!(step(&app, &csrf, id, action).await, StatusCode::OK, "{action}");
    }
    assert_eq!(advance(&app, &csrf, id, "waiting").await, StatusCode::CONFLICT);
    assert_eq!(step(&app, &csrf, id, "no-show").await, StatusCode::CONFLICT);

    let status: String = sqlx::query_scalar("SELECT status FROM tokens WHERE id = $1::uuid")
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("token status");
    assert_eq!(status, "completed");
}

/// Given two patients waiting, When two desks press Call next at the same
/// moment, Then they call two different patients — never the same one twice.
#[tokio::test]
async fn two_desks_calling_next_together_call_two_patients() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, department) = own_department(&app).await;
    for _ in 0..2 {
        issue(&app, &csrf, department).await;
    }

    let call_next = || {
        app.client
            .post(app.url("/api/tokens/call-next"))
            .header("x-csrf-token", &csrf)
            .json(&serde_json::json!({
                "module": "opd", "scope": "department", "scope_id": department,
            }))
            .send()
    };
    // Repeat the race: one lucky interleaving proves nothing.
    let mut called = std::collections::HashSet::new();
    let (a, b) = tokio::join!(call_next(), call_next());
    for resp in [a, b] {
        let resp = resp.expect("call-next request");
        assert_eq!(resp.status(), StatusCode::OK);
        let token: serde_json::Value = resp.json().await.expect("call-next json");
        let id = token["id"].as_str().expect("each desk called someone").to_owned();
        assert!(called.insert(id), "two desks called the same patient");
    }

    let still_waiting: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tokens WHERE scope_id = $1 AND status = 'waiting'",
    )
    .bind(department)
    .fetch_one(&app.db)
    .await
    .expect("count waiting");
    assert_eq!(still_waiting, 0, "both waiting patients were called");
}

/// Given a camp, When ten registrations arrive at once, Then every patient
/// gets a different `CR-` number.
#[tokio::test]
async fn simultaneous_camp_registrations_get_distinct_numbers() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, department) = own_department(&app).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let camp_id: Uuid = sqlx::query_scalar(
        "INSERT INTO camps (tenant_id, camp_code, name, camp_type, scheduled_date, \
                            organizing_department_id) \
         VALUES ($1, $2, 'Numbering camp', 'general_health'::camp_type, CURRENT_DATE, $3) \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("NUM{suffix}"))
    .bind(department)
    .fetch_one(&app.db)
    .await
    .expect("insert camp");

    let register = |n: usize| {
        app.client
            .post(app.url("/api/camp/registrations"))
            .header("x-csrf-token", &csrf)
            .json(&serde_json::json!({ "camp_id": camp_id, "person_name": format!("P{n}") }))
            .send()
    };
    let responses = futures::future::join_all((0..10).map(register)).await;
    for resp in responses {
        let resp = resp.expect("registration request");
        let status = resp.status();
        assert_eq!(status, StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
    }

    let (total, distinct): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COUNT(DISTINCT registration_number) \
           FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(camp_id)
    .fetch_one(&app.db)
    .await
    .expect("count numbers");
    assert_eq!(total, 10);
    assert_eq!(distinct, 10, "two patients were given the same registration number");
}

/// Given a board pointed at a room (a location scope, not a department), When
/// a token in that room is called, Then the board's socket receives the call.
/// The socket used to resolve its tenant from `departments` only, and closed
/// on every other kind of queue.
#[tokio::test]
async fn a_room_board_receives_its_calls_live() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, _) = own_department(&app).await;
    let room: Uuid = sqlx::query_scalar(
        "SELECT id FROM locations WHERE tenant_id = $1 AND deleted_at IS NULL \
           AND id IN (SELECT scope_id FROM token_scopes WHERE scope = 'location') LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("a location that is a token scope");

    let (mut socket, _) =
        tokio_tungstenite::connect_async(format!("ws://{}/ws/queue/{room}", app.addr))
            .await
            .expect("socket opens");

    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "module": "radiology", "scope": "location", "scope_id": room }))
        .send()
        .await
        .expect("issue request");
    assert_eq!(resp.status(), StatusCode::OK);
    let token: serde_json::Value = resp.json().await.expect("token json");
    let id = token["id"].as_str().expect("token id");
    let number = token["number"].as_str().expect("token number").to_owned();
    assert_eq!(step(&app, &csrf, id, "call").await, StatusCode::OK);

    let heard = tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while let Some(Ok(message)) = socket.next().await {
            if let Ok(text) = message.to_text() {
                if text.contains("token_called") && text.contains(&number) {
                    return true;
                }
            }
        }
        false
    })
    .await
    .unwrap_or(false);
    assert!(heard, "the room's board never heard {number} being called");
}

/// Given an OPD token that is a patient's encounter, When it is called, Then
/// `opd.queue.called` is queued with the encounter and queue entry its
/// registry requires — the event the token-call SMS and OPD wait-time reports
/// read. (The call used to send it without them and was refused with 400.)
#[tokio::test]
async fn calling_an_opd_visit_token_announces_the_call() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, department) = own_department(&app).await;
    let encounter = Uuid::new_v4();
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": Uuid::new_v4(), "entity_type": "encounter", "entity_id": encounter,
        }))
        .send()
        .await
        .expect("issue request");
    assert_eq!(resp.status(), StatusCode::OK);
    let token: serde_json::Value = resp.json().await.expect("token json");
    let id = token["id"].as_str().expect("token id");

    assert_eq!(step(&app, &csrf, id, "call").await, StatusCode::OK);
    let events = app.outbox_rows("opd.queue.called", id).await;
    assert_eq!(events.len(), 1, "one call, one event");
    assert!(
        events[0].to_string().contains(&encounter.to_string()),
        "the event names the encounter: {}",
        events[0]
    );
}

/// Given a registered patient, When the system issues their token without
/// naming them (every automatic path does), Then the token carries their name
/// — the desk console showed "—" on every row, and a receptionist calling a
/// number could not see whom they were calling.
#[tokio::test]
async fn a_token_for_a_registered_patient_carries_their_name() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, department) = own_department(&app).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Meena', 'Raman', 'female'::gender, '9876500011') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-TQ-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": department,
            "patient_id": patient,
        }))
        .send()
        .await
        .expect("issue request");
    assert_eq!(resp.status(), StatusCode::OK);
    let token: serde_json::Value = resp.json().await.expect("token json");
    assert_eq!(token["patient_name"], "Meena Raman");
}

/// The walk-in journey, from the doctor's side: Given a patient registered into
/// an OPD visit, Then the visit answers with the number the board calls (the
/// desk used to tell them the OPD counter, "T007", while the board said
/// "R-012"); And When the doctor presses Call on their own OPD screen, Then the
/// call is announced — the event the token SMS goes out on, which only the
/// desk console used to send.
#[tokio::test]
async fn a_doctor_calling_from_the_opd_screen_announces_the_call() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, department) = own_department(&app).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Ravi', 'Walkin', 'male'::gender, '9876500022') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-WI-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    let resp = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "patient_id": patient, "department_id": department }))
        .send()
        .await
        .expect("create encounter");
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
    let visit: serde_json::Value = resp.json().await.expect("visit json");
    let encounter = visit["encounter"]["id"].as_str().expect("encounter id").to_owned();
    let queue_entry = visit["queue"]["id"].as_str().expect("queue id").to_owned();

    let token_number: String = sqlx::query_scalar(
        "SELECT number FROM tokens WHERE entity_type = 'encounter' AND entity_id = $1::uuid",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("the visit's token");
    assert_eq!(visit["token_number"], token_number.as_str(), "the desk tells the patient the board's number");

    let resp = app
        .client
        .put(app.url(&format!("/api/opd/queue/{queue_entry}/call")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({}))
        .send()
        .await
        .expect("doctor calls");
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
    let events = app.outbox_rows("opd.queue.called", &encounter).await;
    assert_eq!(events.len(), 1, "the doctor's call is announced once");
}
