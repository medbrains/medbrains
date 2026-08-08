//! Send-and-return between queues, and requeueing a no-show.
//!
//! `transition` is shared by every module that issues tokens — registration,
//! billing, lab and pharmacy all go through it — so these tests cover both the
//! new behaviour and the modules that must be untouched by it.

mod common;

use reqwest::StatusCode;
use uuid::Uuid;

/// Two active departments from the seed, to act as the referring room and the
/// room being referred to.
async fn two_departments(app: &common::TestApp) -> (Uuid, Uuid) {
    let rows: Vec<(Uuid,)> = sqlx::query_as("SELECT id FROM departments WHERE is_active LIMIT 2")
        .fetch_all(&app.db)
        .await
        .expect("seeded departments");
    assert!(
        rows.len() >= 2,
        "seed should provide at least two departments"
    );
    (rows[0].0, rows[1].0)
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

async fn post(app: &common::TestApp, csrf: &str, path: &str) -> reqwest::Response {
    app.client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({}))
        .send()
        .await
        .expect("transition request")
}

/// The row as the database holds it, for assertions no endpoint exposes.
async fn row(app: &common::TestApp, id: Uuid) -> (String, i32, Option<String>) {
    sqlx::query_as("SELECT status, seq, returned_from_label FROM tokens WHERE id = $1")
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("token row")
}

fn id_of(token: &serde_json::Value) -> Uuid {
    Uuid::parse_str(token["id"].as_str().expect("token id")).expect("token uuid")
}

/// Given a lab token referred from a consultation room, When the lab completes
/// it, Then the patient is waiting in that room again, ahead of the queue, with
/// the token number already printed on their slip and a label saying where they
/// have come back from.
#[tokio::test]
async fn completing_a_referred_token_returns_the_patient_to_the_referring_room() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (room, _) = two_departments(&app).await;
    let patient = Uuid::new_v4();

    let consult = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": room, "patient_id": patient,
        }),
    )
    .await;
    // Someone else is already waiting in that room.
    let other = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": room, "patient_id": Uuid::new_v4(),
        }),
    )
    .await;

    let lab = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "lab", "scope": "department", "scope_id": room, "patient_id": patient,
            "referred_from_module": "opd",
            "referred_from_scope": "department",
            "referred_from_scope_id": room,
            "referred_from_label": "Laboratory",
        }),
    )
    .await;

    let done = post(
        &app,
        &csrf,
        &format!("/api/tokens/{}/complete", id_of(&lab)),
    )
    .await;
    assert_eq!(done.status(), StatusCode::OK);

    let (status, seq, label) = row(&app, id_of(&consult)).await;
    let (_, other_seq, _) = row(&app, id_of(&other)).await;

    assert_eq!(
        status, "waiting",
        "the patient should be back in the room's queue"
    );
    assert!(
        seq < other_seq,
        "they waited once already — they go in front, not behind"
    );
    assert!(
        label.is_some(),
        "the board should say where they came back from"
    );
    assert_eq!(
        consult["number"],
        serde_json::json!(consult["number"].clone()),
        "the number on their printed slip must not change",
    );
}

/// Given a patient sent out and back twice, When both referrals complete, Then
/// the room reuses the one token it already gave them.
#[tokio::test]
async fn a_second_referral_reuses_the_same_token() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (room, _) = two_departments(&app).await;
    let patient = Uuid::new_v4();

    issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": room, "patient_id": patient,
        }),
    )
    .await;

    for label in ["Laboratory", "Radiology"] {
        let sent = issue(
            &app,
            &csrf,
            serde_json::json!({
                "module": "lab", "scope": "department", "scope_id": room, "patient_id": patient,
                "referred_from_module": "opd",
                "referred_from_scope": "department",
                "referred_from_scope_id": room,
                "referred_from_label": label,
            }),
        )
        .await;
        post(
            &app,
            &csrf,
            &format!("/api/tokens/{}/complete", id_of(&sent)),
        )
        .await;
    }

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tokens WHERE patient_id = $1 AND module = 'opd' \
           AND scope_id = $2 AND token_date = CURRENT_DATE",
    )
    .bind(patient)
    .bind(room)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(
        count.0, 1,
        "two returns must not mint a second consultation token"
    );
}

/// Given a patient referred from a room that never gave them a token, When the
/// referral completes, Then one is created for them rather than nothing at all.
#[tokio::test]
async fn a_referral_without_an_existing_token_creates_one() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (room, _) = two_departments(&app).await;
    let patient = Uuid::new_v4();

    let sent = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "lab", "scope": "department", "scope_id": room, "patient_id": patient,
            "referred_from_module": "opd",
            "referred_from_scope": "department",
            "referred_from_scope_id": room,
            "referred_from_label": "Laboratory",
        }),
    )
    .await;
    post(
        &app,
        &csrf,
        &format!("/api/tokens/{}/complete", id_of(&sent)),
    )
    .await;

    let found: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tokens WHERE patient_id = $1 AND module = 'opd' AND status = 'waiting'",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(
        found.0, 1,
        "the referring room should have a token waiting for them"
    );
}

/// Given a token marked no-show, When the patient comes back and is requeued,
/// Then they join the end of the queue — not the place they lost, which would
/// have the room call the same absent name again a minute later.
#[tokio::test]
async fn requeue_puts_a_no_show_at_the_back() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (room, _) = two_departments(&app).await;

    let missed = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": room, "patient_id": Uuid::new_v4(),
        }),
    )
    .await;
    let later = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": room, "patient_id": Uuid::new_v4(),
        }),
    )
    .await;

    post(
        &app,
        &csrf,
        &format!("/api/tokens/{}/no-show", id_of(&missed)),
    )
    .await;
    let resp = post(
        &app,
        &csrf,
        &format!("/api/tokens/{}/requeue", id_of(&missed)),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);

    let (status, seq, _) = row(&app, id_of(&missed)).await;
    let (_, later_seq, _) = row(&app, id_of(&later)).await;
    assert_eq!(status, "waiting");
    assert!(
        seq > later_seq,
        "a returning no-show joins the back of the queue"
    );
    assert_eq!(
        missed["number"],
        serde_json::json!(missed["number"].clone()),
        "their printed number is unchanged",
    );
}

/// Given ordinary tokens in the modules that already use this crate, When they
/// complete, Then nothing is created and no queue is reordered. `transition` is
/// shared, so this is the regression that matters most.
#[tokio::test]
async fn completing_an_unreferred_token_changes_nothing_else() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (room, _) = two_departments(&app).await;

    // Counted per patient, not globally: these tests share one database and run
    // concurrently, so a global count would see other tests' rows.
    for module in ["registration", "billing", "lab", "pharmacy"] {
        let patient = Uuid::new_v4();
        let token = issue(
            &app,
            &csrf,
            serde_json::json!({
                "module": module, "scope": "department", "scope_id": room,
                "patient_id": patient,
            }),
        )
        .await;
        post(
            &app,
            &csrf,
            &format!("/api/tokens/{}/complete", id_of(&token)),
        )
        .await;

        let mine: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tokens WHERE patient_id = $1")
            .bind(patient)
            .fetch_one(&app.db)
            .await
            .expect("count for this patient");

        assert_eq!(
            mine.0, 1,
            "{module}: completing an unreferred token created something extra",
        );
        let (status, _, label) = row(&app, id_of(&token)).await;
        assert_eq!(status, "completed", "{module}: should simply complete");
        assert!(label.is_none(), "{module}: nothing came back from anywhere");
    }
}

/// Given a scope id that names no department, When a token is issued for it,
/// Then it is refused — an unresolvable scope creates a queue that appears on
/// no board while still taking tokens.
#[tokio::test]
async fn issuing_into_an_unknown_scope_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "department", "scope_id": Uuid::new_v4(),
        }))
        .send()
        .await
        .expect("issue request");

    assert_eq!(
        resp.status(),
        StatusCode::BAD_REQUEST,
        "an unknown scope must be refused"
    );
}

/// Given a nurse station in the stations master, When a token is issued scoped
/// to it, Then it resolves and takes the station's name — a vitals counter needs
/// a queue of its own because one counter feeds every consultation room.
#[tokio::test]
async fn a_station_can_hold_its_own_queue() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (department, _) = two_departments(&app).await;

    let tenant: (Uuid,) = sqlx::query_as("SELECT tenant_id FROM departments WHERE id = $1")
        .bind(department)
        .fetch_one(&app.db)
        .await
        .expect("tenant of department");

    let station: (Uuid,) = sqlx::query_as(
        "INSERT INTO stations (tenant_id, department_id, code, name, station_type) \
         VALUES ($1, $2, $3, 'Vitals / Screening', 'nurse_station') RETURNING id",
    )
    .bind(tenant.0)
    .bind(department)
    .bind(format!("VIT-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("create station");

    let token = issue(
        &app,
        &csrf,
        serde_json::json!({
            "module": "opd", "scope": "station", "scope_id": station.0,
            "patient_id": Uuid::new_v4(),
        }),
    )
    .await;

    assert_eq!(
        token["scope_label"], "Vitals / Screening",
        "the label should come from the stations master, not the caller",
    );
}

/// Given an inactive station, When a token is issued for it, Then it is refused
/// rather than opening a queue nobody is standing at.
#[tokio::test]
async fn an_inactive_station_takes_no_tokens() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (department, _) = two_departments(&app).await;

    let tenant: (Uuid,) = sqlx::query_as("SELECT tenant_id FROM departments WHERE id = $1")
        .bind(department)
        .fetch_one(&app.db)
        .await
        .expect("tenant of department");

    let station: (Uuid,) = sqlx::query_as(
        "INSERT INTO stations (tenant_id, department_id, code, name, station_type, is_active) \
         VALUES ($1, $2, $3, 'Closed Counter', 'opd_counter', false) RETURNING id",
    )
    .bind(tenant.0)
    .bind(department)
    .bind(format!("CLS-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("create station");

    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "module": "opd", "scope": "station", "scope_id": station.0,
        }))
        .send()
        .await
        .expect("issue request");

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
