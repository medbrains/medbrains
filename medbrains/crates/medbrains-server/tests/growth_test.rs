//! A child's growth chart from what was charted at visits.

use crate::common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("post");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{path} → {status}: {text}");
    serde_json::from_str(&text).unwrap_or(Value::Null)
}

/// A boy born `days` ago with one OPD visit; returns (patient id, encounter id).
async fn child(app: &common::TestApp, csrf: &str, days: i64, gender: &str) -> (String, String) {
    let dob = (Utc::now() - Duration::days(days)).date_naive();
    let phone = format!("97{}", &uuid::Uuid::new_v4().as_u128().to_string()[..8]);
    let p = post(
        app,
        csrf,
        "/api/patients",
        json!({ "first_name": "Growth", "last_name": "Child",
        "gender": gender, "date_of_birth": dob, "phone": phone }),
    )
    .await;
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("depts");
    let visit = post(
        app,
        csrf,
        "/api/opd/encounters",
        json!({ "patient_id": p["id"],
        "department_id": depts[0]["id"], "encounter_type": "opd" }),
    )
    .await;
    (
        p["id"].as_str().expect("id").to_owned(),
        visit["encounter"]["id"].as_str().expect("enc").to_owned(),
    )
}

#[tokio::test]
async fn a_childs_charted_weight_length_and_head_are_scored_on_who_charts() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (patient, encounter) = child(&app, &csrf, 365, "male").await;
    // 12-month boy: WHO median weight 9.6 kg; 7.5 kg is below -2 SD (7.7).
    post(
        &app,
        &csrf,
        &format!("/api/opd/encounters/{encounter}/vitals"),
        json!({ "weight_kg": 7.5, "height_cm": 75.7, "head_circumference_cm": 46.1 }),
    )
    .await;

    let g: Value = app
        .get(&app.client, &format!("/api/patients/{patient}/growth"))
        .await
        .json()
        .await
        .expect("growth");
    assert!(g["unavailable"].is_null(), "{g}");
    let chart = |k: &str| {
        g["charts"]
            .as_array()
            .expect("charts")
            .iter()
            .find(|c| c["key"] == k)
            .cloned()
            .expect(k)
    };
    let wfa = chart("who_wfa");
    let p = &wfa["points"][0];
    assert_eq!(p["value"], 7.5);
    assert!(p["z"].as_f64().expect("z") < -2.0, "{p}");
    assert_eq!(p["flags"][0]["code"], "below_minus2");
    assert_eq!(
        wfa["lines"].as_array().map(Vec::len),
        Some(5),
        "-3, -2, median, +2, +3"
    );
    let hc = &chart("who_hcfa")["points"][0];
    assert!(
        hc["z"].as_f64().expect("z").abs() < 0.3,
        "46.1 cm is about the median at 12 months: {hc}"
    );
    assert_eq!(chart("who_wfl")["points"].as_array().map(Vec::len), Some(1));

    // Born at 32 weeks: judged 8 weeks younger, and the same weight scores higher.
    let put = app
        .client
        .put(app.url(&format!("/api/patients/{patient}/growth/gestation")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "weeks": 32 }))
        .send()
        .await
        .expect("put");
    assert_eq!(put.status(), StatusCode::OK);
    let g2: Value = app
        .get(&app.client, &format!("/api/patients/{patient}/growth"))
        .await
        .json()
        .await
        .expect("growth");
    let p2 = g2["charts"]
        .as_array()
        .expect("charts")
        .iter()
        .find(|c| c["key"] == "who_wfa")
        .expect("wfa")["points"][0]
        .clone();
    assert_eq!(
        (p2["corrected"].as_bool(), p2["age_days"].as_i64()),
        (Some(true), Some(365 - 56))
    );
    assert!(p2["z"].as_f64() > p["z"].as_f64());

    let bad = app
        .client
        .put(app.url(&format!("/api/patients/{patient}/growth/gestation")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "weeks": 12 }))
        .send()
        .await
        .expect("put");
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn no_chart_is_guessed_for_an_unrecorded_sex_or_an_adult() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (patient, _) = child(&app, &csrf, 400, "other").await;
    let g: Value = app
        .get(&app.client, &format!("/api/patients/{patient}/growth"))
        .await
        .json()
        .await
        .expect("growth");
    assert!(
        g["unavailable"]
            .as_str()
            .unwrap_or_default()
            .contains("boys and girls"),
        "{g}"
    );
    assert_eq!(g["charts"].as_array().map(Vec::len), Some(0));
    let (adult, _) = child(&app, &csrf, 40 * 365, "female").await;
    let g: Value = app
        .get(&app.client, &format!("/api/patients/{adult}/growth"))
        .await
        .json()
        .await
        .expect("growth");
    assert!(
        g["unavailable"]
            .as_str()
            .unwrap_or_default()
            .contains("18 years")
    );
}

#[tokio::test]
async fn growth_charts_need_their_permission() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (patient, _) = child(&app, &csrf, 200, "female").await;
    let denied = common::provision_staff(&app, &csrf, "doctor", &["patients.growth.view"]).await;
    let resp = app
        .get(&denied.client, &format!("/api/patients/{patient}/growth"))
        .await;
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
}
