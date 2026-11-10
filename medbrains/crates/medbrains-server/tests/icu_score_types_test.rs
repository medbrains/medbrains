//! Every ICU score type the database holds reads back.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: reqwest::Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Every score type the database can hold reads back, and a NEWS2 recorded on
/// an ICU admission is listed instead of failing the whole scores tab.
#[tokio::test]
async fn every_icu_score_type_reads_back() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let all: Vec<medbrains_core::icu::IcuScoreType> =
        sqlx::query_scalar("SELECT unnest(enum_range(NULL::icu_score_type))")
            .fetch_all(&app.db)
            .await
            .expect("every icu_score_type decodes");
    assert!(all.len() >= 25, "{all:?}");

    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("depts");
    let (_, patient) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/patients",
        json!({ "first_name": "Icu", "last_name": "Score", "gender": "male", "date_of_birth": "1960-01-01", "phone": "9990000611" }),
    )
    .await;
    let (status, admitted) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/ipd/admissions",
        json!({ "patient_id": patient["id"], "department_id": depts[0]["id"], "doctor_id": doctor.user_id }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{admitted}");
    let admission = admitted["admission"]["id"].as_str().expect("admission");
    let path = format!("/api/icu/admissions/{admission}/scores");
    for (score_type, value) in [("news2", 7), ("qsofa", 2)] {
        let (status, body) = send(
            &app,
            &csrf,
            reqwest::Method::POST,
            &path,
            json!({ "score_type": score_type, "score_value": value }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{score_type}: {body}");
    }
    let (status, scores) = send(&app, &csrf, reqwest::Method::GET, &path, Value::Null).await;
    assert_eq!(status, StatusCode::OK, "{scores}");
    let types: Vec<&str> = scores
        .as_array()
        .expect("scores")
        .iter()
        .filter_map(|s| s["score_type"].as_str())
        .collect();
    assert!(
        types.contains(&"news2") && types.contains(&"qsofa"),
        "{types:?}"
    );
}
