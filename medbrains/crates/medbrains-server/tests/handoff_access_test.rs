//! Handoff access: a department reaches a patient when work for that patient
//! reaches it, and not before.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn patient(app: &common::TestApp) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Handed', 'Off', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-HO-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// Whether the department with this code holds `dept_member` on the patient.
async fn department_reaches(app: &common::TestApp, code: &str, patient: Uuid) -> bool {
    sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM relation_tuples t \
           JOIN departments d ON d.id::text = t.subject_id AND d.tenant_id = t.tenant_id \
          WHERE t.object_type = 'patient' AND t.object_id = $1 \
            AND t.relation = 'dept_member' AND t.subject_type = 'department' \
            AND t.status = 'active' AND d.code = $2)",
    )
    .bind(patient)
    .bind(code)
    .fetch_one(&app.db)
    .await
    .expect("tuple lookup")
}

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a registered patient, billing cannot reach them. When a visit
/// starts, Then billing reaches them — and only once, however many visits.
#[tokio::test]
async fn a_visit_hands_its_patient_to_billing() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let patient = patient(&app).await;
    assert!(!department_reaches(&app, "BILLING-DEPT", patient).await);

    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.department_type = 'clinical' AND d.is_active LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("clinical department");
    for _ in 0..2 {
        let (status, body) = post(
            &app,
            &csrf,
            "/api/opd/encounters",
            json!({ "patient_id": patient, "department_id": department }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }

    assert!(department_reaches(&app, "BILLING-DEPT", patient).await);
    let grants: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM relation_tuples WHERE object_type = 'patient' AND object_id = $1 \
            AND relation = 'dept_member' AND granted_reason = 'handoff:BILLING-DEPT'",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(grants, 1, "one grant per patient, not per visit");
    assert!(
        !department_reaches(&app, "PHARMACY", patient).await,
        "a visit alone hands nothing to pharmacy"
    );
}

/// When a policy is put on file, Then the TPA desk (billing) reaches the
/// patient to work its claims and pre-authorisations.
#[tokio::test]
async fn a_policy_hands_its_patient_to_the_tpa_desk() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let patient = patient(&app).await;

    let (status, body) = post(
        &app,
        &csrf,
        &format!("/api/patients/{patient}/insurance"),
        json!({
            "insurance_provider": "Star Health",
            "policy_number": format!("POL-{}", &Uuid::new_v4().simple().to_string()[..8]),
            "valid_from": "2026-01-01",
            "valid_until": "2027-01-01",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(department_reaches(&app, "BILLING-DEPT", patient).await);
}
