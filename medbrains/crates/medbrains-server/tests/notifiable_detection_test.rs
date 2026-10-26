//! Notifiable-disease detection from every source (migration 1230).
//!
//! A disease concluded anywhere -- a coded diagnosis on an OPD, admission or
//! ER encounter, the final diagnosis of an IPD or ER discharge summary, a
//! verified lab result -- lands on one worklist row per patient, disease and
//! episode, presumptive until the lab confirms it.
//!
//! Each test runs in a hospital of its own: the overlay is per hospital, and
//! the escalation pass reads every hospital's overdue rows.

use crate::common;

use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

struct Hospital {
    tenant: Uuid,
    client: Client,
    csrf: String,
    doctor: Uuid,
    department: Uuid,
}

async fn hospital(app: &common::TestApp) -> Hospital {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("NT{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Notifiable Check Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    let mut users = Vec::new();
    for role in ["hospital_admin", "doctor"] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
             SELECT $1, $2, $2 || '@notifiable.example.org', 'Notifiable Check', $3::user_role, \
                    password_hash FROM users WHERE username = 'admin' RETURNING id",
        )
        .bind(tenant)
        .bind(format!("nt{role}_{}", suffix.to_lowercase()))
        .bind(role)
        .fetch_one(&app.db)
        .await
        .expect("user");
        users.push(id);
    }
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, 'GM', 'General Medicine', 'clinical') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(
            &json!({ "username": format!("nthospital_admin_{}", suffix.to_lowercase()),
                       "password": "admin123", "hospital_code": code }),
        )
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    Hospital {
        tenant,
        client,
        csrf: login["csrf_token"].as_str().unwrap_or_default().to_owned(),
        doctor: users[1],
        department,
    }
}

impl Hospital {
    async fn call(&self, app: &common::TestApp, method: Method, path: &str, body: Value) -> Value {
        let resp = self
            .client
            .request(method, app.url(path))
            .header("x-csrf-token", &self.csrf)
            .json(&body)
            .send()
            .await
            .expect("request");
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        assert!(status.is_success(), "{path} → {status}: {text}");
        serde_json::from_str(&text).unwrap_or(Value::Null)
    }

    async fn patient(&self, app: &common::TestApp, phone: &str) -> Value {
        self.call(
            app,
            Method::POST,
            "/api/patients",
            json!({ "first_name": "Notify", "last_name": "Case", "gender": "female",
                    "date_of_birth": "1984-04-04", "phone": phone }),
        )
        .await
    }

    async fn opd_visit(&self, app: &common::TestApp, patient: &Value) -> String {
        let visit = self
            .call(
                app,
                Method::POST,
                "/api/opd/encounters",
                json!({ "patient_id": patient["id"], "department_id": self.department,
                        "encounter_type": "opd" }),
            )
            .await;
        visit["encounter"]["id"]
            .as_str()
            .expect("encounter")
            .to_owned()
    }

    async fn admit(&self, app: &common::TestApp, patient: &Value) -> Value {
        self.call(
            app,
            Method::POST,
            "/api/ipd/admissions",
            json!({ "patient_id": patient["id"], "department_id": self.department,
                    "doctor_id": self.doctor }),
        )
        .await
    }

    /// The worklist rows for one patient: (disease code, case class, source, status).
    async fn rows(
        &self,
        app: &common::TestApp,
        patient: &Value,
    ) -> Vec<(String, String, String, String)> {
        let rows: Vec<Value> = serde_json::from_value(
            self.call(app, Method::GET, "/api/ckb/notifiable-reports", Value::Null)
                .await,
        )
        .unwrap_or_default();
        let mut out: Vec<_> = rows
            .iter()
            .filter(|r| r["patient_id"] == patient["id"])
            .map(|r| {
                (
                    r["icd10_code"].as_str().unwrap_or_default().to_owned(),
                    r["case_class"].as_str().unwrap_or_default().to_owned(),
                    r["source"].as_str().unwrap_or_default().to_owned(),
                    r["status"].as_str().unwrap_or_default().to_owned(),
                )
            })
            .collect();
        out.sort();
        out
    }
}

fn row(code: &str, class: &str, source: &str, status: &str) -> (String, String, String, String) {
    (
        code.to_owned(),
        class.to_owned(),
        source.to_owned(),
        status.to_owned(),
    )
}

/// Given dengue coded in OPD (ICD-11), When the admission's discharge summary
/// names it again and the NS1 antigen comes back positive, Then there is one
/// row, raised from presumptive to lab-confirmed -- and reopened for the
/// L-form when the presumptive report had already been submitted.
#[tokio::test]
async fn one_episode_is_one_row_raised_to_lab_confirmed() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let patient = h.patient(&app, "9990000701").await;
    let encounter = h.opd_visit(&app, &patient).await;

    h.call(
        &app,
        Method::POST,
        &format!("/api/opd/encounters/{encounter}/diagnoses"),
        json!({ "icd_code": "1D20.0", "icd_system": "icd11", "description": "Dengue without warning signs" }),
    )
    .await;
    assert_eq!(
        h.rows(&app, &patient).await,
        vec![row("A90", "presumptive", "opd_diagnosis", "pending")]
    );

    // The presumptive (P) report is submitted on IHIP.
    let reports: Vec<Value> = serde_json::from_value(
        h.call(
            &app,
            Method::GET,
            "/api/ckb/notifiable-reports",
            Value::Null,
        )
        .await,
    )
    .unwrap_or_default();
    let id = reports[0]["id"].as_str().expect("report id");
    h.call(
        &app,
        Method::PUT,
        &format!("/api/ckb/notifiable-reports/{id}"),
        json!({ "status": "submitted", "report_ref": "IHIP-P-77" }),
    )
    .await;

    // Admitted; the discharge summary names dengue again: still one row.
    let admission = h.admit(&app, &patient).await;
    let admission_id = admission["admission"]["id"].as_str().expect("admission");
    h.call(
        &app,
        Method::POST,
        &format!("/api/ipd/admissions/{admission_id}/discharge-summary"),
        json!({ "final_diagnosis": "Dengue fever with thrombocytopenia",
                "condition_at_discharge": "Stable", "course_in_hospital": "Fluids, monitored",
                "follow_up_instructions": "Review in 1 week" }),
    )
    .await;
    h.call(
        &app,
        Method::POST,
        &format!("/api/ipd/admissions/{admission_id}/discharge-summary/finalize"),
        json!({}),
    )
    .await;
    assert_eq!(
        h.rows(&app, &patient).await,
        vec![row("A90", "presumptive", "opd_diagnosis", "submitted")]
    );

    // The lab confirms it: the same row becomes lab-confirmed and is reopened
    // for the L-form, keeping the P-form acknowledgement.
    let test: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, price) \
         VALUES ($1, 'DNS1', 'Dengue NS1 antigen', 400) RETURNING id",
    )
    .bind(h.tenant)
    .fetch_one(&app.db)
    .await
    .expect("lab test");
    let order = h
        .call(
            &app,
            Method::POST,
            "/api/lab/orders",
            json!({ "patient_id": patient["id"], "encounter_id": encounter, "test_id": test }),
        )
        .await;
    let order_id = order["id"].as_str().expect("order");
    h.call(
        &app,
        Method::PUT,
        &format!("/api/lab/orders/{order_id}/collect"),
        json!({ "patient_identifier": patient["uhid"] }),
    )
    .await;
    h.call(
        &app,
        Method::PUT,
        &format!("/api/lab/orders/{order_id}/process"),
        json!({}),
    )
    .await;
    h.call(
        &app,
        Method::POST,
        &format!("/api/lab/orders/{order_id}/results"),
        json!({ "results": [{ "parameter_name": "Dengue NS1 antigen", "value": "Positive" }] }),
    )
    .await;
    h.call(
        &app,
        Method::PUT,
        &format!("/api/lab/orders/{order_id}/complete"),
        json!({}),
    )
    .await;
    h.call(
        &app,
        Method::PUT,
        &format!("/api/lab/orders/{order_id}/verify"),
        json!({}),
    )
    .await;

    assert_eq!(
        h.rows(&app, &patient).await,
        vec![row("A90", "confirmed", "opd_diagnosis", "pending")]
    );
    let (presumptive_ref, lab_order): (Option<String>, Option<Uuid>) = sqlx::query_as(
        "SELECT presumptive_ref, lab_order_id FROM notifiable_disease_reports WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("report");
    assert_eq!(presumptive_ref.as_deref(), Some("IHIP-P-77"));
    assert_eq!(lab_order.map(|o| o.to_string()).as_deref(), Some(order_id));
}

/// An ER final diagnosis and an IPD-encounter code are detected; a denied
/// mention ("no malaria") is not; and the specific disease wins over the
/// general one ("vivax malaria" is vivax, not also "malaria").
#[tokio::test]
async fn er_and_inpatient_diagnoses_are_detected_and_denials_are_not() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;

    let er_patient = h.patient(&app, "9990000702").await;
    let visit = h
        .call(
            &app,
            Method::POST,
            "/api/emergency/visits",
            json!({ "patient_id": er_patient["id"], "chief_complaint": "Fever with chills" }),
        )
        .await;
    let visit_id = visit["id"].as_str().expect("visit");
    h.call(
        &app,
        Method::POST,
        &format!("/api/emergency/visits/{visit_id}/discharge-summary"),
        json!({ "final_diagnosis": "Plasmodium vivax malaria. No dengue." }),
    )
    .await;
    h.call(
        &app,
        Method::POST,
        &format!("/api/emergency/visits/{visit_id}/discharge-summary/finalize"),
        json!({}),
    )
    .await;
    assert_eq!(
        h.rows(&app, &er_patient).await,
        vec![row("B51", "presumptive", "er_diagnosis", "pending")]
    );

    let ipd_patient = h.patient(&app, "9990000703").await;
    let admission = h.admit(&app, &ipd_patient).await;
    let ipd_encounter = admission["admission"]["encounter_id"]
        .as_str()
        .expect("encounter");
    h.call(
        &app,
        Method::POST,
        &format!("/api/opd/encounters/{ipd_encounter}/diagnoses"),
        json!({ "icd_code": "RA01", "icd_system": "icd11", "description": "COVID-19" }),
    )
    .await;
    assert_eq!(
        h.rows(&app, &ipd_patient).await,
        vec![row("U07.1", "presumptive", "ipd_diagnosis", "pending")]
    );
}

/// The hospital's state overlay: a disease its state notifies is detected; a
/// national one taken off its list is not.
#[tokio::test]
async fn the_state_overlay_adds_and_removes_diseases() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    h.call(
        &app,
        Method::PUT,
        "/api/ckb/notifiable-overrides",
        json!({ "icd10_code": "a75.3", "disease_name": "Scrub typhus", "is_notifiable": true,
                "report_timeframe": "weekly", "icd11_code": null }),
    )
    .await;
    h.call(&app, Method::PUT, "/api/ckb/notifiable-overrides",
        json!({ "icd10_code": "A92.0", "is_notifiable": false, "notes": "Not notified in this state" })).await;

    let list = h
        .call(&app, Method::GET, "/api/ckb/notifiable-list", Value::Null)
        .await;
    let codes: Vec<&str> = list["diseases"]
        .as_array()
        .expect("list")
        .iter()
        .filter_map(|d| d["disease_code"].as_str())
        .collect();
    assert!(
        codes.contains(&"A75.3") && !codes.contains(&"A92.0"),
        "{codes:?}"
    );

    let patient = h.patient(&app, "9990000704").await;
    let visit = h
        .call(
            &app,
            Method::POST,
            "/api/emergency/visits",
            json!({ "patient_id": patient["id"], "chief_complaint": "Fever, eschar" }),
        )
        .await;
    let visit_id = visit["id"].as_str().expect("visit");
    h.call(
        &app,
        Method::POST,
        &format!("/api/emergency/visits/{visit_id}/discharge-summary"),
        json!({ "final_diagnosis": "Scrub typhus; chikungunya" }),
    )
    .await;
    h.call(
        &app,
        Method::POST,
        &format!("/api/emergency/visits/{visit_id}/discharge-summary/finalize"),
        json!({}),
    )
    .await;
    assert_eq!(
        h.rows(&app, &patient).await,
        vec![row("A75.3", "presumptive", "er_diagnosis", "pending")]
    );

    // A disease the national list does not know must be named.
    let resp = h
        .client
        .put(app.url("/api/ckb/notifiable-overrides"))
        .header("x-csrf-token", &h.csrf)
        .json(&json!({ "icd10_code": "Z99.9", "is_notifiable": true }))
        .send()
        .await
        .expect("unnamed");
    assert_eq!(
        resp.status(),
        StatusCode::BAD_REQUEST,
        "a new disease must be named"
    );
}

/// A row past its due time is escalated once, to the people who work the list.
#[tokio::test]
async fn an_overdue_report_is_escalated_once() {
    let app = common::spawn_app().await;
    let h = hospital(&app).await;
    let patient = h.patient(&app, "9990000705").await;
    let encounter = h.opd_visit(&app, &patient).await;
    h.call(
        &app,
        Method::POST,
        &format!("/api/opd/encounters/{encounter}/diagnoses"),
        json!({ "icd_code": "1A00", "icd_system": "icd11", "description": "Cholera" }),
    )
    .await;
    let id: Uuid = sqlx::query_scalar(
        "UPDATE notifiable_disease_reports SET due_at = now() - INTERVAL '1 hour' \
          WHERE tenant_id = $1 RETURNING id",
    )
    .bind(h.tenant)
    .fetch_one(&app.db)
    .await
    .expect("overdue row");

    medbrains_server::services::notifiable_report_escalation::escalate_overdue(&app.db)
        .await
        .expect("pass");
    medbrains_server::services::notifiable_report_escalation::escalate_overdue(&app.db)
        .await
        .expect("second pass");
    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE entity_id = $1 AND title = 'Notifiable disease report overdue'",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("notifications");
    // The hospital admin; the detecting clinician is the same admin here.
    assert_eq!(told, 1, "told once, not every pass");
}
