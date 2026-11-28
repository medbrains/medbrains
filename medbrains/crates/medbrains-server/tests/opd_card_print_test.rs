//! The OPD card: the hospital's own name, the patient's UHID, and the visit's
//! token and doctor; refused, as "not found", to a clinician with no
//! relationship to the patient.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A patient registered at the desk by `client`, with an address on file.
async fn register(app: &common::TestApp, client: &reqwest::Client, csrf: &str) -> Value {
    let phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let resp = client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "first_name": "Kavya",
            "last_name": "Raman",
            "gender": "female",
            "date_of_birth": "1992-03-04",
            "phone": phone,
            "address": { "line1": "4 North Street", "city": "Sample Town" },
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

    let patient = register(&app, &app.client, &csrf).await;
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
    assert_eq!(card["address"], "4 North Street, Sample Town");
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

/// Given a patient the morning shift registered, When a receptionist who never
/// met them reprints either OPD card, Then both print and the access history
/// records the desk reprint by that receptionist, and neither carries the
/// address; a receptionist without `patients.card.reprint` is told neither
/// card exists; and the grant never reaches
/// another hospital's patient.
#[tokio::test]
async fn the_desk_reprints_any_patients_opd_card_and_only_this_hospitals() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let attending = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let no_grant =
        common::provision_staff(&app, &csrf, "receptionist", &["patients.card.reprint"]).await;

    let patient = register(&app, &app.client, &csrf).await;
    let patient_id = patient["id"].as_str().expect("patient id");
    let visit = open_visit(&app, &csrf, patient_id, attending.user_id).await;
    let encounter_id = visit["encounter"]["id"].as_str().expect("encounter id");
    let card = format!("/api/print-data/opd-card/{patient_id}");
    let visit_card = format!("/api/print-data/opd-visit-card/{encounter_id}");

    for path in [&card, &visit_card] {
        let (status, body) = fetch(&desk.client, &app, path).await;
        assert_eq!(status, StatusCode::OK, "{path}: {body}");
        assert_eq!(body["uhid"], patient["uhid"]);
        assert!(
            body["address"].is_null(),
            "the desk never prints the address"
        );
        let (status, _) = fetch(&no_grant.client, &app, path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path} without the grant");
    }
    let desk_prints = app
        .outbox_rows("patient.card_printed", patient_id)
        .await
        .into_iter()
        .map(|row| row.to_string())
        .filter(|row| row.contains("\"via\":\"desk_reprint\""))
        .filter(|row| row.contains("\"permission\":\"patients.card.reprint\""))
        .filter(|row| row.contains(&desk.user_id.to_string()))
        .count();
    assert_eq!(desk_prints, 2, "both prints are recorded as the desk's");

    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let other_tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Other Card Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(format!("OC{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("other hospital");
    let foreign: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Other', 'Patient', 'female'::gender, '9000006057') RETURNING id",
    )
    .bind(other_tenant)
    .bind(format!("UH-OC-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("other patient");
    let (status, _) = fetch(
        &desk.client,
        &app,
        &format!("/api/print-data/opd-card/{foreign}"),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "another hospital's patient");

    // A patient this receptionist registered is theirs: the whole card.
    let own = register(&app, &desk.client, &desk.csrf).await;
    let own_id = own["id"].as_str().expect("own patient id");
    let (status, body) = fetch(
        &desk.client,
        &app,
        &format!("/api/print-data/opd-card/{own_id}"),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["address"], "4 North Street, Sample Town");
}
