//! A patient's early-warning plan and the hospital's policy: SpO2 Scale 2
//! is a doctor's prescription and changes how the next reading scores; the
//! policy is an administrator's, refuses unsafe settings, and sets the next
//! due time; a role without the permissions is refused.

use crate::common::{self, Staff};
use crate::ews_auto_score_test::{SERIAL, admit, chart, minutes_until, normal, send, with};

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn scale_2_is_a_doctors_prescription_and_the_policy_refuses_unsafe_settings() {
    let _serial = SERIAL.lock().await;
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let w = admit(&app, "66 years", &nurse, &doctor).await;
    let plan = format!("/api/nurse/ews/plan/{}", w.encounter);
    let scale2 = json!({"spo2_scale2": true, "scale2_target": "88-92%", "reason": "COPD with type 2 respiratory failure"});
    let (status, _) = send(&nurse, &app, (Method::PUT, &plan), &scale2).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a nurse does not prescribe Scale 2"
    );
    let (status, _) = send(
        &doctor,
        &app,
        (Method::PUT, &plan),
        &json!({"spo2_scale2": true, "reason": "COPD"}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "Scale 2 needs its target range"
    );
    let (status, set) = send(&doctor, &app, (Method::PUT, &plan), &scale2).await;
    assert_eq!(status, StatusCode::OK, "{set}");
    // SpO2 89 on oxygen: Scale 1 would score 3; Scale 2 scores 0 (+2 for oxygen).
    let ews = chart(
        &nurse,
        &app,
        &with(
            normal(w.encounter),
            &json!({"spo2": 89, "oxygen_device": "nasal_prongs"}),
        ),
    )
    .await;
    assert_eq!(
        (ews["spo2_scale"].as_i64(), ews["total"].as_i64()),
        (Some(2), Some(2))
    );

    let (status, _) = send(
        &desk,
        &app,
        (Method::GET, "/api/nurse/ews/escalations"),
        &Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let admin = Staff {
        client: app.client.clone(),
        csrf: csrf.clone(),
        user_id: Uuid::nil(),
    };
    let (_, mut policy) = send(
        &admin,
        &app,
        (Method::GET, "/api/nurse/ews/policy"),
        &Value::Null,
    )
    .await;
    let (status, _) = send(
        &nurse,
        &app,
        (Method::PUT, "/api/nurse/ews/policy"),
        &policy,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let mut unsafe_policy = policy.clone();
    unsafe_policy["escalate_bands"] = json!(["urgent"]);
    let (status, _) = send(
        &admin,
        &app,
        (Method::PUT, "/api/nurse/ews/policy"),
        &unsafe_policy,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "the emergency band always escalates"
    );
    policy["news2"]["routine"] = json!(360);
    let (status, _) = send(
        &admin,
        &app,
        (Method::PUT, "/api/nurse/ews/policy"),
        &policy,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let other = admit(&app, "50 years", &nurse, &doctor).await;
    let ews = chart(&nurse, &app, &normal(other.encounter)).await;
    assert!(
        (355..=360).contains(&minutes_until(&ews)),
        "the hospital's frequency applies"
    );
    policy["news2"]["routine"] = json!(720);
    let (status, _) = send(
        &admin,
        &app,
        (Method::PUT, "/api/nurse/ews/policy"),
        &policy,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "restore the default for other tests"
    );
}
