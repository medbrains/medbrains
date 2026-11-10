use crate::common;

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
            "date_of_birth": "1985-06-15",
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

    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let admit_body = serde_json::json!({
        "patient_id": patient_id,
        "department_id": department_id,
        "doctor_id": doctor.user_id,
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

/// Given an admin keying an admission, When no admitting doctor is named,
/// Then it is refused rather than recorded under the admin; And a nurse is not
/// accepted as the doctor; And `admitting_doctor_id` names the doctor too.
#[tokio::test]
async fn an_admission_records_a_real_admitting_doctor() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let depts: serde_json::Value =
        app.get(&app.client, "/api/setup/departments").await.json().await.expect("departments");
    let department_id = depts[0]["id"].clone();
    let patient: serde_json::Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "first_name": "Guard", "last_name": "Doctor", "gender": "female", "date_of_birth": "1979-02-02", "phone": "9990000043" }))
        .send()
        .await
        .expect("patient")
        .json()
        .await
        .expect("patient json");
    let admit = |doctor_field: Option<(&str, uuid::Uuid)>| {
        let mut body = serde_json::json!({ "patient_id": patient["id"], "department_id": department_id });
        if let Some((key, id)) = doctor_field {
            body[key] = serde_json::json!(id);
        }
        app.client
            .post(app.url("/api/ipd/admissions"))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };

    assert_eq!(admit(None).await.expect("no doctor").status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        admit(Some(("doctor_id", nurse.user_id))).await.expect("nurse").status(),
        StatusCode::BAD_REQUEST
    );
    let resp = admit(Some(("admitting_doctor_id", doctor.user_id))).await.expect("doctor");
    assert_eq!(resp.status(), StatusCode::OK);
    let created: serde_json::Value = resp.json().await.expect("admission json");
    assert_eq!(created["admission"]["admitting_doctor"], doctor.user_id.to_string());
}
