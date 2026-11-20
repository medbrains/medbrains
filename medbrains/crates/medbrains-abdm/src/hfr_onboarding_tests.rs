//! The onboarding calls against a stand-in HFR on 127.0.0.1:0: what each
//! call sends (path, HPR headers, `trackingId`) and how each answer is read.

use std::sync::{Arc, Mutex, PoisonError};

use axum::{Json, Router, extract::State, http::HeaderMap, routing::any};
use serde_json::{Value, json};

use super::*;

/// What the stand-in saw: path, the two HPR headers, and the body.
#[derive(Clone, Debug, Default)]
struct Seen {
    path: String,
    auth: Option<String>,
    verifier: Option<String>,
    body: Value,
}

type Log = Arc<Mutex<Vec<Seen>>>;

/// A stand-in that records each call and answers `reply`.
async fn stand_in(reply: Value) -> (String, Log) {
    let log: Log = Arc::default();
    let app = Router::new()
        .fallback(any(
            |State((log, reply)): State<(Log, Value)>,
             uri: axum::http::Uri,
             headers: HeaderMap,
             body: String| async move {
                let header = |n: &str| {
                    headers
                        .get(n)
                        .and_then(|v| v.to_str().ok())
                        .map(str::to_owned)
                };
                log.lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .push(Seen {
                        path: uri.to_string(),
                        auth: header(HPRID_AUTH),
                        verifier: header(HPRID_AUTH_VERIFIER),
                        body: serde_json::from_str(&body).unwrap_or(Value::Null),
                    });
                Json(reply)
            },
        ))
        .with_state((Arc::clone(&log), reply));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.ok();
    let listener = listener.unwrap_or_else(|| unreachable!("bind stand-in"));
    let addr = listener
        .local_addr()
        .map(|a| a.to_string())
        .unwrap_or_default();
    tokio::spawn(async move { axum::serve(listener, app).await });
    (format!("http://{addr}"), log)
}

/// The first call the stand-in saw.
fn first(log: &Log) -> Seen {
    log.lock()
        .unwrap_or_else(PoisonError::into_inner)
        .first()
        .cloned()
        .unwrap_or_default()
}

/// HFR-010…038: the first basic save sends `trackingId` `""` with the
/// manager's HPR token and keeps the `trackingId` HFR returns.
#[tokio::test]
async fn basic_save_sends_the_manager_token_and_keeps_the_tracking_id() {
    let (base, log) =
        stand_in(json!({ "trackingId": 80266, "status": "SUCCESS", "errorStatus": [] })).await;
    let info = FacilityInformation {
        facility_name: "Sahyadri Hospital".to_owned(),
        ..Default::default()
    };
    let outcome = hfr_save_basic(
        &reqwest::Client::new(),
        &base,
        "gw",
        "hpr-manager",
        ("", &info),
    )
    .await;
    let outcome = outcome.unwrap_or_default();
    assert_eq!(outcome.tracking_id.as_deref(), Some("80266"));
    assert!(outcome.is_saved());
    let seen = first(&log);
    assert_eq!(seen.path, HFR_BASIC_PATH);
    assert_eq!(seen.auth.as_deref(), Some("hpr-manager"));
    assert_eq!(seen.body["trackingId"], "");
    assert_eq!(
        seen.body["facilityInformation"]["facilityName"],
        "Sahyadri Hospital"
    );
    assert!(
        seen.body["facilityInformation"]["facilityAddressDetails"]
            .get("stateLGDCode")
            .is_some()
    );
}

/// HFR-039…061: additional and detailed saves carry the run's `trackingId`.
#[tokio::test]
async fn later_steps_carry_the_tracking_id() {
    let (base, log) = stand_in(json!({ "trackingId": "80266", "errorStatus": [] })).await;
    let body = json!({ "linkedProgramIds": { "nin": "1234" } });
    let http = reqwest::Client::new();
    let outcome = hfr_save_step(&http, &base, "gw", (HFR_ADDITIONAL_PATH, "80266"), &body).await;
    assert!(outcome.is_ok_and(|o| o.is_saved()));
    let seen = first(&log);
    assert_eq!(seen.path, HFR_ADDITIONAL_PATH);
    assert_eq!(seen.body["trackingId"], "80266");
    assert_eq!(seen.body["linkedProgramIds"]["nin"], "1234");
}

/// HFR-062/063: submit sends both HPR tokens, empty source fields, and
/// reads the facility ID HFR issues.
#[tokio::test]
async fn submit_sends_manager_and_verifier_tokens() {
    let (base, log) =
        stand_in(json!({ "facilityId": "IN2710000123", "status": "Submitted", "message": "ok" }))
            .await;
    let outcome = hfr_submit(
        &reqwest::Client::new(),
        &base,
        "gw",
        "80266",
        ("m-token", "v-token"),
    )
    .await;
    assert_eq!(
        outcome.unwrap_or_default().facility_id.as_deref(),
        Some("IN2710000123")
    );
    let seen = first(&log);
    assert_eq!(seen.path, HFR_SUBMIT_PATH);
    assert_eq!(
        (seen.auth.as_deref(), seen.verifier.as_deref()),
        (Some("m-token"), Some("v-token"))
    );
    assert_eq!(seen.body["trackingId"], "80266");
    assert_eq!(seen.body["sourceOfInformation"], "");
}

/// A 200 that lists refused fields did not save the step.
#[test]
fn a_200_with_error_status_is_not_saved() {
    let o = StepOutcome::read(
        &json!({ "trackingId": "1", "errorStatus": ["latitude is invalid", { "message": "pincode" }] }),
    );
    assert!(!o.is_saved());
    assert_eq!(
        o.errors,
        vec!["latitude is invalid".to_owned(), "pincode".to_owned()]
    );
}

/// HFR-004…006, 014…016: LGD lists are arrays; master data is under `data`.
#[tokio::test]
async fn masters_are_read_as_code_and_name() {
    let (base, log) = stand_in(json!([{ "code": "6752", "name": "Assar" }])).await;
    let http = reqwest::Client::new();
    let districts = hfr_master(
        &http,
        &base,
        "gw",
        &Master::SubDistricts {
            district_code: "521".to_owned(),
        },
    )
    .await;
    assert_eq!(
        districts.unwrap_or_default(),
        vec![MasterOption {
            code: "6752".to_owned(),
            name: "Assar".to_owned()
        }]
    );
    assert_eq!(
        first(&log).path,
        "/v1.5/facility/lgd/subdistricts?districtCode=521"
    );
    let data =
        read_master(&json!({ "type": "OWNER", "data": [{ "code": "G", "value": "Government" }] }));
    assert_eq!(data[0].name, "Government");
}

/// HFR-008/009: page 1, ten per page, whatever the form says.
#[test]
fn search_pages_are_fixed_and_hits_read() {
    let body = FacilitySearch {
        facility_name: " sahya ".to_owned(),
        ..Default::default()
    }
    .body();
    assert_eq!(
        (body["page"].clone(), body["resultsPerPage"].clone()),
        (json!(1), json!(10))
    );
    assert_eq!(body["facilityName"], "sahya");
    let page = SearchPage::read(&json!({ "facilities": [
        { "facilityId": "IN2710000123", "facilityName": "Sahyadri", "facilityStatus": "Approved" },
        { "facilityName": "no id, skipped" }
    ], "totalFacilities": 1 }));
    assert_eq!(page.facilities.len(), 1);
    assert_eq!(page.total, 1);
}

/// HFR-057/060: the totals are computed, never typed.
#[test]
fn totals_follow_the_workbook() {
    let m = MedicalInfrastructure {
        count_ipd_beds_without_oxygen: 2,
        count_ipd_beds_with_oxygen: 3,
        count_icu_beds_with_ventilators: 4,
        count_icu_beds_without_ventilators: 1,
        count_hdu_beds_with_ventilators: 5,
        count_hdu_beds_without_ventilators: 6,
        count_day_care_beds_with_oxygen: 9,
        total_number_of_beds: 9999,
        ..Default::default()
    }
    .with_totals();
    assert_eq!(
        (m.total_number_of_ventilators, m.total_number_of_beds),
        (9, 21)
    );
}

/// The password is encrypted under HPR's key: armour and JSON are unwrapped.
#[test]
fn hpr_certificate_is_unwrapped() {
    assert_eq!(
        read_certificate("-----BEGIN PUBLIC KEY-----\nMIIB\nIjAN\n-----END PUBLIC KEY-----\n"),
        "MIIBIjAN"
    );
    assert_eq!(read_certificate(r#"{"publicKey":"MIIB IjAN"}"#), "MIIBIjAN");
}

/// HPR login sends the HPR ID and the encrypted password, and reads `token`.
#[tokio::test]
async fn hpr_login_reads_the_token() {
    let (base, log) = stand_in(json!({ "token": "hpr-jwt" })).await;
    let token = hpr_login(
        &reqwest::Client::new(),
        &base,
        "gw",
        "manager@hpr.abdm",
        "ENC",
    )
    .await;
    assert_eq!(token.ok().flatten().as_deref(), Some("hpr-jwt"));
    let seen = first(&log);
    assert_eq!(seen.path, HPR_LOGIN_PATH);
    assert_eq!(
        (seen.body["hprId"].clone(), seen.body["password"].clone()),
        (json!("manager@hpr.abdm"), json!("ENC"))
    );
}
