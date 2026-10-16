//! An MLC records its examination and incident, so the register and the
//! wound certificate print them; once certified it is amended, never
//! silently edited. The police intimation and the Code Yellow alert leave
//! the building through the outbox, and the screen reads back what was sent.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn patient(app: &common::TestApp) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Record', 'Case', 'male'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-MR-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

async fn doctor(app: &common::TestApp, csrf: &str) -> String {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (status, body) = send(
        csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": format!("mlcexam_{tag}"),
            "email": format!("mlcexam_{tag}@example.test"),
            "password": format!("MlcExam#{tag}Aa9"),
            "full_name": "Examining Doctor",
            "role": "doctor",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["id"].as_str().expect("doctor id").to_owned()
}

/// Given an assault MLC, When the doctor records the examination and the
/// incident, Then the wound certificate prints them; a future examination or
/// an incident after registration is refused; once the opinion is given an
/// edit without a reason is refused, and one with a reason is audited.
#[tokio::test]
async fn the_examination_prints_and_a_certified_case_is_only_amended() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let doctor_id = doctor(&app, &csrf).await;
    let now = chrono::Utc::now();
    let (status, case) = send(
        &csrf,
        app.client.post(app.url("/api/emergency/mlc")).json(&json!({
            "patient_id": patient(&app).await,
            "case_type": "assault",
            "date_time_of_incident": now - chrono::Duration::hours(3),
            "place_of_incident": "Near the bus stand",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    let id = case["id"].as_str().expect("mlc id").to_owned();
    let url = app.url(&format!("/api/emergency/mlc/{id}"));

    let (status, _) = send(
        &csrf,
        app.client
            .put(&url)
            .json(&json!({ "examined_at": now + chrono::Duration::hours(2) })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "no future examination"
    );
    let (status, _) = send(
        &csrf,
        app.client
            .put(&url)
            .json(&json!({ "date_time_of_incident": now + chrono::Duration::minutes(30) })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "no incident after registration"
    );

    let (status, body) = send(
        &csrf,
        app.client.put(&url).json(&json!({
            "examining_doctor_id": doctor_id,
            "examined_at": now - chrono::Duration::hours(1),
            "weapon_used": "Blunt object",
            "condition_on_arrival": "Conscious, oriented",
            "treatment_given": "Wound toilet and suturing",
            "police_officer_name": "R. Kumar",
            "police_dd_number": "DD-42",
            "medical_opinion": "Simple injury",
            "status": "opinion_given",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let cert: Value = app
        .client
        .get(app.url(&format!("/api/print-data/wound-certificate/{id}")))
        .send()
        .await
        .expect("print")
        .json()
        .await
        .expect("print json");
    assert_eq!(
        cert["alleged_incident_place"], "Near the bus stand",
        "{cert}"
    );
    assert_eq!(cert["general_condition"], "Conscious, oriented", "{cert}");
    assert_eq!(cert["opinion_weapon"], "Blunt object", "{cert}");

    let (status, body) = send(
        &csrf,
        app.client
            .put(&url)
            .json(&json!({ "weapon_used": "Sharp object" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert!(body["fields"]["amendment_reason"].is_array(), "{body}");

    let (status, _) = send(
        &csrf,
        app.client.put(&url).json(&json!({
            "weapon_used": "Blunt object",
            "medical_opinion": "Simple injury",
        })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "an unchanged resend is not an amendment"
    );

    let (status, body) = send(
        &csrf,
        app.client.put(&url).json(&json!({
            "weapon_used": "Sharp object",
            "amendment_reason": "Wound edges re-examined: incised, not lacerated",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["weapon_used"], "Sharp object");
    let audited: Value = sqlx::query_scalar(
        "SELECT new_values FROM audit_log \
          WHERE action = 'mlc_case.amend' AND entity_id = $1::uuid ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("amendment audited");
    assert_eq!(audited["weapon_used"], "Sharp object");
    assert!(audited["amendment_reason"].is_string());
}

/// Given no police contact, When the intimation is recorded, Then nothing is
/// sent and the row says so (empty delivery); Given a contact, Then an SMS and
/// an email carrying the intimation number are queued and read back.
#[tokio::test]
async fn the_police_intimation_is_sent_to_the_configured_contact() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (status, case) = send(
        &csrf,
        app.client
            .post(app.url("/api/emergency/mlc"))
            .json(&json!({ "patient_id": patient(&app).await, "case_type": "assault" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    let url = app.url(&format!(
        "/api/emergency/mlc/{}/police-intimations",
        case["id"].as_str().expect("mlc id")
    ));
    let set_contact = |value: Value| {
        app.client
            .put(app.url("/api/setup/settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "category": "emergency", "key": "police_contact", "value": value }))
            .send()
    };

    assert!(
        set_contact(json!({}))
            .await
            .expect("clear")
            .status()
            .is_success()
    );
    let (status, unsent) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&json!({ "police_station": "Town PS", "sent_via": "phone" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{unsent}");
    assert_eq!(
        unsent["delivery"],
        json!([]),
        "nothing configured, nothing sent"
    );

    let contact =
        json!({ "station": "Town PS", "phone": "9876543210", "email": "townps@police.test" });
    assert!(
        set_contact(contact)
            .await
            .expect("set")
            .status()
            .is_success()
    );
    let (status, sent) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&json!({ "police_station": "Town PS" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{sent}");
    let number = sent["intimation_number"].as_str().expect("number");
    let delivery = sent["delivery"].as_array().expect("delivery");
    assert_eq!(delivery.len(), 2, "{sent}");
    assert!(delivery.iter().all(|d| d["status"] == "queued"));
    let sms = app.outbox_rows("sms.mlc_police_intimation", number).await;
    assert_eq!(sms.len(), 1, "the SMS carries the intimation number");
    assert_eq!(sms[0]["to"], "+919876543210");
    assert_eq!(
        app.outbox_rows("email.mlc_police_intimation", number)
            .await
            .len(),
        1
    );

    let listed: Value = app
        .client
        .get(&url)
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let row = listed
        .as_array()
        .and_then(|rows| rows.iter().find(|r| r["id"] == sent["id"]))
        .expect("listed");
    assert_eq!(row["delivery"].as_array().map(Vec::len), Some(2));

    // Leave the dev tenant as found: no contact, nothing sent.
    assert!(
        set_contact(json!({}))
            .await
            .expect("reset")
            .status()
            .is_success()
    );
}

/// When a mass-casualty event is activated, Then responders get an in-app
/// CODE YELLOW alert and the event records what was sent — server-written.
#[tokio::test]
async fn a_mass_casualty_activation_alerts_responders() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (status, event) = send(
        &csrf,
        app.client
            .post(app.url("/api/emergency/mass-casualty"))
            .json(&json!({
                "event_name": format!("Bus collision {}", Uuid::new_v4().simple()),
                "location": "NH-44",
                "estimated_casualties": 20,
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{event}");
    let alerted: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications \
          WHERE entity_type = 'mass_casualty_event' AND entity_id = $1::uuid AND title = 'CODE YELLOW'",
    )
    .bind(event["id"].as_str().expect("event id"))
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert!(alerted > 0, "the admin at least is alerted");
    assert_eq!(event["notifications_sent"]["in_app_alerts"], json!(alerted));
}

/// A doctor provisioned through the real API and signed in: `(id, client, csrf)`.
async fn signed_in_doctor(
    app: &common::TestApp,
    admin_csrf: &str,
    extra: Value,
) -> (String, reqwest::Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("mlcdoc_{tag}"), format!("MlcDoc#{tag}Aa9"));
    let mut user = json!({
        "username": username,
        "email": format!("{username}@example.test"),
        "password": password,
        "full_name": format!("Dr {tag}"),
        "role": "doctor",
    });
    if let (Some(user), Some(extra)) = (user.as_object_mut(), extra.as_object()) {
        user.extend(extra.clone());
    }
    let (status, body) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&user),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let client = reqwest::Client::builder()
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
    let csrf = login["csrf_token"].as_str().unwrap_or("").to_owned();
    (body["id"].as_str().expect("id").to_owned(), client, csrf)
}

/// Given a doctor on the case who holds `emergency.mlc.update` but not
/// `emergency.mlc.amend`, When they change an open case, Then it saves; When
/// they change a certified case, even with a reason, Then it is refused 403
/// and nothing changes.
#[tokio::test]
async fn amending_a_certified_mlc_needs_the_amend_permission() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (doctor_id, doctor, doctor_csrf) = signed_in_doctor(
        &app,
        &csrf,
        json!({ "access_matrix": { "extra": [], "denied": ["emergency.mlc.amend"] } }),
    )
    .await;
    // The doctor is this patient's consultant — on the case through the
    // ordinary grant, so the refusal below is the permission, not access.
    let (status, patient) = send(
        &csrf,
        app.client.post(app.url("/api/patients")).json(&json!({
            "first_name": "Amend",
            "last_name": "Denied",
            "gender": "male",
            "date_of_birth": "1990-01-01",
            "phone": format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]),
            "consultant_id": doctor_id,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{patient}");
    let mut cases = Vec::new();
    for _ in 0..2 {
        let (status, case) = send(
            &csrf,
            app.client
                .post(app.url("/api/emergency/mlc"))
                .json(&json!({ "patient_id": patient["id"], "case_type": "assault" })),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{case}");
        let number = case["mlc_number"].as_str().expect("number");
        assert!(
            number.starts_with("MLC-") && number[4..].chars().all(|c| c.is_ascii_digit()),
            "allocated from the sequence, not the clock: {number}"
        );
        cases.push(case["id"].as_str().expect("id").to_owned());
    }
    assert_ne!(cases[0], cases[1]);
    let certified = app.url(&format!("/api/emergency/mlc/{}", cases[0]));
    let open = app.url(&format!("/api/emergency/mlc/{}", cases[1]));
    let (status, body) = send(
        &csrf,
        app.client.put(&certified).json(&json!({
            "weapon_used": "Blunt object",
            "medical_opinion": "Simple injury",
            "status": "opinion_given",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (status, body) = send(
        &doctor_csrf,
        doctor
            .put(&open)
            .json(&json!({ "weapon_used": "Blunt object" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "an open case is edited freely: {body}"
    );

    let (status, body) = send(
        &doctor_csrf,
        doctor.put(&certified).json(&json!({
            "weapon_used": "Sharp object",
            "amendment_reason": "Wound edges re-examined: incised",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    let weapon: Option<String> =
        sqlx::query_scalar("SELECT weapon_used FROM mlc_cases WHERE id = $1::uuid")
            .bind(&cases[0])
            .fetch_one(&app.db)
            .await
            .expect("weapon");
    assert_eq!(
        weapon.as_deref(),
        Some("Blunt object"),
        "the refused amendment changed nothing"
    );
}

/// When an MLC is registered, Then an emergency duty doctor is told in-app.
#[tokio::test]
async fn a_new_mlc_notifies_the_emergency_duty_doctor() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let er: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'EMERGENCY' AND d.deleted_at IS NULL",
    )
    .fetch_one(&app.db)
    .await
    .expect("emergency department");
    let (er_doctor, _, _) = signed_in_doctor(&app, &csrf, json!({ "department_ids": [er] })).await;
    let (status, case) = send(
        &csrf,
        app.client
            .post(app.url("/api/emergency/mlc"))
            .json(&json!({ "patient_id": patient(&app).await, "case_type": "assault" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications \
          WHERE entity_type = 'mlc_case' AND entity_id = $1::uuid AND user_id = $2::uuid",
    )
    .bind(case["id"].as_str().expect("id"))
    .bind(&er_doctor)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(told, 1);
}
