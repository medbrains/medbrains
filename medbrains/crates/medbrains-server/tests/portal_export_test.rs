//! A patient downloads their own record from the portal as a FHIR R4 bundle:
//! who they are, their visits, and their released results — verified ones
//! only, and none still carrying an unacknowledged critical value, exactly
//! what their Results screen shows. Another patient's token gets their own
//! record, never this one.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

async fn patient(app: &common::TestApp, tenant: Uuid) -> (Uuid, String) {
    let phone = format!("6{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let id = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Export', 'Patient', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-EX-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    (id, phone)
}

async fn token(app: &common::TestApp, tenant: Uuid, code_of_tenant: &str, phone: &str) -> String {
    let code = "424242";
    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + interval '5 minutes')",
    )
    .bind(tenant)
    .bind(phone)
    .bind(format!("{:x}", Sha256::digest(code.as_bytes())))
    .execute(&app.db)
    .await
    .expect("otp");
    let resp: Value = reqwest::Client::new()
        .post(app.url("/api/portal/auth/verify"))
        .json(&json!({ "tenant_code": code_of_tenant, "phone": phone, "code": code }))
        .send()
        .await
        .expect("verify")
        .json()
        .await
        .expect("verify json");
    resp["token"].as_str().unwrap_or_default().to_owned()
}

/// One lab result on a new order; `verified` releases it, `critical` holds it
/// back behind an unacknowledged alert.
async fn result(
    app: &common::TestApp,
    (tenant, patient, encounter, test, admin): (Uuid, Uuid, Uuid, Uuid, Uuid),
    (value, flag): (&str, &str),
    (verified, critical): (bool, bool),
) {
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, verified_at) \
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() END) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(test)
    .bind(admin)
    .bind(verified)
    .fetch_one(&app.db)
    .await
    .expect("order");
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, flag) \
         VALUES ($1, $2, 'Haemoglobin', $3, 'g/dL', $4::lab_result_flag) RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .bind(value)
    .bind(flag)
    .fetch_one(&app.db)
    .await
    .expect("result");
    if critical {
        sqlx::query(
            "INSERT INTO lab_critical_alerts (tenant_id, order_id, result_id, patient_id, parameter_name, value, flag) \
             VALUES ($1, $2, $3, $4, 'Haemoglobin', $5, 'critical_low')",
        )
        .bind(tenant)
        .bind(order)
        .bind(id)
        .bind(patient)
        .bind(value)
        .execute(&app.db)
        .await
        .expect("alert");
    }
}

#[tokio::test]
async fn a_patient_downloads_their_released_record_as_fhir() {
    let app = common::spawn_app().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let tenant_code: String = sqlx::query_scalar("SELECT code FROM tenants WHERE id = $1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("code");
    let test: Uuid = sqlx::query_scalar(
        "SELECT id FROM lab_test_catalog WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("a catalogue test");
    let (me, phone) = patient(&app, tenant).await;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(me)
    .fetch_one(&app.db)
    .await
    .expect("visit");
    let ids = (tenant, me, encounter, test, admin);
    result(&app, ids, ("15.9", "high"), (true, false)).await;
    result(&app, ids, ("7.1", "low"), (false, false)).await;
    result(&app, ids, ("5.2", "critical_low"), (true, true)).await;

    let tok = token(&app, tenant, &tenant_code, &phone).await;
    let resp = reqwest::Client::new()
        .get(app.url("/api/portal/privacy/export"))
        .bearer_auth(&tok)
        .send()
        .await
        .expect("export");
    assert_eq!(resp.status(), StatusCode::OK);
    let ctype = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    assert!(ctype.starts_with("application/fhir+json"), "{ctype}");
    let bundle: Value = resp.json().await.unwrap_or(Value::Null);
    assert_eq!(bundle["resourceType"], "Bundle");
    assert_eq!(bundle["type"], "collection");
    let entries = bundle["entry"].as_array().cloned().unwrap_or_default();
    let of = |kind: &str| {
        entries
            .iter()
            .filter(|e| e["resource"]["resourceType"] == kind)
            .count()
    };
    assert_eq!(of("Patient"), 1);
    assert_eq!(of("Encounter"), 1);
    assert_eq!(
        of("Observation"),
        1,
        "only the verified result without a pending critical alert"
    );
    let obs = entries
        .iter()
        .find(|e| e["resource"]["resourceType"] == "Observation")
        .map(|e| &e["resource"]);
    assert!(
        obs.is_some_and(|o| o.to_string().contains("15.9") && o.to_string().contains("\"H\"")),
        "{obs:?}"
    );

    // Another patient's token exports their own record, not this one.
    let (_, other_phone) = patient(&app, tenant).await;
    let other = token(&app, tenant, &tenant_code, &other_phone).await;
    let theirs: Value = reqwest::Client::new()
        .get(app.url("/api/portal/privacy/export"))
        .bearer_auth(&other)
        .send()
        .await
        .expect("export")
        .json()
        .await
        .unwrap_or(Value::Null);
    assert!(
        !theirs.to_string().contains(&me.to_string()),
        "no trace of the first patient"
    );
}
