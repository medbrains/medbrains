//! A patient shares readings from Apple Health / Health Connect: only the
//! kinds they said yes to, read by the care team as patient-reported, never
//! scored, and stored once however often the phone shares.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use crate::common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// A fresh patient signed in to the portal with a planted one-time code.
async fn patient(app: &common::TestApp) -> (Uuid, String) {
    let (tenant, code_t): (Uuid, String) = sqlx::query_as(
        "SELECT t.id, t.code FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let phone = format!("6{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Health', 'Share', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-HS-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + interval '5 minutes')",
    )
    .bind(tenant)
    .bind(&phone)
    .bind(hex::encode(Sha256::digest(b"424242")))
    .execute(&app.db)
    .await
    .expect("otp");
    let resp: Value = reqwest::Client::new()
        .post(app.url("/api/portal/auth/verify"))
        .json(&json!({ "tenant_code": code_t, "phone": phone, "code": "424242" }))
        .send()
        .await
        .expect("verify")
        .json()
        .await
        .expect("verify json");
    (id, resp["token"].as_str().expect("token").to_owned())
}

async fn call(
    app: &common::TestApp,
    token: &str,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let c = reqwest::Client::new();
    let req = match method {
        "PUT" => c.put(app.url(path)),
        "POST" => c.post(app.url(path)),
        _ => c.get(app.url(path)),
    };
    let req = match body {
        Some(b) => req.json(&b),
        None => req,
    };
    let r = req.bearer_auth(token).send().await.expect("request");
    let s = r.status();
    (s, r.json().await.unwrap_or(Value::Null))
}

fn at(hours_ago: i64) -> String {
    (Utc::now() - Duration::hours(hours_ago)).to_rfc3339()
}

#[tokio::test]
async fn only_agreed_kinds_are_shared_once_as_patient_reported() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (patient_id, token) = patient(&app).await;

    // Nothing is shared until the patient says so.
    let (s, sharing) = call(&app, &token, "GET", "/api/portal/health-data", None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(sharing["consents"].as_array().map(Vec::len), Some(0));
    let readings = json!({ "source": "healthkit", "readings": [
        { "data_type": "blood_pressure", "external_id": "HK-BP-1", "measured_at": at(2), "systolic": 142, "diastolic": 91 },
        { "data_type": "glucose", "external_id": "HK-G-1", "measured_at": at(3), "value": 182 },
        { "data_type": "spo2", "external_id": "HK-O-1", "measured_at": at(1), "value": 88 },
    ]});
    let (_, refused) = call(
        &app,
        &token,
        "POST",
        "/api/portal/health-data/readings",
        Some(readings.clone()),
    )
    .await;
    assert_eq!(
        (
            refused["accepted"].as_i64(),
            refused["refused"].as_array().map(Vec::len)
        ),
        (Some(0), Some(3)),
        "{refused}"
    );

    // Yes to blood pressure and SpO2 from Apple Health; glucose stays off.
    for kind in ["blood_pressure", "spo2"] {
        let (s, _) = call(
            &app,
            &token,
            "PUT",
            "/api/portal/health-data/consent",
            Some(json!({ "source": "healthkit", "data_type": kind, "granted": true })),
        )
        .await;
        assert_eq!(s, StatusCode::OK);
    }
    let (_, first) = call(
        &app,
        &token,
        "POST",
        "/api/portal/health-data/readings",
        Some(readings.clone()),
    )
    .await;
    assert_eq!(first["accepted"], 2, "{first}");
    assert_eq!(first["refused"][0]["external_id"], "HK-G-1");
    // The phone shares again: stored once.
    let (_, again) = call(
        &app,
        &token,
        "POST",
        "/api/portal/health-data/readings",
        Some(readings.clone()),
    )
    .await;
    assert_eq!(
        (again["accepted"].as_i64(), again["duplicates"].as_i64()),
        (Some(0), Some(2))
    );

    // The care team reads them as patient-reported, unflagged and unscored.
    let list: Value = app
        .get(
            &app.client,
            &format!("/api/home-health/remote-vitals?patient_id={patient_id}"),
        )
        .await
        .json()
        .await
        .expect("list");
    let rows = list.as_array().expect("rows");
    assert_eq!(rows.len(), 2);
    assert!(
        rows.iter()
            .all(|r| r["source"] == "healthkit" && r["is_flagged"] == false),
        "{list}"
    );
    let charted: i64 = sqlx::query_scalar("SELECT count(*) FROM vitals WHERE patient_id = $1")
        .bind(patient_id)
        .fetch_one(&app.db)
        .await
        .expect("n");
    assert_eq!(charted, 0, "never charted as the ward's own vitals");

    // Withdrawing stops new readings; what was shared stays.
    call(
        &app,
        &token,
        "PUT",
        "/api/portal/health-data/consent",
        Some(json!({ "source": "healthkit", "data_type": "spo2", "granted": false })),
    )
    .await;
    let later = json!({ "source": "healthkit", "readings": [{ "data_type": "spo2", "external_id": "HK-O-2", "measured_at": at(0), "value": 97 }]});
    let (_, after) = call(
        &app,
        &token,
        "POST",
        "/api/portal/health-data/readings",
        Some(later),
    )
    .await;
    assert_eq!(after["accepted"], 0);
    // Consent is per source: Health Connect has none.
    let hc = json!({ "source": "health_connect", "readings": [{ "data_type": "blood_pressure", "external_id": "HC-1", "measured_at": at(1), "systolic": 120, "diastolic": 80 }]});
    assert_eq!(
        call(
            &app,
            &token,
            "POST",
            "/api/portal/health-data/readings",
            Some(hc)
        )
        .await
        .1["accepted"],
        0
    );
    drop(csrf);
}

#[tokio::test]
async fn bad_input_and_staff_tokens_are_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, token) = patient(&app).await;
    let (s, _) = call(
        &app,
        &token,
        "PUT",
        "/api/portal/health-data/consent",
        Some(json!({ "source": "fitbit", "data_type": "spo2", "granted": true })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let many: Vec<Value> = (0..501).map(|i| json!({ "data_type": "heart_rate", "external_id": format!("x{i}"), "measured_at": at(1), "value": 70 })).collect();
    let (s, _) = call(
        &app,
        &token,
        "POST",
        "/api/portal/health-data/readings",
        Some(json!({ "source": "healthkit", "readings": many })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    // A staff session is not a patient token.
    let r = app
        .client
        .get(app.url("/api/portal/health-data"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("staff");
    assert_eq!(r.status(), StatusCode::UNAUTHORIZED);
}
