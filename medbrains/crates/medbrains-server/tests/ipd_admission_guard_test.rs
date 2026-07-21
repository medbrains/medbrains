mod common;

use reqwest::StatusCode;

/// The IPD double-admission guard (#4462): a patient can physically occupy only
/// one bed, so a patient with an active admission must not be admitted again —
/// otherwise bed census, billing, and order routing fork across duplicate
/// records. The first admission must succeed; the second must be refused 409.
#[tokio::test]
async fn double_admission_is_rejected() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    // A department to admit into (any active one).
    let depts: serde_json::Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("departments json");
    let department_id = depts
        .as_array()
        .and_then(|a| a.first())
        .and_then(|d| d.get("id"))
        .and_then(serde_json::Value::as_str)
        .expect("at least one department seeded")
        .to_owned();

    // A fresh patient — guaranteed to have no prior admission.
    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Guard",
            "last_name": "DoubleAdmit",
            "gender": "male",
            "phone": "9990000042",
        }))
        .send()
        .await
        .expect("create patient")
        .json()
        .await
        .expect("patient json");
    let patient_id = patient
        .get("id")
        .and_then(serde_json::Value::as_str)
        .expect("patient id")
        .to_owned();

    let admit_body = serde_json::json!({
        "patient_id": patient_id,
        "department_id": department_id,
    });

    // First admission: the happy path succeeds.
    let first = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(&admit_body)
        .send()
        .await
        .expect("first admit request");
    assert!(
        first.status().is_success(),
        "first admission should succeed, got {}",
        first.status()
    );

    // Second admission of the same patient: the guard refuses it with 409.
    let second = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(&admit_body)
        .send()
        .await
        .expect("second admit request");
    assert_eq!(
        second.status(),
        StatusCode::CONFLICT,
        "a second active admission for the same patient must be rejected"
    );

    let body: serde_json::Value = second.json().await.expect("conflict json");
    let msg = serde_json::to_string(&body).unwrap_or_default().to_lowercase();
    assert!(
        msg.contains("active admission") || msg.contains("already"),
        "the 409 body should explain the existing active admission: {body}"
    );
}
