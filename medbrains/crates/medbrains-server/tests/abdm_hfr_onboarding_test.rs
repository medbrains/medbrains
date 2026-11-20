//! ABDM M4 HFR onboarding (#5716) end to end against a stand-in HFR/HPR on
//! 127.0.0.1:0: HPR sign-in for the manager and verifier (the password is
//! sent encrypted and never echoed), basic → additional → detailed with the
//! trackingId HFR issues, submit with both HPR headers, the draft the screen
//! resumes from, an update that re-sends the kept trackingId, and the
//! refusals the workbook asks for before anything is sent.

use crate::common;

use axum::{
    Json, Router,
    http::{HeaderMap, StatusCode as MockStatus},
    routing::{get, post},
};
use medbrains_abdm::hfr_onboarding::{
    HFR_ADDITIONAL_PATH, HFR_BASIC_PATH, HFR_DETAILED_PATH, HFR_SUBMIT_PATH, HPR_CERT_PATH,
    HPR_LOGIN_PATH, HPRID_AUTH, HPRID_AUTH_VERIFIER,
};
use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// A throwaway RSA public key (base64 DER) the stand-in publishes as HPR's.
const HPR_TEST_KEY: &str = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9T3rnRbfX8YrWJv780USM3uqjJ07aXaY0sWqr81s1GoB9HH6xZ0E69mQdNUBXpsvZHjZABiKhx1FTShjcEiEEKyoudFoBtYyWOXpx/AlZmEIxd3AGTySooHjuQxQphBVJvoq7sgEkkUiNf/osjHouNhdwo03Ix142Bmi4w+wZS/gkF/i1Ty2xbL9m2A/EDWZBE103qaqPp5Rt4xL5wVJ9Cw6/1IjWpkzynCO+lugdnvbGh6coIVYIpKQOKYf4hC3atzTD9ZmCq8r7GOFh6etAyFBWzwcBX0aEu/wLWjqEiv9xxC2ueFZ6NaiOmaCg7BEsx3TobTBB+llTWw3JRnDXQIDAQAB";
/// The trackingId the stand-in issues.
const TRACKING: &str = "80266";

/// The stand-in: HPR login answers a token named after the HPR ID; HFR
/// refuses a step without the right headers or trackingId.
async fn spawn_stand_in() -> String {
    async fn login(Json(b): Json<Value>) -> (MockStatus, Json<Value>) {
        let password = b["password"].as_str().unwrap_or_default();
        if password.is_empty() || password == "secret-pass" {
            // Plaintext reaching HPR would be a leak, not a login.
            return (
                MockStatus::BAD_REQUEST,
                Json(json!({ "message": "not encrypted" })),
            );
        }
        let id = b["hprId"].as_str().unwrap_or_default();
        (
            MockStatus::OK,
            Json(json!({ "token": format!("tok-{id}") })),
        )
    }
    async fn basic(headers: HeaderMap, Json(b): Json<Value>) -> (MockStatus, Json<Value>) {
        if headers.get(HPRID_AUTH).is_none() {
            return (
                MockStatus::UNAUTHORIZED,
                Json(json!({ "message": "x-hprid-auth" })),
            );
        }
        let given = b["trackingId"].as_str().unwrap_or_default();
        let ok = given.is_empty() || given == TRACKING;
        let errors: Vec<&str> = if ok {
            vec![]
        } else {
            vec!["unknown trackingId"]
        };
        (
            MockStatus::OK,
            Json(json!({ "trackingId": TRACKING, "errorStatus": errors })),
        )
    }
    async fn step(Json(b): Json<Value>) -> Json<Value> {
        let ok = b["trackingId"] == TRACKING;
        Json(
            json!({ "trackingId": TRACKING, "errorStatus": if ok { json!([]) } else { json!(["unknown trackingId"]) } }),
        )
    }
    async fn submit(headers: HeaderMap, Json(b): Json<Value>) -> (MockStatus, Json<Value>) {
        let both = headers.get(HPRID_AUTH).is_some() && headers.get(HPRID_AUTH_VERIFIER).is_some();
        if !both || b["trackingId"] != TRACKING {
            return (
                MockStatus::BAD_REQUEST,
                Json(json!({ "message": "headers" })),
            );
        }
        let digits: String = Uuid::new_v4()
            .as_u128()
            .to_string()
            .chars()
            .take(10)
            .collect();
        (
            MockStatus::OK,
            Json(
                json!({ "facilityId": format!("IN{digits}"), "status": "Submitted", "message": "ok" }),
            ),
        )
    }
    let app = Router::new()
        .route(
            HPR_CERT_PATH,
            get(|| async {
                format!("-----BEGIN PUBLIC KEY-----\n{HPR_TEST_KEY}\n-----END PUBLIC KEY-----\n")
            }),
        )
        .route(HPR_LOGIN_PATH, post(login))
        .route(HFR_BASIC_PATH, post(basic))
        .route(HFR_ADDITIONAL_PATH, post(step))
        .route(HFR_DETAILED_PATH, post(step))
        .route(HFR_SUBMIT_PATH, post(submit));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind stand-in");
    let addr = listener.local_addr().expect("stand-in addr");
    tokio::spawn(async move { axum::serve(listener, app).await.expect("stand-in crashed") });
    format!("http://{addr}")
}

async fn call(
    app: &common::TestApp,
    csrf: &str,
    (method, path): (Method, &str),
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

/// A basic information form that passes every workbook rule.
fn basic_form(name: &str) -> Value {
    json!({
        "facilityName": name,
        "facilityAddressDetails": { "country": "Nepal", "stateLGDCode": "27", "districtLGDCode": "521",
            "subDistrictLGDCode": "4242", "addressLine1": "Townhall Road", "pincode": "411001",
            "latitude": "18.520430", "longitude": "73.856743" },
        "ownershipCode": "P", "systemOfMedicineCode": "M", "facilityTypeCode": "5",
        "facilityOperationalStatus": "F",
        "timingsOfFacility": [{ "workingDays": "MON", "openingHours": "9:00 AM - 6:00 PM" }]
    })
}

/// Given ABDM keys and a campus, When the facility manager and a verifier
/// sign in to HPR and the four steps are saved and submitted, Then each step
/// carries HFR's trackingId, submit sends both HPR headers, the campus is
/// submitted with the issued facility ID, the draft resumes every step, and
/// an update re-sends the kept trackingId.
#[tokio::test]
async fn a_campus_is_onboarded_through_the_official_hfr_flow() {
    let stand_in = spawn_stand_in().await;
    let app = common::spawn_app_with_secrets(
        common::TestSecrets::default()
            .with("ABDM_GATEWAY_TOKEN_OVERRIDE", "test-session-token")
            .with("ABDM_HFR_BASE_URL_OVERRIDE", stand_in.clone())
            .with("ABDM_HPR_BASE_URL_OVERRIDE", stand_in),
    )
    .await;
    let csrf = app.login_admin().await;
    let code = format!(
        "HFRO-{}",
        Uuid::new_v4().simple().to_string()[..6].to_uppercase()
    );
    let (s, campus) = call(&app, &csrf, (Method::POST, "/api/setup/facilities"),
        json!({ "code": code, "name": format!("Campus {code}"), "facility_type": "main_hospital", "bed_count": 20 })).await;
    assert!(s.is_success(), "{campus}");
    let base = format!(
        "/api/abdm/hfr/facilities/{}/onboarding",
        campus["id"].as_str().expect("id")
    );
    let path = |step: &str| format!("{base}/{step}");

    // HFR-010: no HPR sign-in, nothing sent.
    let (s, body) = call(
        &app,
        &csrf,
        (Method::POST, &path("basic")),
        basic_form("Sahyadri Hospital"),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{body}");

    for (role, id) in [
        ("manager", "manager@hpr.abdm"),
        ("verifier", "verifier@hpr.abdm"),
    ] {
        let (s, view) = call(
            &app,
            &csrf,
            (Method::POST, "/api/abdm/hfr/hpr-session"),
            json!({ "role": role, "hpr_id": id, "password": "secret-pass" }),
        )
        .await;
        assert_eq!(s, StatusCode::OK, "{view}");
        assert!(
            view.get("token").is_none() && !view.to_string().contains("secret-pass"),
            "{view}"
        );
    }

    // The workbook's refusals happen before HFR is called.
    let (s, body) = call(
        &app,
        &csrf,
        (Method::POST, &path("basic")),
        basic_form("Clin"),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    assert!(body.to_string().contains("HFR-010"), "{body}");
    let (s, _) = call(&app, &csrf, (Method::POST, &path("additional")), json!({})).await;
    assert_eq!(
        s,
        StatusCode::BAD_REQUEST,
        "no trackingId before basic is saved"
    );

    let (s, saved) = call(
        &app,
        &csrf,
        (Method::POST, &path("basic")),
        basic_form("Sahyadri Hospital"),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{saved}");
    assert_eq!(saved["tracking_id"], TRACKING);
    let (s, body) = call(
        &app,
        &csrf,
        (Method::POST, &path("additional")),
        json!({ "nin": "1234" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{body}");
    let detailed = json!({ "specialities": [{ "systemOfMedicineCode": "M", "isSpecializationAvalaible": "Y",
        "specialities": ["S29"] }], "medicalInfrastructure": { "countIPDBedsWithOxygen": 12, "totalNumberOfBeds": 900 } });
    let (s, body) = call(&app, &csrf, (Method::POST, &path("detailed")), detailed).await;
    assert_eq!(s, StatusCode::OK, "{body}");
    let (s, body) = call(&app, &csrf, (Method::POST, &path("submit")), Value::Null).await;
    assert_eq!(s, StatusCode::OK, "{body}");
    let issued = body["facility_id"]
        .as_str()
        .expect("facility id")
        .to_owned();

    let (s, draft) = call(&app, &csrf, (Method::GET, &base), Value::Null).await;
    assert_eq!(s, StatusCode::OK, "{draft}");
    assert_eq!(draft["tracking_id"], TRACKING);
    assert_eq!(draft["hfr_status"], "submitted");
    assert_eq!(draft["hfr_facility_id"], issued);
    assert_eq!(
        draft["basic"]["facilityAddressDetails"]["country"], "India",
        "HFR-013"
    );
    assert_eq!(draft["additional"]["linkedProgramIds"]["nin"], "1234");
    assert_eq!(
        draft["detailed"]["medicalInfrastructure"]["totalNumberOfBeds"], 12,
        "HFR-060 computed"
    );
    assert!(draft["submitted_at"].is_string());
    assert_eq!(draft["hpr_sessions"].as_array().map(Vec::len), Some(2));

    // HFR-064: an update re-sends basic information with the kept trackingId.
    let (s, body) = call(
        &app,
        &csrf,
        (Method::POST, &path("basic")),
        basic_form("Sahyadri Hospital East"),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{body}");
    let (s, draft) = call(&app, &csrf, (Method::GET, &base), Value::Null).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(draft["basic"]["facilityName"], "Sahyadri Hospital East");
}

/// A nurse holds no facility-registry permission, so every onboarding
/// endpoint — the HPR sign-in included — answers 403 before HFR is called.
#[tokio::test]
async fn onboarding_refuses_callers_without_the_register_permission() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let base = format!("/api/abdm/hfr/facilities/{}/onboarding", Uuid::nil());
    let steps = ["basic", "additional", "detailed", "submit"].map(|s| format!("{base}/{s}"));
    // Valid for every endpoint, so each refusal is the permission's.
    let body = json!({ "role": "manager", "hpr_id": "manager@hpr.abdm", "password": "x" });
    let mut routes = vec![
        (Method::GET, base.clone()),
        (Method::POST, "/api/abdm/hfr/search".to_owned()),
        (Method::GET, "/api/abdm/hfr/masters/states".to_owned()),
        (Method::POST, "/api/abdm/hfr/hpr-session".to_owned()),
    ];
    routes.extend(steps.into_iter().map(|p| (Method::POST, p)));
    for (method, path) in routes {
        let resp = nurse
            .client
            .request(method.clone(), app.url(&path))
            .header("x-csrf-token", &nurse.csrf)
            .json(&body)
            .send()
            .await
            .expect("request");
        assert_eq!(
            resp.status(),
            StatusCode::FORBIDDEN,
            "nurse {method} {path}"
        );
    }
}
