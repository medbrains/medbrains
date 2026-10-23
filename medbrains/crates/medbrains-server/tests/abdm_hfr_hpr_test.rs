//! ABDM Milestone 4 — the provider registries. Each campus carries its own
//! HFR facility ID, confirmed against HFR search when keys exist; each doctor
//! carries an HPR ID, recorded unverified and confirmed against HPR; the
//! coverage report counts active doctors with and without one; and every one
//! of these screens answers 403 to a caller without its permission.
//!
//! HFR and HPR are an axum mock on 127.0.0.1:0, reached through
//! `ABDM_*_BASE_URL_OVERRIDE` and a ready `ABDM_GATEWAY_TOKEN_OVERRIDE`, so
//! no ABDM sandbox or credentials are involved.

use crate::common;

use axum::{Json, Router, http::StatusCode as MockStatus, routing::post};
use medbrains_abdm::registry::{HFR_SEARCH_PATH, HPR_SEARCH_PATH};
use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// Known to the mock HFR: IDs starting `IN04`. Known to the mock HPR: `21…`.
async fn spawn_registry_mock() -> String {
    async fn hfr(Json(body): Json<Value>) -> Json<Value> {
        let id = body["facilityId"].as_str().unwrap_or_default().to_owned();
        let facilities: Vec<Value> = if id.starts_with("IN04") {
            vec![
                json!({ "facilityId": id, "facilityName": "Mock campus", "facilityStatus": "Approved" }),
            ]
        } else {
            Vec::new()
        };
        Json(json!({ "totalFacilities": facilities.len(), "facilities": facilities }))
    }
    async fn hpr(Json(body): Json<Value>) -> (MockStatus, Json<Value>) {
        let id = body["hprId"].as_str().unwrap_or_default().to_owned();
        if id.starts_with("21") {
            (
                MockStatus::OK,
                Json(json!({ "hprIdNumber": id, "name": "Dr Mock" })),
            )
        } else if id.starts_with("40") {
            // A registry that answers 404 is a fault, never "not registered".
            (
                MockStatus::NOT_FOUND,
                Json(json!({ "message": "no such path" })),
            )
        } else {
            (MockStatus::OK, Json(json!({ "results": [] })))
        }
    }
    let app = Router::new()
        .route(HFR_SEARCH_PATH, post(hfr))
        .route(HPR_SEARCH_PATH, post(hpr));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("mock addr");
    tokio::spawn(async move { axum::serve(listener, app).await.expect("mock crashed") });
    format!("http://{addr}")
}

async fn spawn_with_registry() -> common::TestApp {
    let mock = spawn_registry_mock().await;
    common::spawn_app_with_secrets(
        common::TestSecrets::default()
            .with("ABDM_GATEWAY_TOKEN_OVERRIDE", "test-session-token")
            .with("ABDM_HFR_BASE_URL_OVERRIDE", mock.clone())
            .with("ABDM_HPR_BASE_URL_OVERRIDE", mock),
    )
    .await
}

async fn call(
    client: &Client,
    app: &common::TestApp,
    csrf: &str,
    (method, path): (Method, &str),
    body: Value,
) -> (StatusCode, Value) {
    let resp = client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Digits unique to this run, so the per-tenant unique indexes never collide
/// with a row an earlier run left behind.
fn run_digits(n: usize) -> String {
    let digits: String = Uuid::new_v4()
        .as_u128()
        .to_string()
        .chars()
        .rev()
        .take(n)
        .collect();
    format!("{digits:0>n$}")
}

async fn create_campus(app: &common::TestApp, csrf: &str) -> String {
    let code = format!("HFR-{}", &run_digits(6));
    let (s, body) = call(
        &app.client,
        app,
        csrf,
        (Method::POST, "/api/setup/facilities"),
        json!({ "code": code, "name": format!("Campus {code}"), "facility_type": "main_hospital",
                "bed_count": 40 }),
    )
    .await;
    assert!(s.is_success(), "{body}");
    body["id"].as_str().expect("facility id").to_owned()
}

/// Given ABDM keys and two campuses, When one is linked to an ID HFR knows,
/// Then it is verified with its own ID, bed count and DHIS eligibility, and
/// the other campus stays unregistered; an ID HFR does not list is refused,
/// one campus's ID cannot be claimed by another, and a malformed ID is 400.
#[tokio::test]
async fn each_campus_carries_its_own_hfr_id_verified_against_hfr() {
    let app = spawn_with_registry().await;
    let csrf = app.login_admin().await;
    let (a, b) = (
        create_campus(&app, &csrf).await,
        create_campus(&app, &csrf).await,
    );
    let known = format!("in04{}", run_digits(8));

    let link = |id: &str| (Method::PUT, format!("/api/abdm/hfr/facilities/{id}"));
    let (m, p) = link(&a);
    let (s, row) = call(
        &app.client,
        &app,
        &csrf,
        (m, &p),
        json!({ "hfr_facility_id": known, "hfr_bed_count": 30, "hfr_ipd": true }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{row}");
    assert_eq!(
        row["hfr_facility_id"],
        known.to_uppercase(),
        "stored uppercase"
    );
    assert_eq!(row["hfr_status"], "verified");
    assert!(
        row["hfr_checked_at"].is_string(),
        "verification time recorded"
    );
    assert_eq!(row["dhis_eligible"], true, "30 beds with IPD");

    let (m, p) = link(&b);
    let (s, body) = call(
        &app.client,
        &app,
        &csrf,
        (m, &p),
        json!({ "hfr_facility_id": format!("IN99{}", run_digits(8)), "hfr_ipd": false }),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT, "HFR does not list it: {body}");
    let (m, p) = link(&b);
    let (s, _) = call(
        &app.client,
        &app,
        &csrf,
        (m, &p),
        json!({ "hfr_facility_id": known, "hfr_ipd": true }),
    )
    .await;
    assert_eq!(
        s,
        StatusCode::CONFLICT,
        "another campus already holds this ID"
    );
    let (m, p) = link(&b);
    let (s, _) = call(
        &app.client,
        &app,
        &csrf,
        (m, &p),
        json!({ "hfr_facility_id": "IN-NOT-AN-ID", "hfr_ipd": false }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let (s, list) = call(
        &app.client,
        &app,
        &csrf,
        (Method::GET, "/api/abdm/hfr/facilities"),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{list}");
    assert_eq!(list["registry_configured"], true);
    let find = |id: &str| {
        list["facilities"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|f| f["id"] == id)
            .cloned()
            .unwrap_or(Value::Null)
    };
    assert_eq!(find(&a)["hfr_status"], "verified");
    assert_eq!(find(&a)["hfr_bed_count"], 30);
    assert_eq!(
        find(&b)["hfr_status"],
        "not_registered",
        "the refused links changed nothing"
    );
    assert!(find(&b)["hfr_facility_id"].is_null());
}

async fn coverage(app: &common::TestApp, csrf: &str) -> Value {
    let (s, body) = call(
        &app.client,
        app,
        csrf,
        (Method::GET, "/api/abdm/hpr/coverage"),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{body}");
    body
}

fn count(v: &Value, key: &str) -> i64 {
    v[key].as_i64().unwrap_or(-1)
}

/// Given two new active doctors with no HPR ID, Then coverage counts both as
/// missing; When one is given an HPR ID it leaves the missing list unverified,
/// Then "Verify with HPR" confirms it; changing the ID clears the
/// verification, an ID HPR does not list is refused, a malformed one is 400.
#[tokio::test]
async fn hpr_ids_are_recorded_verified_and_counted() {
    let app = spawn_with_registry().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let before = coverage(&app, &csrf).await;

    let mut doctors = Vec::new();
    for _ in 0..2 {
        let user = common::provision_staff(&app, &csrf, "nurse", &[]).await;
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO doctor_profiles (tenant_id, user_id, display_name) \
             VALUES ($1, $2, 'Dr HPR Test') RETURNING id",
        )
        .bind(tenant)
        .bind(user.user_id)
        .fetch_one(&app.db)
        .await
        .expect("doctor");
        doctors.push(id);
    }
    let after = coverage(&app, &csrf).await;
    assert_eq!(
        count(&after, "active_doctors"),
        count(&before, "active_doctors") + 2
    );
    assert_eq!(count(&after, "with_hpr_id"), count(&before, "with_hpr_id"));
    let missing = |v: &Value, id: Uuid| {
        v["missing"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|d| d["id"] == id.to_string())
    };
    assert!(missing(&after, doctors[0]) && missing(&after, doctors[1]));

    let hpr = format!("21{}", run_digits(12));
    let set = format!("/api/abdm/hpr/doctors/{}", doctors[0]);
    let (s, row) = call(
        &app.client,
        &app,
        &csrf,
        (Method::PUT, &set),
        json!({ "hpr_id": hpr }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{row}");
    let hyphenated = format!(
        "{}-{}-{}-{}",
        &hpr[..2],
        &hpr[2..6],
        &hpr[6..10],
        &hpr[10..]
    );
    assert_eq!(row["hpr_id"], hyphenated, "stored hyphenated");
    assert!(row["hpr_verified_at"].is_null(), "saving is not verifying");

    let with_one = coverage(&app, &csrf).await;
    assert_eq!(
        count(&with_one, "with_hpr_id"),
        count(&before, "with_hpr_id") + 1
    );
    assert!(!missing(&with_one, doctors[0]) && missing(&with_one, doctors[1]));

    let verify = format!("{set}/verify");
    let (s, row) = call(
        &app.client,
        &app,
        &csrf,
        (Method::POST, &verify),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{row}");
    assert!(row["hpr_verified_at"].is_string());
    assert_eq!(
        count(&coverage(&app, &csrf).await, "verified"),
        count(&before, "verified") + 1
    );

    let other = format!("21{}", run_digits(12));
    let (_, row) = call(
        &app.client,
        &app,
        &csrf,
        (Method::PUT, &set),
        json!({ "hpr_id": other }),
    )
    .await;
    assert!(
        row["hpr_verified_at"].is_null(),
        "a changed ID is no longer verified"
    );

    let (_, _) = call(
        &app.client,
        &app,
        &csrf,
        (Method::PUT, &set),
        json!({ "hpr_id": format!("99{}", run_digits(12)) }),
    )
    .await;
    let (s, _) = call(
        &app.client,
        &app,
        &csrf,
        (Method::POST, &verify),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT, "HPR does not list it");
    let (_, _) = call(
        &app.client,
        &app,
        &csrf,
        (Method::PUT, &set),
        json!({ "hpr_id": format!("40{}", run_digits(12)) }),
    )
    .await;
    let (s, _) = call(
        &app.client,
        &app,
        &csrf,
        (Method::POST, &verify),
        Value::Null,
    )
    .await;
    assert_eq!(
        s,
        StatusCode::SERVICE_UNAVAILABLE,
        "a registry 404 is a fault, not \"not registered\""
    );
    let (s, _) = call(
        &app.client,
        &app,
        &csrf,
        (Method::PUT, &set),
        json!({ "hpr_id": "12345" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    sqlx::query("UPDATE doctor_profiles SET is_active = false WHERE id = ANY($1)")
        .bind(&doctors)
        .execute(&app.db)
        .await
        .expect("retire test doctors");
}

/// A nurse holds no ABDM registry permission; the HR officer holds
/// `abdm.hpr.manage` but not the facility registry.
#[tokio::test]
async fn registry_screens_refuse_callers_without_the_permission() {
    let app = spawn_with_registry().await;
    let csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let hr = common::provision_staff(&app, &csrf, "hr_officer", &[]).await;
    let nil = Uuid::nil();
    let hfr_link = format!("/api/abdm/hfr/facilities/{nil}");
    let hfr_register = format!("{hfr_link}/register");
    let hpr_set = format!("/api/abdm/hpr/doctors/{nil}");
    let hpr_verify = format!("{hpr_set}/verify");
    // Valid for every endpoint below, so each refusal is the permission's,
    // not a body the extractor rejected first.
    let body = json!({ "hpr_id": null, "hfr_facility_id": null, "ownership": "private",
        "state_lgd_code": "33", "district_lgd_code": "571", "pincode": "600001" });

    for (method, path) in [
        (Method::GET, "/api/abdm/hfr/facilities"),
        (Method::PUT, hfr_link.as_str()),
        (Method::POST, hfr_register.as_str()),
        (Method::GET, "/api/abdm/hpr/coverage"),
        (Method::PUT, hpr_set.as_str()),
        (Method::POST, hpr_verify.as_str()),
    ] {
        let (s, _) = call(
            &nurse.client,
            &app,
            &nurse.csrf,
            (method.clone(), path),
            body.clone(),
        )
        .await;
        assert_eq!(s, StatusCode::FORBIDDEN, "nurse {method} {path}");
    }

    let (s, _) = call(
        &hr.client,
        &app,
        &hr.csrf,
        (Method::GET, "/api/abdm/hpr/coverage"),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK, "HR keeps professional credentials");
    let (s, _) = call(
        &hr.client,
        &app,
        &hr.csrf,
        (Method::GET, "/api/abdm/hfr/facilities"),
        Value::Null,
    )
    .await;
    assert_eq!(
        s,
        StatusCode::FORBIDDEN,
        "the facility registry is not HR's"
    );
}
