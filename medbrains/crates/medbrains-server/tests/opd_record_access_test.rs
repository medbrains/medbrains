//! OPD worklists show clinical detail per record, not per role.
//!
//! The queue, the verbal-order register and the referral list are opened by
//! role. What each row may show is the record's business: the visit's
//! department, its doctor, whoever opened it, or a grant on the patient (a
//! break-glass lands there). Everyone else still sees the row the desk needs to
//! call, without the complaint; a referral is shown only to its two sides.

use crate::common;
use crate::psych_support::{on_care_team, patient, send, tenant};

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn department(app: &common::TestApp, code: &str) -> Uuid {
    sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = $1",
    )
    .bind(code)
    .fetch_one(&app.db)
    .await
    .expect("department")
}

/// A signed-in member of staff in `depts`: (client, csrf, user id).
async fn staff(
    app: &common::TestApp,
    csrf: &str,
    role: &str,
    depts: &[Uuid],
) -> (Client, String, Uuid) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("abac_{tag}"), format!("Abac#Key{tag}Aa9"));
    let (status, body) = send(
        csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Abac {role}"),
            "role": role,
            "department_ids": depts,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_one(&app.db)
        .await
        .expect("user id");
    let client = Client::builder()
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
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    (client, csrf, id)
}

/// This visit's row on the caller's queue for its department.
async fn queue_row(app: &common::TestApp, who: &Client, dept: Uuid, encounter: &str) -> Value {
    let resp = who
        .get(app.url(&format!("/api/opd/queue?department_id={dept}")))
        .send()
        .await
        .expect("queue");
    assert_eq!(resp.status(), StatusCode::OK);
    let rows: Vec<Value> = resp.json().await.expect("rows");
    rows.into_iter()
        .find(|r| r["encounter_id"] == encounter)
        .expect("every caller sees the row the desk calls")
}

/// Given a medicine visit with a complaint, When a medicine doctor, a doctor
/// in another department, and that doctor after a grant on the patient read
/// the queue, Then the first sees the complaint, the second sees the row with
/// the complaint withheld, and the third sees it again.
#[tokio::test]
async fn the_queue_withholds_a_complaint_outside_the_callers_care() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let (medicine, anaesthesia) = (
        department(&app, "GEN-MEDICINE").await,
        department(&app, "ANESTHESIOLOGY").await,
    );
    let who = patient(&app, tenant).await;
    let (status, visit) = send(
        &csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({
                "patient_id": who,
                "department_id": medicine,
                "chief_complaint": "Low mood, not sleeping",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let encounter = visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned();

    let (inside, _, _) = staff(&app, &csrf, "doctor", &[medicine]).await;
    let row = queue_row(&app, &inside, medicine, &encounter).await;
    assert_eq!(row["access"], "allowed");
    assert_eq!(row["chief_complaint"], "Low mood, not sleeping");

    let (outside, _, outside_id) = staff(&app, &csrf, "doctor", &[anaesthesia]).await;
    let row = queue_row(&app, &outside, medicine, &encounter).await;
    assert_eq!(row["access"], "withheld");
    assert!(row["chief_complaint"].is_null(), "{row}");
    assert!(
        row["token_code"].is_string() || row["token_number"].is_number(),
        "the desk can still call"
    );

    on_care_team(&app, tenant, who, outside_id).await;
    let row = queue_row(&app, &outside, medicine, &encounter).await;
    assert_eq!(
        row["access"], "allowed",
        "a grant on the patient opens the visit's row"
    );
}

/// Given referrals between two departments, When a doctor of neither lists
/// referrals, Then none of them is there; a doctor of the receiving
/// department sees the one addressed to it.
#[tokio::test]
async fn a_referral_is_listed_only_to_its_two_sides() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let (medicine, anaesthesia) = (
        department(&app, "GEN-MEDICINE").await,
        department(&app, "ANESTHESIOLOGY").await,
    );
    let who = patient(&app, tenant).await;
    let (sender, sender_csrf, _) = staff(&app, &csrf, "doctor", &[medicine]).await;
    let (status, visit) = send(
        &sender_csrf,
        sender.post(app.url("/api/opd/encounters")).json(&json!({
            "patient_id": who,
            "department_id": medicine,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let referral: Uuid = sqlx::query_scalar(
        "INSERT INTO referrals (tenant_id, patient_id, encounter_id, from_department_id, \
                to_department_id, from_doctor_id, urgency, reason) \
         SELECT $1, $2, $3::uuid, $4, $5, e.doctor_id, 'routine', 'Pre-op opinion' \
           FROM encounters e WHERE e.id = $3::uuid RETURNING id",
    )
    .bind(tenant)
    .bind(who)
    .bind(visit["encounter"]["id"].as_str().expect("encounter"))
    .bind(medicine)
    .bind(anaesthesia)
    .fetch_one(&app.db)
    .await
    .expect("referral");

    let listed = |rows: &[Value]| rows.iter().any(|r| r["id"] == referral.to_string());
    let list = async |who: &Client| -> Vec<Value> {
        let resp = who
            .get(app.url("/api/opd/referrals/tracking"))
            .send()
            .await
            .expect("list");
        assert_eq!(resp.status(), StatusCode::OK);
        resp.json().await.expect("rows")
    };
    let (receiver, _, _) = staff(&app, &csrf, "doctor", &[anaesthesia]).await;
    assert!(
        listed(&list(&receiver).await),
        "the receiving department sees it"
    );
    let other = department(&app, "GEN-SURGERY").await;
    let (bystander, _, _) = staff(&app, &csrf, "doctor", &[other]).await;
    assert!(
        !listed(&list(&bystander).await),
        "a doctor of neither side does not"
    );
}
