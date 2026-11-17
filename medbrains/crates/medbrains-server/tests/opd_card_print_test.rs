//! The OPD card: the hospital's own name, the patient's UHID, and the visit's
//! token and doctor; refused, as "not found", to a clinician with no
//! relationship to the patient.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A patient registered at the desk, with an address on file.
async fn register(app: &common::TestApp, csrf: &str) -> Value {
    let phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let resp = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "first_name": "Kavya",
            "last_name": "Raman",
            "gender": "female",
            "date_of_birth": "1992-03-04",
            "phone": phone,
            "address": { "line1": "4 North Street", "city": "Madurai" },
        }))
        .send()
        .await
        .expect("register");
    assert_eq!(resp.status(), StatusCode::OK);
    resp.json().await.expect("patient json")
}

/// An OPD visit to general medicine with `doctor`, as registration opens it.
async fn open_visit(app: &common::TestApp, csrf: &str, patient: &str, doctor: Uuid) -> Value {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let resp = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_id": patient, "department_id": department, "doctor_id": doctor }))
        .send()
        .await
        .expect("visit");
    assert_eq!(resp.status(), StatusCode::OK);
    resp.json().await.expect("visit json")
}

/// GET `path` as `client`: the status, and the body when there is one.
async fn fetch(client: &reqwest::Client, app: &common::TestApp, path: &str) -> (StatusCode, Value) {
    let resp = client.get(app.url(path)).send().await.expect("fetch");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a patient registered and sent to a doctor, When the desk prints the
/// visit's OPD card, Then it is headed with this hospital's name and carries
/// the UHID, the token the board calls and the doctor; and a doctor with no
/// relationship to the patient is told the card does not exist.
#[tokio::test]
async fn the_opd_card_carries_the_hospital_patient_and_visit_and_nobody_else_gets_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let attending = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let stranger = common::provision_staff(&app, &csrf, "doctor", &[]).await;

    let patient = register(&app, &csrf).await;
    let patient_id = patient["id"].as_str().expect("patient id");
    let visit = open_visit(&app, &csrf, patient_id, attending.user_id).await;
    let encounter_id = visit["encounter"]["id"].as_str().expect("encounter id");
    let hospital: String = sqlx::query_scalar(
        "SELECT t.name FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("hospital");

    let path = format!("/api/print-data/opd-visit-card/{encounter_id}");
    let (status, card) = fetch(&app.client, &app, &path).await;
    assert_eq!(status, StatusCode::OK, "{card}");
    assert_eq!(
        card["hospital_name"],
        hospital.as_str(),
        "the tenant's own name heads the card"
    );
    assert_eq!(card["uhid"], patient["uhid"]);
    assert_eq!(card["patient_name"], "Kavya Raman");
    assert_eq!(card["address"], "4 North Street, Madurai");
    assert!(
        card["visit"]["token_number"].is_string(),
        "the visit's token is printed: {card}"
    );
    assert_eq!(card["visit"]["token_number"], visit["token_number"]);
    assert_eq!(card["visit"]["doctor"], "Test doctor");
    assert_eq!(
        card["visit"]["is_repeat"], false,
        "a first visit prints as new"
    );
    for clinical in ["diagnosis", "allergies", "chief_complaint"] {
        assert!(
            card.get(clinical).is_none(),
            "the card carries no {clinical}"
        );
    }

    // The patient's own card (registration, no visit) is the same identity.
    let (status, own) = fetch(
        &app.client,
        &app,
        &format!("/api/print-data/opd-card/{patient_id}"),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{own}");
    assert_eq!(own["uhid"], patient["uhid"]);
    assert!(own["visit"].is_null());

    // The attending doctor reaches the visit; a doctor with no relationship
    // reaches neither card, and is told it does not exist rather than that it
    // is forbidden.
    let (status, _) = fetch(&attending.client, &app, &path).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the attending doctor prints the visit's card"
    );
    let (status, _) = fetch(&stranger.client, &app, &path).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = fetch(
        &stranger.client,
        &app,
        &format!("/api/print-data/opd-card/{patient_id}"),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
