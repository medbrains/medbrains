//! IDSP P- and L-form line lists for IHIP.
//!
//! A presumptive case belongs on the P-form, a lab-confirmed one on the
//! L-form, TB on neither (it goes to Ni-kshay). Making a list and recording it
//! as entered on IHIP are both recorded disclosures, and a list whose cases
//! changed since it was made cannot be recorded.

use crate::common;
use crate::notifiable_detection_test::{Hospital, hospital};

use chrono::NaiveDate;
use reqwest::{Method, StatusCode};
use serde_json::{Value, json};

async fn status_of(h: &Hospital, req: reqwest::RequestBuilder) -> StatusCode {
    req.header("x-csrf-token", &h.csrf)
        .send()
        .await
        .expect("request")
        .status()
}

async fn disclosures(app: &common::TestApp, h: &Hospital, stage: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 \
            AND action = 'statutory_disclosure' AND new_values->>'stage' = $2 \
            AND new_values->>'recipient' = 'IDSP/IHIP'",
    )
    .bind(h.tenant)
    .bind(stage)
    .fetch_one(&app.db)
    .await
    .expect("audit")
}

/// Given a dengue diagnosis in OPD, a positive NS1 on another patient and a
/// TB diagnosis, When the week's lists are made, Then the P-form holds the
/// dengue diagnosis, the L-form the NS1 case, and neither holds TB; recording
/// the P-form marks its case submitted, once.
#[tokio::test]
async fn each_form_lists_its_own_cases_and_is_recorded_once() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let today: NaiveDate = sqlx::query_scalar("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date")
        .fetch_one(&app.db)
        .await
        .expect("today");

    let coded = h.patient(&app, "9990000901").await;
    let visit = h.opd_visit(&app, &coded).await;
    for code in ["1D20.0", "1B10"] {
        h.call(
            &app,
            Method::POST,
            &format!("/api/opd/encounters/{visit}/diagnoses"),
            json!({ "icd_code": code, "icd_system": "icd11", "description": "Coded" }),
        )
        .await;
    }
    let tested = h.patient(&app, "9990000902").await;
    let visit2 = h.opd_visit(&app, &tested).await;
    h.verified_result(
        &app,
        &tested,
        &visit2,
        ("DNS1", "Dengue NS1 antigen"),
        "Positive",
    )
    .await;

    let list = |form: &str, from: NaiveDate| {
        format!("/api/ckb/ihip/line-list?form={form}&from={from}&to={today}")
    };
    let p = h
        .call(&app, Method::GET, &list("P", today), Value::Null)
        .await;
    assert_eq!(p["rows"].as_array().map(Vec::len), Some(1), "P-form: {p}");
    assert_eq!(p["summary"][0]["icd10_code"], "A90");
    let l = h
        .call(&app, Method::GET, &list("L", today), Value::Null)
        .await;
    assert_eq!(l["rows"].as_array().map(Vec::len), Some(1), "L-form: {l}");
    let columns: Vec<String> = serde_json::from_value(l["columns"].clone()).expect("columns");
    let test_done = columns
        .iter()
        .position(|c| c == "Test done")
        .expect("column");
    assert_eq!(l["rows"][0][test_done], "Dengue NS1 antigen");
    assert_eq!(disclosures(&app, &h, "prepared").await, 2);

    let too_long = today - chrono::Days::new(40);
    let req = h.client.get(app.url(&list("P", too_long)));
    assert_eq!(status_of(&h, req).await, StatusCode::BAD_REQUEST);

    // The L-form's case cannot be recorded as a P-form.
    let wrong = json!({ "form": "P", "report_ids": l["report_ids"], "acknowledgement": "X" });
    let req = h.client.post(app.url("/api/ckb/ihip/submit")).json(&wrong);
    assert_eq!(status_of(&h, req).await, StatusCode::CONFLICT);

    let submit =
        json!({ "form": "P", "report_ids": p["report_ids"], "acknowledgement": "IHIP/TN/0042" });
    let done = h
        .call(&app, Method::POST, "/api/ckb/ihip/submit", submit.clone())
        .await;
    assert_eq!(done["submitted"], 1);
    let req = h.client.post(app.url("/api/ckb/ihip/submit")).json(&submit);
    assert_eq!(
        status_of(&h, req).await,
        StatusCode::CONFLICT,
        "recorded twice"
    );
    assert_eq!(disclosures(&app, &h, "submitted").await, 1);

    let ack: Option<String> = sqlx::query_scalar(
        "SELECT report_ref FROM notifiable_disease_reports \
          WHERE tenant_id = $1 AND icd10_code = 'A90' AND case_class = 'presumptive'",
    )
    .bind(h.tenant)
    .fetch_one(&app.db)
    .await
    .expect("report");
    assert_eq!(ack.as_deref(), Some("IHIP/TN/0042"));
}
