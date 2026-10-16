//! Ward safety rules the record enforces (COMPLIANCE-GAP-2026-10 #6, #7):
//! an admission gets an IP number; chemotherapy is refused to a nurse
//! without an active chemotherapy certification, and the refusal is audited;
//! a PRN dose is not recorded without its reason; a high Morse score flags
//! the admission and opens the fall-prevention plan and task, once.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

struct Ward {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    admission: String,
}

async fn admit() -> Ward {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("departments");
    let department = depts[0]["id"].as_str().expect("a department").to_owned();
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "first_name": "Ward", "last_name": "Safety", "gender": "female",
            "date_of_birth": "1970-01-01", "phone": "9990000065",
        }))
        .send()
        .await
        .expect("patient")
        .json()
        .await
        .expect("patient json");
    let admitted: Value = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient["id"], "department_id": department }))
        .send()
        .await
        .expect("admit")
        .json()
        .await
        .expect("admit json");
    let number = admitted["admission"]["admission_number"]
        .as_str()
        .unwrap_or("");
    assert!(
        number.starts_with("IP-"),
        "admission must carry an IP number: {admitted}"
    );
    let admission = admitted["admission"]["id"]
        .as_str()
        .expect("admission id")
        .to_owned();
    Ward {
        app,
        csrf,
        tenant,
        admission,
    }
}

impl Ward {
    async fn send(&self, method: reqwest::Method, path: &str, body: &Value) -> (StatusCode, Value) {
        let resp = self
            .app
            .client
            .request(method, self.app.url(path))
            .header("x-csrf-token", &self.csrf)
            .json(body)
            .send()
            .await
            .expect("request");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    async fn new_dose(&self, drug: &str, frequency: &str) -> String {
        let (status, dose) = self
            .send(
                reqwest::Method::POST,
                &format!("/api/ipd/admissions/{}/mar", self.admission),
                &json!({
                    "drug_name": drug, "dose": "1", "route": "iv",
                    "frequency": frequency, "scheduled_at": "2026-10-12T08:00:00Z",
                }),
            )
            .await;
        assert!(status.is_success(), "create dose: {status} {dose}");
        dose["id"].as_str().expect("dose id").to_owned()
    }

    async fn give(&self, dose: &str, extra: Value) -> (StatusCode, Value) {
        let mut body = json!({ "status": "given" });
        if let (Some(b), Some(e)) = (body.as_object_mut(), extra.as_object()) {
            b.extend(e.clone());
        }
        self.send(
            reqwest::Method::PUT,
            &format!("/api/ipd/admissions/{}/mar/{dose}", self.admission),
            &body,
        )
        .await
    }
}

#[tokio::test]
async fn chemotherapy_needs_an_active_chemo_certification() {
    let ward = admit().await;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let drug = format!("Cyclophosphamide {tag}");
    sqlx::query(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, atc_code) VALUES ($1, $2, $3, 'L01AA01')",
    )
    .bind(ward.tenant)
    .bind(format!("CHEMO-{tag}"))
    .bind(&drug)
    .execute(&ward.app.db)
    .await
    .expect("catalog");
    let dose = ward.new_dose(&drug, "once").await;

    let (status, body) = ward.give(&dose, json!({})).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "uncertified chemo must be refused: {body}"
    );
    assert!(
        body.to_string().to_lowercase().contains("chemotherapy"),
        "the refusal must say why: {body}"
    );
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log \
         WHERE action = 'ipd.mar.chemo_administration_blocked' AND entity_id = $1",
    )
    .bind(Uuid::parse_str(&dose).expect("uuid"))
    .fetch_one(&ward.app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1, "the refused attempt must be audited");

    // HR records the certification; the same nurse may now give it.
    let employee: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name, user_id) \
         SELECT $1, $2, 'Admin', id FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(ward.tenant)
    .bind(format!("EMP-{tag}"))
    .fetch_one(&ward.app.db)
    .await
    .expect("employee");
    sqlx::query(
        "INSERT INTO employee_credentials \
           (tenant_id, employee_id, credential_type, issuing_body, registration_no, expiry_date) \
         VALUES ($1, $2, 'chemotherapy_administration', 'Oncology Nursing Board', $3, \
                 CURRENT_DATE + 365)",
    )
    .bind(ward.tenant)
    .bind(employee)
    .bind(format!("CH-{tag}"))
    .execute(&ward.app.db)
    .await
    .expect("credential");

    // Recorded but not yet verified by HR: still refused.
    let (status, body) = ward.give(&dose, json!({})).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "unverified certification: {body}"
    );

    sqlx::query(
        "UPDATE employee_credentials SET verified_at = now() \
         WHERE employee_id = $1 AND tenant_id = $2",
    )
    .bind(employee)
    .bind(ward.tenant)
    .execute(&ward.app.db)
    .await
    .expect("verify");

    let (status, body) = ward.give(&dose, json!({})).await;
    assert!(
        status.is_success(),
        "a certified nurse gives chemo: {status} {body}"
    );

    sqlx::query("UPDATE employees SET deleted_at = now() WHERE id = $1")
        .bind(employee)
        .execute(&ward.app.db)
        .await
        .expect("cleanup");
}

#[tokio::test]
async fn a_prn_dose_is_not_recorded_without_its_reason() {
    let ward = admit().await;
    let dose = ward.new_dose("Paracetamol", "PRN").await;

    let (status, body) = ward.give(&dose, json!({})).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "PRN without reason: {body}"
    );

    let (status, body) = ward
        .give(&dose, json!({ "prn_reason": "Pain score 7" }))
        .await;
    assert!(status.is_success(), "PRN with reason: {status} {body}");
    assert_eq!(
        body["prn_reason"], "Pain score 7",
        "the reason is saved: {body}"
    );
}

#[tokio::test]
async fn a_high_morse_score_flags_the_admission_and_opens_prevention_once() {
    let ward = admit().await;
    let path = format!("/api/ipd/admissions/{}/assessments", ward.admission);
    for _ in 0..2 {
        let (status, body) = ward
            .send(
                reqwest::Method::POST,
                &path,
                &json!({ "assessment_type": "morse_fall_scale", "score_value": 55 }),
            )
            .await;
        assert!(status.is_success(), "morse: {status} {body}");
    }

    let (_, detail) = ward
        .send(
            reqwest::Method::GET,
            &format!("/api/ipd/admissions/{}", ward.admission),
            &Value::Null,
        )
        .await;
    assert_eq!(detail["admission"]["is_fall_risk"], true, "{detail}");
    let fall_tasks = detail["tasks"].as_array().map_or(0, |t| {
        t.iter()
            .filter(|t| t["task_type"] == "fall_precautions")
            .count()
    });
    assert_eq!(
        fall_tasks, 1,
        "one fall-precaution task, not one per reassessment"
    );

    let (_, plans) = ward
        .send(
            reqwest::Method::GET,
            &format!("/api/ipd/admissions/{}/care-plans", ward.admission),
            &Value::Null,
        )
        .await;
    let fall_plans = plans.as_array().map_or(0, |p| {
        p.iter()
            .filter(|p| {
                p["nursing_diagnosis"]
                    .as_str()
                    .is_some_and(|d| d.starts_with("Risk for falls"))
            })
            .count()
    });
    assert_eq!(fall_plans, 1, "one fall-prevention care plan: {plans}");

    // A lower score on reassessment clears the flag; the plan stays for the nurse to close.
    let (status, _) = ward
        .send(
            reqwest::Method::POST,
            &path,
            &json!({ "assessment_type": "morse_fall_scale", "score_value": 20 }),
        )
        .await;
    assert!(status.is_success());
    let (_, detail) = ward
        .send(
            reqwest::Method::GET,
            &format!("/api/ipd/admissions/{}", ward.admission),
            &Value::Null,
        )
        .await;
    assert_eq!(detail["admission"]["is_fall_risk"], false, "{detail}");
}
