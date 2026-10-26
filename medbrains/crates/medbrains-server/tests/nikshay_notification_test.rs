//! TB notification to Ni-kshay (migration 1260).
//!
//! A TB case -- coded by a doctor or found by CBNAAT -- is a notification the
//! hospital owes. Its details fill the MoHFW hospital form, the sheet made for
//! submission is a recorded disclosure, and the case is not "notified" until
//! Ni-kshay has given it an ID.

use crate::common;
use crate::notifiable_detection_test::{Hospital, hospital};

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};

async fn tb_cases(h: &Hospital, app: &common::TestApp) -> Vec<Value> {
    serde_json::from_value(
        h.call(app, Method::GET, "/api/ckb/nikshay", Value::Null)
            .await,
    )
    .unwrap_or_default()
}

async fn status_of(h: &Hospital, app: &common::TestApp, path: &str, body: Value) -> StatusCode {
    h.client
        .put(app.url(path))
        .header("x-csrf-token", &h.csrf)
        .json(&body)
        .send()
        .await
        .expect("request")
        .status()
}

async fn disclosures(app: &common::TestApp, h: &Hospital, stage: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 \
            AND action = 'statutory_disclosure' AND new_values->>'stage' = $2 \
            AND new_values->>'recipient' ILIKE '%ni-kshay%'",
    )
    .bind(h.tenant)
    .bind(stage)
    .fetch_one(&app.db)
    .await
    .expect("audit")
}

/// Given lymph-node TB coded in OPD (ICD-11), When the details are filled and the sheet
/// is made, Then the sheet carries the case in the form's columns and the
/// making is audited; and the case is notified only with a Ni-kshay ID.
#[tokio::test]
async fn a_coded_tb_case_is_filled_sheeted_and_notified_with_its_id() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let patient = h.patient(&app, "9990000801").await;
    let encounter = h.opd_visit(&app, &patient).await;
    h.call(
        &app,
        Method::POST,
        &format!("/api/opd/encounters/{encounter}/diagnoses"),
        json!({ "icd_code": "1B12.4", "icd_system": "icd11",
                "description": "Tuberculous peripheral lymphadenopathy" }),
    )
    .await;

    let cases = tb_cases(&h, &app).await;
    assert_eq!(cases.len(), 1);
    let report = cases[0]["report_id"].as_str().expect("report").to_owned();
    assert_eq!(
        cases[0]["basis"],
        Value::Null,
        "nothing implies a basis yet"
    );

    // Extra-pulmonary without its site is refused.
    let path = format!("/api/ckb/nikshay/{report}");
    let partial = json!({ "site": "EP", "patient_type": "new", "basis": "fnac" });
    assert_eq!(
        status_of(&h, &app, &path, partial).await,
        StatusCode::BAD_REQUEST
    );
    h.call(
        &app,
        Method::PUT,
        &path,
        json!({ "site": "EP", "ep_site": "Cervical lymph node", "patient_type": "new",
                "basis": "fnac", "diagnosed_on": "2026-10-20",
                "treatment_started_on": "2026-10-21", "weight_kg": 48.5,
                "regimen": "H 300 / R 450 / Z 1250 / E 825" }),
    )
    .await;

    let sheet = h
        .call(&app, Method::GET, "/api/ckb/nikshay/sheet", Value::Null)
        .await;
    let columns: Vec<String> = serde_json::from_value(sheet["columns"].clone()).expect("columns");
    let row: Vec<String> = serde_json::from_value(sheet["rows"][0].clone()).expect("row");
    let cell = |name: &str| {
        let i = columns
            .iter()
            .position(|c| c.starts_with(name))
            .expect(name);
        row[i].clone()
    };
    assert_eq!(cell("Name of TB patient"), "Case Notify");
    assert_eq!(cell("Sex"), "F");
    assert_eq!(cell("Site of disease"), "EP (Cervical lymph node)");
    assert_eq!(cell("Basis of diagnosis"), "FNAC");
    assert_eq!(cell("Date of TB treatment initiation"), "21/10/2026");
    assert_eq!(cell("Weight in kg"), "48.5");
    assert_eq!(disclosures(&app, &h, "prepared").await, 1);

    // Not notified without the Ni-kshay ID; notified with it, and audited.
    let submit = format!("/api/ckb/notifiable-reports/{report}");
    let bare = json!({ "status": "submitted" });
    assert_eq!(
        status_of(&h, &app, &submit, bare).await,
        StatusCode::BAD_REQUEST
    );
    h.call(
        &app,
        Method::PUT,
        &submit,
        json!({ "status": "submitted", "report_ref": "10458921" }),
    )
    .await;
    let cases = tb_cases(&h, &app).await;
    assert_eq!(cases[0]["nikshay_id"], "10458921");
    assert_eq!(cases[0]["status"], "submitted");
    assert_eq!(disclosures(&app, &h, "submitted").await, 1);
}

/// Given a CBNAAT reporting MTB detected, Then the TB case it opens is
/// lab-confirmed with PCR as its basis -- before anyone has typed a thing.
#[tokio::test]
async fn a_positive_cbnaat_opens_a_confirmed_case_with_its_basis() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let patient = h.patient(&app, "9990000802").await;
    let encounter = h.opd_visit(&app, &patient).await;
    h.verified_result(
        &app,
        &patient,
        &encounter,
        ("CBNAAT", "CBNAAT MTB/RIF"),
        "MTB detected, rifampicin resistance not detected",
    )
    .await;
    let cases = tb_cases(&h, &app).await;
    assert_eq!(cases.len(), 1);
    assert_eq!(cases[0]["case_class"], "confirmed");
    assert_eq!(cases[0]["basis"], "pcr");
}
