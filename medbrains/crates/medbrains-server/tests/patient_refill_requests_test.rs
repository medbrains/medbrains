//! A patient asks for refills from the portal. A due refill of a drug the
//! pharmacy may refill goes straight into its queue; one needing the doctor
//! waits in the prescriber's sign-offs, and their approval issues it. Nobody
//! asks for a refill of another patient's prescription.

use crate::common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

struct Setup {
    tenant: Uuid,
    tenant_code: String,
    csrf: String,
}

async fn staff(
    app: &common::TestApp,
    setup: &Setup,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let req = match method {
        "GET" => app.client.get(app.url(path)),
        _ => app.client.post(app.url(path)).json(&body),
    };
    let resp = req
        .header("x-csrf-token", &setup.csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A patient signed in to the portal the way a patient does: a one-time code
/// to their phone (planted here, since no SMS leaves a test).
async fn patient_token(app: &common::TestApp, setup: &Setup, phone: &str) -> String {
    let code = "424242";
    sqlx::query(
        "INSERT INTO patient_portal_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + interval '5 minutes')",
    )
    .bind(setup.tenant)
    .bind(phone)
    .bind(format!("{:x}", Sha256::digest(code.as_bytes())))
    .execute(&app.db)
    .await
    .expect("otp");
    let resp: Value = reqwest::Client::new()
        .post(app.url("/api/portal/auth/verify"))
        .json(&json!({ "tenant_code": setup.tenant_code, "phone": phone, "code": code }))
        .send()
        .await
        .expect("verify")
        .json()
        .await
        .expect("verify json");
    resp["token"].as_str().expect("a portal token").to_owned()
}

async fn portal(
    app: &common::TestApp,
    token: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let client = reqwest::Client::new();
    let req = match body {
        Some(b) => client.post(app.url(path)).json(&b),
        None => client.get(app.url(path)),
    };
    let resp = req.bearer_auth(token).send().await.expect("portal request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn new_patient(app: &common::TestApp, setup: &Setup) -> (Uuid, String) {
    let phone = format!("6{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let id = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Portal', 'Refill', 'female', $3) RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!(
        "UH-PR-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    (id, phone)
}

async fn drug(app: &common::TestApp, setup: &Setup, name: &str, policy: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, refill_policy) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(setup.tenant)
    .bind(format!("RF-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(name)
    .bind(policy)
    .fetch_one(&app.db)
    .await
    .expect("drug")
}

fn line(id: Uuid, name: &str) -> Value {
    json!({ "drug_name": name, "catalog_item_id": id, "dosage": "1 tab",
            "frequency": "OD", "duration": "30 days", "route": "oral" })
}

fn of<'a>(list: &'a Value, rx: &str) -> &'a Value {
    list.as_array()
        .and_then(|rows| rows.iter().find(|r| r["prescription_id"] == rx))
        .unwrap_or(&Value::Null)
}

#[tokio::test]
async fn patients_ask_and_the_right_person_lets_it_through() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, tenant_code): (Uuid, String) = sqlx::query_as(
        "SELECT t.id, t.code FROM tenants t JOIN users u ON u.tenant_id = t.id \
          WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let setup = Setup {
        tenant,
        tenant_code,
        csrf,
    };
    let stepped = app
        .client
        .post(app.url("/api/auth/step-up"))
        .header("x-csrf-token", &setup.csrf)
        .json(&json!({ "password": "admin123" }))
        .send()
        .await
        .expect("step-up");
    assert!(stepped.status().is_success());

    let (patient, phone) = new_patient(&app, &setup).await;
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (_, visit) = staff(
        &app,
        &setup,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": patient, "department_id": department }),
    )
    .await;
    let rx_path = format!(
        "/api/opd/encounters/{}/prescriptions",
        visit["encounter"]["id"].as_str().unwrap_or_default()
    );
    let pharmacy_drug = drug(&app, &setup, "Refillol 10 mg", "pharmacy").await;
    let doctor_drug = drug(&app, &setup, "Reviewdipine 5 mg", "doctor_approval").await;

    // A month-old prescription with refills, of a drug the pharmacy may refill.
    let (status, routine) = staff(
        &app,
        &setup,
        "POST",
        &rx_path,
        json!({
        "items": [line(pharmacy_drug, "Refillol 10 mg")],
        "repeats_allowed": 2, "repeat_interval_days": 30,
        "valid_until": Utc::now().date_naive() + Duration::days(90) }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{routine}");
    let routine = routine["prescription"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    sqlx::query(
        "UPDATE prescriptions SET created_at = now() - interval '31 days' WHERE id = $1::uuid",
    )
    .bind(&routine)
    .execute(&app.db)
    .await
    .expect("age");
    // And one with a drug the doctor reviews, no refills written.
    let (_, reviewed) = staff(
        &app,
        &setup,
        "POST",
        &rx_path,
        json!({
        "items": [line(doctor_drug, "Reviewdipine 5 mg")] }),
    )
    .await;
    let reviewed = reviewed["prescription"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let token = patient_token(&app, &setup, &phone).await;
    // Nothing is refilled while the first supply still waits at the pharmacy.
    let (_, list) = portal(&app, &token, "/api/portal/refills", None).await;
    assert_eq!(of(&list, &routine)["goes_to"], Value::Null, "{list}");
    let (status, _) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{routine}/refill-request"),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    sqlx::query(
        "UPDATE pharmacy_prescriptions SET status = 'dispensed' \
          WHERE prescription_id IN ($1::uuid, $2::uuid)",
    )
    .bind(&routine)
    .bind(&reviewed)
    .execute(&app.db)
    .await
    .expect("dispense the originals");

    let (status, list) = portal(&app, &token, "/api/portal/refills", None).await;
    assert_eq!(status, StatusCode::OK, "{list}");
    assert_eq!(of(&list, &routine)["goes_to"], json!("pharmacy"), "{list}");
    assert_eq!(of(&list, &reviewed)["goes_to"], json!("doctor"), "{list}");

    // The routine refill goes straight to the pharmacy's queue...
    let (status, sent) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{routine}/refill-request"),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{sent}");
    assert_eq!(sent["status"], json!("sent_to_pharmacy"));
    let queued: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_prescriptions WHERE prescription_id = $1::uuid AND repeat_index = 1",
    )
    .bind(&routine)
    .fetch_one(&app.db)
    .await
    .expect("queue");
    assert_eq!(queued, 1);
    // ...and the next one waits its month.
    let (status, _) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{routine}/refill-request"),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // The reviewed drug waits for the prescriber, once.
    let (status, waiting) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{reviewed}/refill-request"),
        Some(json!({ "note": "Running out on Friday" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{waiting}");
    assert_eq!(waiting["status"], json!("with_doctor"));
    let (status, _) = portal(
        &app,
        &token,
        &format!("/api/portal/prescriptions/{reviewed}/refill-request"),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Another patient can't ask on this one's prescription.
    let (_, other_phone) = new_patient(&app, &setup).await;
    let other = patient_token(&app, &setup, &other_phone).await;
    let (status, _) = portal(
        &app,
        &other,
        &format!("/api/portal/prescriptions/{routine}/refill-request"),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // It's in the prescriber's sign-offs; a decline needs a reason; approval issues it.
    let (_, inbox) = staff(
        &app,
        &setup,
        "GET",
        "/api/doctors/me/pending-signoffs",
        Value::Null,
    )
    .await;
    let request_id = waiting["id"].as_str().unwrap_or_default();
    let listed = inbox
        .as_array()
        .into_iter()
        .flatten()
        .find(|e| e["record_id"] == request_id);
    assert!(
        listed.is_some_and(
            |e| e["record_type"] == "refill_request" && e["context"] == "Running out on Friday"
        ),
        "{inbox}"
    );
    let decide = format!("/api/doctors/me/refill-requests/{request_id}/decide");
    let (status, _) = staff(&app, &setup, "POST", &decide, json!({ "approve": false })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, decided) = staff(&app, &setup, "POST", &decide, json!({ "approve": true })).await;
    assert_eq!(status, StatusCode::OK, "{decided}");
    assert_eq!(decided["status"], json!("sent_to_pharmacy"));
    let (allowed, used): (i32, i32) = sqlx::query_as(
        "SELECT repeats_allowed, repeats_used FROM prescriptions WHERE id = $1::uuid",
    )
    .bind(&reviewed)
    .fetch_one(&app.db)
    .await
    .expect("terms");
    assert_eq!(
        (allowed, used),
        (1, 1),
        "approval granted and issued one refill"
    );
}
