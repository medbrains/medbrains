//! The desk's token lookup is scoped to patients the caller may see — #6012.
//!
//! The lookup took any patient id from the query string behind the queue-board
//! permission, so holding that permission was enough to read any patient's live
//! tokens: their name and where in the building they were waiting. The queue
//! permission now opens the route and the per-patient check decides the record.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

const LOOKUP: &str = "/api/tokens/by-patient";

/// Admin's tenant, a fresh department, and patients A and B each holding a
/// waiting token in it.
struct Desk {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    a: Uuid,
    b: Uuid,
}

/// Register a patient through the API, the way the desk would.
async fn register(app: &common::TestApp, csrf: &str, last_name: &str) -> R<Uuid> {
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(
            &json!({ "first_name": "Token", "last_name": last_name, "gender": "female",
                       "date_of_birth": "1980-02-02", "phone": "9990000612" }),
        )
        .send()
        .await?
        .json()
        .await?;
    Ok(patient["id"].as_str().ok_or("patient id")?.parse()?)
}

/// Put `patient` in the department's OPD queue.
async fn issue(app: &common::TestApp, csrf: &str, department: Uuid, patient: Uuid) -> R<()> {
    let resp = app
        .client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", csrf)
        .json(
            &json!({ "module": "opd", "scope": "department", "scope_id": department,
                       "patient_id": patient }),
        )
        .send()
        .await?;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "issue: {}",
        resp.text().await?
    );
    Ok(())
}

/// Set up the desk: two patients with a live token each.
async fn desk() -> R<Desk> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("TS{suffix}"))
    .bind(format!("Token Scope {suffix}"))
    .fetch_one(&app.db)
    .await?;
    let a = register(&app, &csrf, "Alpha").await?;
    let b = register(&app, &csrf, "Bravo").await?;
    issue(&app, &csrf, department, a).await?;
    issue(&app, &csrf, department, b).await?;
    Ok(Desk {
        app,
        csrf,
        tenant,
        a,
        b,
    })
}

impl Desk {
    /// `staff` looks up `patient`'s tokens; returns the status and body.
    async fn lookup(&self, staff: &common::Staff, patient: Uuid) -> R<(StatusCode, Value)> {
        let url = self.app.url(&format!("{LOOKUP}?patient_id={patient}"));
        let resp = staff.client.get(url).send().await?;
        let status = resp.status();
        Ok((status, resp.json().await.unwrap_or(Value::Null)))
    }

    /// Grant `staff` view of `patient`, as a care-team assignment would.
    async fn grant(&self, staff: &common::Staff, patient: Uuid) -> R<()> {
        sqlx::query(
            "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                    subject_type, subject_id, granted_by) \
             VALUES ($1, 'patient', $2, 'viewer', 'user', $3::text, $3)",
        )
        .bind(self.tenant)
        .bind(patient)
        .bind(staff.user_id)
        .execute(&self.app.db)
        .await?;
        Ok(())
    }
}

/// Given a receptionist who may see patient A and not patient B, When she looks
/// up each, Then she gets A's token and only A's, and B answers 404 with no
/// token in the body.
#[tokio::test]
async fn a_receptionist_reads_only_the_patients_she_may_see() -> R<()> {
    let d = desk().await?;
    let desk_staff = common::provision_staff(&d.app, &d.csrf, "receptionist", &[]).await;
    d.grant(&desk_staff, d.a).await?;

    let (status, body) = d.lookup(&desk_staff, d.a).await?;
    assert_eq!(status, StatusCode::OK, "{body}");
    let tokens = body.as_array().ok_or("a list")?;
    // Registration issues its own token too, so A holds more than the OPD one.
    assert!(!tokens.is_empty(), "A's live tokens: {body}");
    assert!(
        tokens.iter().all(|t| t["patient_id"] == json!(d.a)),
        "only A's tokens: {body}"
    );

    let (status, body) = d.lookup(&desk_staff, d.b).await?;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "B is not hers to see: {body}"
    );
    assert!(!body.is_array(), "no token data for B: {body}");
    Ok(())
}

/// Given staff who can see patient A but do not work the queue, When they look
/// A up, Then the queue permission refuses them (403).
#[tokio::test]
async fn the_lookup_needs_the_queue_permission() -> R<()> {
    let d = desk().await?;
    let denied = ["front_office.queue.list"];
    let no_queue = common::provision_staff(&d.app, &d.csrf, "receptionist", &denied).await;
    d.grant(&no_queue, d.a).await?;
    assert_eq!(d.lookup(&no_queue, d.a).await?.0, StatusCode::FORBIDDEN);
    Ok(())
}
