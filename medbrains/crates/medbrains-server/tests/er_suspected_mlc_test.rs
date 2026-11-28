//! A complaint that reads like a medico-legal case never blocks care: the
//! receptionist's visit and the nurse's triage save, the visit is flagged as a
//! possible MLC, and only a holder of `emergency.mlc.review_suspected`
//! decides it. A case registered without naming a visit lands on the
//! patient's open ER visit.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Sends `req` with the caller's CSRF token; the status and the JSON body.
async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A patient whose consultant is `doctor`, so the doctor is on their record.
async fn patient_of(app: &common::TestApp, csrf: &str, doctor: Uuid) -> Value {
    let (status, patient) = send(
        csrf,
        app.client.post(app.url("/api/patients")).json(&json!({
            "first_name": "Trauma",
            "last_name": "Sample",
            "gender": "male",
            "date_of_birth": "1990-01-01",
            "phone": format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]),
            "consultant_id": doctor,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{patient}");
    patient["id"].clone()
}

/// The visit as its own GET returns it to `staff`.
async fn visit(app: &common::TestApp, staff: &common::Staff, id: &Value) -> Value {
    let url = app.url(&format!(
        "/api/emergency/visits/{}",
        id.as_str().expect("id")
    ));
    let (status, body) = send(&staff.csrf, staff.client.get(url)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body
}

/// Given a receptionist and a nurse without `emergency.mlc.create`, When one
/// registers a road-accident arrival and the other triages an assault, Then
/// both save and the visits are flagged as suspected, with no MLC case and an
/// audit row; the nurse cannot decide the flag; the doctor's dismissal needs a
/// reason; the doctor's confirmation registers the case on that visit; and a
/// case registered from the MLC tab lands on the patient's open visit.
#[tokio::test]
async fn a_trauma_complaint_saves_and_waits_for_a_doctor() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let visits = app.url("/api/emergency/visits");

    let (status, first) = send(
        &desk.csrf,
        desk.client.post(&visits).json(&json!({
            "patient_id": patient_of(&app, &csrf, doctor.user_id).await,
            "arrival_mode": "ambulance",
            "chief_complaint": "Road traffic accident, bike skid, left leg pain",
        })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the receptionist registers: {first}"
    );
    let seen = visit(&app, &desk, &first["id"]).await;
    assert_eq!(seen["mlc_suspicion"], "suspected", "{seen}");
    assert_eq!(seen["mlc_suspected_type"], "road_traffic_accident");
    assert_eq!(seen["is_mlc"], false, "suspected is not registered");
    let first_id: Uuid = first["id"].as_str().expect("id").parse().expect("uuid");
    let cases: i64 = sqlx::query_scalar("SELECT count(*) FROM mlc_cases WHERE er_visit_id = $1")
        .bind(first_id)
        .fetch_one(&app.db)
        .await
        .expect("cases");
    assert_eq!(cases, 0, "no MLC case from text alone");
    let audited: Option<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM audit_log WHERE entity_id = $1 AND action = 'er_visit.mlc_suspected'",
    )
    .bind(first_id)
    .fetch_one(&app.db)
    .await
    .expect("audit row");
    assert_eq!(audited, Some(desk.user_id), "who saved, and that it fired");

    let second_patient = patient_of(&app, &csrf, doctor.user_id).await;
    let (status, second) = send(
        &nurse.csrf,
        nurse.client.post(&visits).json(&json!({
            "patient_id": second_patient, "chief_complaint": "Scalp wound",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{second}");
    let seen = visit(&app, &nurse, &second["id"]).await;
    assert_eq!(seen["mlc_suspicion"], Value::Null, "nothing yet: {seen}");
    let triage_url = format!("{visits}/{}/triage", second["id"].as_str().expect("id"));
    let (status, triage) = send(
        &nurse.csrf,
        nurse.client.post(&triage_url).json(&json!({
            "triage_level": "urgent", "chief_complaint": "Assault, scalp laceration",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "the nurse triages: {triage}");
    let seen = visit(&app, &nurse, &second["id"]).await;
    assert_eq!(seen["mlc_suspicion"], "suspected", "{seen}");
    assert_eq!(seen["is_mlc"], false);

    let decide = format!("{visits}/{first_id}/mlc-suspicion");
    let confirm = json!({ "decision": "confirm" });
    let (status, _) = send(&nurse.csrf, nurse.client.put(&decide).json(&confirm)).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "the nurse cannot confirm");
    let dismiss = json!({ "decision": "dismiss" });
    let (status, _) = send(&doctor.csrf, doctor.client.put(&decide).json(&dismiss)).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a dismissal needs a reason"
    );
    let (status, decided) = send(&doctor.csrf, doctor.client.put(&decide).json(&confirm)).await;
    assert_eq!(status, StatusCode::OK, "the doctor confirms: {decided}");
    assert_eq!(decided["is_mlc"], true);
    let linked: Uuid = sqlx::query_scalar("SELECT id FROM mlc_cases WHERE er_visit_id = $1")
        .bind(first_id)
        .fetch_one(&app.db)
        .await
        .expect("the case is linked to the visit");
    assert_eq!(decided["mlc_case_id"], json!(linked));
    let (status, _) = send(&doctor.csrf, doctor.client.put(&decide).json(&confirm)).await;
    assert_eq!(status, StatusCode::CONFLICT, "nothing left to decide");

    let (status, case) = send(
        &doctor.csrf,
        doctor
            .client
            .post(app.url("/api/emergency/mlc"))
            .json(&json!({
                "patient_id": second_patient, "case_type": "assault",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    assert_eq!(
        case["er_visit_id"], second["id"],
        "linked to the open visit"
    );
    let seen = visit(&app, &doctor, &second["id"]).await;
    assert_eq!(seen["is_mlc"], true, "{seen}");
    assert_eq!(seen["mlc_suspicion"], "confirmed");
}

/// Given a possible MLC a doctor dismissed, When an MLC case is later
/// registered on that visit from the MLC tab, Then the visit reads confirmed,
/// decided by whoever registered it, never "dismissed" beside a live case.
#[tokio::test]
async fn a_case_registered_after_a_dismissal_confirms_the_visit() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let patient = patient_of(&app, &csrf, doctor.user_id).await;
    let visits = app.url("/api/emergency/visits");
    let (status, arrival) = send(
        &desk.csrf,
        desk.client.post(&visits).json(&json!({
            "patient_id": patient, "chief_complaint": "Road traffic accident, cut on arm",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{arrival}");
    let id = arrival["id"].as_str().expect("id");
    let dismiss = json!({ "decision": "dismiss", "reason": "Fell from own bicycle at home" });
    let decide = format!("{visits}/{id}/mlc-suspicion");
    let (status, _) = send(&doctor.csrf, doctor.client.put(&decide).json(&dismiss)).await;
    assert_eq!(status, StatusCode::OK, "the doctor dismisses");

    let (status, case) = send(
        &doctor.csrf,
        doctor
            .client
            .post(app.url("/api/emergency/mlc"))
            .json(&json!({
                "patient_id": patient, "er_visit_id": id, "case_type": "assault",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    let seen = visit(&app, &doctor, &arrival["id"]).await;
    assert_eq!(seen["is_mlc"], true, "{seen}");
    assert_eq!(seen["mlc_suspicion"], "confirmed", "{seen}");
    assert_eq!(seen["mlc_suspicion_decided_by"], json!(doctor.user_id));
}
