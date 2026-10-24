//! The deep-link SMS (M2 HIP_INIT_NOTIFY_HIECM): a patient with a mobile
//! and no ABHA here is texted the ABHA app link by ABDM — once, when a
//! record of theirs is captured, and again from the chart on request (not
//! inside ten minutes, never for a patient who has an ABHA here, by staff
//! holding `abdm.records.notify`). ABDM's answer is shown on the chart.

use crate::abdm_hip_world::world;
use crate::common;

use axum::http::StatusCode as MockStatus;
use medbrains_abdm::gateway::{CB_SMS_ON_NOTIFY, SMS_NOTIFY_PATH};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[tokio::test]
async fn a_patient_without_an_abha_is_texted_the_app_link_and_its_answer_shown() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let db = &w.app.db;
    let phone = format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000);
    let walk_in: Value = w
        .app
        .client
        .post(w.app.url("/api/patients"))
        .header("x-csrf-token", &w.csrf)
        .json(
            &json!({ "first_name": "Ravi", "last_name": "K", "gender": "male",
                       "date_of_birth": "1980-01-01", "phone": phone }),
        )
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("patient");
    let patient = walk_in["id"].as_str().expect("id").to_owned();

    // A finished visit is captured, and with it the one automatic text.
    let visit: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status) \
        SELECT tenant_id, id, 'opd', 'open' FROM patients WHERE id = $1::uuid RETURNING id",
    )
    .bind(&patient)
    .fetch_one(db)
    .await
    .expect("visit");
    sqlx::query("UPDATE encounters SET status = 'completed' WHERE id = $1")
        .bind(visit)
        .execute(db)
        .await
        .expect("close");
    let queued: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM outbox_events \
        WHERE event_type = 'abdm.patient.sms_link' AND aggregate_id = $1::uuid",
    )
    .bind(&patient)
    .fetch_one(db)
    .await
    .expect("outbox");
    assert_eq!(queued, 1, "once per patient");

    let path = format!("/api/abdm/patients/{patient}/sms-link");
    let lab = common::provision_staff(&w.app, &w.csrf, "lab_technician", &[]).await;
    let refused = lab
        .client
        .post(w.app.url(&path))
        .header("x-csrf-token", &lab.csrf)
        .send()
        .await
        .expect("lab");
    assert_eq!(
        refused.status(),
        StatusCode::FORBIDDEN,
        "texting a patient is its own permission"
    );

    let sent = w
        .app
        .client
        .post(w.app.url(&path))
        .header("x-csrf-token", &w.csrf)
        .send()
        .await
        .expect("send");
    assert_eq!(sent.status(), StatusCode::OK);
    let call = w.last(SMS_NOTIFY_PATH);
    assert_eq!(call.body["notification"]["phoneNo"], format!("91{phone}"));
    assert_eq!(call.body["notification"]["hip"]["id"], w.hip_id.as_str());
    let request_id = call
        .headers
        .get("request-id")
        .and_then(|v| v.to_str().ok())
        .expect("request id")
        .to_owned();
    let again = w
        .app
        .client
        .post(w.app.url(&path))
        .header("x-csrf-token", &w.csrf)
        .send()
        .await
        .expect("again");
    assert_eq!(
        again.status(),
        StatusCode::TOO_MANY_REQUESTS,
        "not again inside ten minutes"
    );

    let answer = json!({ "error": { "code": "ABDM-1004", "message": "SMS Gateway is unavailable" },
        "acknowledgement": { "status": "ERRORED" }, "response": { "requestId": request_id } });
    assert_eq!(
        w.callback(CB_SMS_ON_NOTIFY, &w.gateway_key, answer).await,
        MockStatus::ACCEPTED
    );
    let records: Value = w
        .app
        .client
        .get(w.app.url(&format!("/api/abdm/patients/{patient}/records")))
        .send()
        .await
        .expect("records")
        .json()
        .await
        .expect("json");
    assert_eq!(records["sms_link"]["status"], "failed", "{records}");
    assert!(
        records["sms_link"]["error"]
            .as_str()
            .is_some_and(|e| e.contains("SMS service is down")),
        "{records}"
    );
    assert_eq!(records["sms_link"]["phone_last4"], phone[phone.len() - 4..]);

    let own = format!("/api/abdm/patients/{}/sms-link", w.patient_id);
    let has_abha = w
        .app
        .client
        .post(w.app.url(&own))
        .header("x-csrf-token", &w.csrf)
        .send()
        .await
        .expect("abha");
    assert_eq!(
        has_abha.status(),
        StatusCode::BAD_REQUEST,
        "a patient with an ABHA here needs no link"
    );
}
