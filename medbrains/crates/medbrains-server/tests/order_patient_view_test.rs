//! An order placed at the lab or radiology desk has no doctor's encounter
//! behind it. Whoever may view the patient may still read it — through the
//! order's `patient->view` arrow — and nobody else may, and reading is all
//! the arrow grants.

mod common;

use medbrains_authz::{AuthzBackend, AuthzContext, Relation, backend_pg::PgAuthzBackend};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// A doctor who reads orders through ReBAC: the lab-floor rights that skip
/// the per-order check are taken away, radiology reading is added.
const DENIED: &[&str] = &["lab.results.update", "lab.specialized.create"];
const EXTRA: &[&str] = &["radiology.orders.view"];

struct Doctor {
    client: Client,
    user_id: Uuid,
}

async fn doctor(app: &common::TestApp, admin_csrf: &str) -> Doctor {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("tarrow_{tag}"), format!("Arrow#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": "Test arrow doctor",
            "role": "doctor",
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let user_id: Uuid = sqlx::query_scalar(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', $2::jsonb, 'denied', $3::jsonb), \
                perm_version = perm_version + 1 \
          WHERE username = $1 RETURNING id",
    )
    .bind(&username)
    .bind(json!(EXTRA))
    .bind(json!(DENIED))
    .fetch_one(&app.db)
    .await
    .expect("user");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), StatusCode::OK);
    Doctor { client, user_id }
}

async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

async fn patient(app: &common::TestApp, tenant: Uuid) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Walk', 'In', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-AR-{tag}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// The doctor is attending on the patient — the grant an OPD visit writes.
async fn make_attending(app: &common::TestApp, tenant: Uuid, patient: Uuid, doctor: Uuid) {
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'attending_physician', 'user', $3::text, $3)",
    )
    .bind(tenant)
    .bind(patient)
    .bind(doctor)
    .execute(&app.db)
    .await
    .expect("attending tuple");
}

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    assert_eq!(status, StatusCode::OK, "{path}: {body}");
    body
}

async fn status_of(client: &Client, url: String) -> (StatusCode, Value) {
    let resp = client.get(url).send().await.expect("get");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn ctx(tenant: Uuid, user: Uuid) -> AuthzContext {
    AuthzContext {
        tenant_id: tenant,
        user_id: user,
        role: "doctor".to_owned(),
        department_ids: Vec::new(),
        is_bypass: false,
    }
}

/// Given a walk-in lab order for patient P with a result on it, When the
/// doctor attending on P opens it, Then it opens with the result; When a
/// doctor with no link to P opens it, Then 404 — and the attending doctor
/// holds `view` on the order but not `edit`.
#[tokio::test]
async fn a_walk_in_lab_order_opens_for_whoever_may_view_the_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let test_id: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $2, 'Haemoglobin') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("HB-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("test");

    let placed = post(
        &app,
        &csrf,
        "/api/lab/direct-orders",
        json!({ "patient_id": patient, "test_ids": [test_id], "referral": { "kind": "self" } }),
    )
    .await;
    let order: Uuid = placed["orders"][0]["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("order id");
    sqlx::query(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value) \
         VALUES ($1, $2, 'Haemoglobin', '13.4')",
    )
    .bind(tenant)
    .bind(order)
    .execute(&app.db)
    .await
    .expect("result");

    let treating = doctor(&app, &csrf).await;
    let stranger = doctor(&app, &csrf).await;
    make_attending(&app, tenant, patient, treating.user_id).await;

    let url = app.url(&format!("/api/lab/orders/{order}"));
    let (status, body) = status_of(&treating.client, url.clone()).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["results"][0]["value"], "13.4", "{body}");

    let (status, body) = status_of(&stranger.client, url).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "deny stays deny: {body}");

    let authz = PgAuthzBackend::new(app.db.clone());
    let as_treating = ctx(tenant, treating.user_id);
    assert!(
        authz
            .check(&as_treating, Relation::Viewer, "lab_order", order)
            .await
            .expect("view")
    );
    assert!(
        !authz
            .check(&as_treating, Relation::Editor, "lab_order", order)
            .await
            .expect("edit"),
        "viewing the patient must not grant editing the order"
    );
    let listed = authz
        .list_accessible(&as_treating, "lab_order", Relation::Viewer)
        .await
        .expect("list");
    assert!(
        listed.contains(&order),
        "the order is in the doctor's list too"
    );
    let listed = authz
        .list_accessible(
            &ctx(tenant, stranger.user_id),
            "lab_order",
            Relation::Viewer,
        )
        .await
        .expect("list");
    assert!(!listed.contains(&order), "and not in a stranger's");
}

/// Given a radiology order placed at the desk with no encounter, When the
/// doctor attending on the patient opens it, Then 200; a stranger gets 404.
#[tokio::test]
async fn a_desk_radiology_order_opens_for_whoever_may_view_the_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let tag = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'X-ray') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("AR{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let placed = post(
        &app,
        &csrf,
        "/api/radiology/orders",
        json!({ "patient_id": patient, "modality_id": modality, "body_part": "Chest" }),
    )
    .await;
    assert!(
        placed["encounter_id"].is_null(),
        "a desk order has no encounter: {placed}"
    );
    let order: Uuid = placed["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("order id");

    let treating = doctor(&app, &csrf).await;
    let stranger = doctor(&app, &csrf).await;
    make_attending(&app, tenant, patient, treating.user_id).await;

    let url = app.url(&format!("/api/radiology/orders/{order}"));
    let (status, body) = status_of(&treating.client, url.clone()).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = status_of(&stranger.client, url).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "deny stays deny: {body}");

    let authz = PgAuthzBackend::new(app.db.clone());
    assert!(
        !authz
            .check(
                &ctx(tenant, treating.user_id),
                Relation::Editor,
                "radiology_order",
                order
            )
            .await
            .expect("edit"),
        "viewing the patient must not grant editing the order"
    );
}
