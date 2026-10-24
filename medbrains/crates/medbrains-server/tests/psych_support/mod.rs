#![allow(dead_code, unreachable_pub)]

//! Shared steps for the psychiatry tests: staff who sign in through the real
//! API, a patient, a care-team grant, and an enrolled psychiatric record.

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

pub struct Doctor {
    pub client: Client,
    pub csrf: String,
    pub id: Uuid,
    pub password: String,
}

pub async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

pub async fn doctor(app: &common::TestApp, admin_csrf: &str) -> Doctor {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("psydoc_{tag}"), format!("PsyDoc#{tag}Aa9"));
    let (status, body) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Doctor {tag}"),
            "role": "doctor",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_one(&app.db)
        .await
        .expect("user id");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    Doctor {
        client,
        csrf,
        id,
        password,
    }
}

pub async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

pub async fn patient(app: &common::TestApp, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Mind', 'Private', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-PSY-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// On the patient's general care team: may open the chart.
pub async fn on_care_team(app: &common::TestApp, tenant: Uuid, patient: Uuid, user: Uuid) {
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'attending_physician', 'user', $3::text, $3)",
    )
    .bind(tenant)
    .bind(patient)
    .bind(user)
    .execute(&app.db)
    .await
    .expect("care-team tuple");
}

pub async fn enrol(app: &common::TestApp, csrf: &str, patient: Uuid, psychiatrist: Uuid) -> String {
    let (status, body) = send(
        csrf,
        app.client
            .post(app.url("/api/specialty/psychiatry/patients"))
            .json(&json!({
                "patient_id": patient,
                "admission_category": "independent",
                "treating_psychiatrist_id": psychiatrist,
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["is_restricted"], true,
        "a new record starts restricted"
    );
    body["id"].as_str().expect("psych id").to_owned()
}

/// A patient with a date of birth and gender — the Act's sections turn on
/// both.
pub async fn patient_born(app: &common::TestApp, tenant: Uuid, dob: &str, gender: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'Mhca', 'Patient', $3::gender, $4, $5::date) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-MHC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(gender)
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .bind(dob)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}
