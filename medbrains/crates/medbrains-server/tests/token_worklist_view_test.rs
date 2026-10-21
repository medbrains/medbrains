//! The doctor's own queue, not the hospital's
//! (RFCs/modules/RFC-MODULE-token-queues.md, §9 #47; user decision 2026-09-26).

use crate::common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    assert!(resp.status().is_success(), "{path}: {}", resp.status());
    resp.json().await.expect("json")
}

async fn department(app: &common::TestApp, tag: &str) -> Uuid {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("WV{tag}{suffix}"))
    .bind(format!("Worklist {tag} {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

/// A doctor in `dept`, signed in on their own client.
async fn doctor(app: &common::TestApp, csrf: &str, dept: Uuid) -> (Uuid, Client, String) {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_lowercase();
    let username = format!("wv_doc_{suffix}");
    let password = format!("WvDoc#{suffix}Aa9");
    let made = post(
        app,
        csrf,
        "/api/setup/users",
        json!({
            "username": username, "email": format!("{username}@e2e.medbrains.localhost"),
            "password": password, "full_name": format!("Dr {suffix}"), "role": "doctor",
            "department_ids": [dept], "specialization": "General Medicine",
            "medical_registration_number": format!("WV-{suffix}"), "qualification": "MBBS",
        }),
    )
    .await;
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
    let body: Value = login.json().await.expect("login json");
    let own_csrf = body["csrf_token"].as_str().unwrap_or("").to_owned();
    (
        made["id"].as_str().expect("id").parse().expect("uuid"),
        client,
        own_csrf,
    )
}

async fn patient(app: &common::TestApp, csrf: &str) -> String {
    let phone = format!("97{:08}", Uuid::new_v4().as_u128() % 100_000_000);
    let patient = post(
        app,
        csrf,
        "/api/patients",
        json!({ "first_name": "Worklist", "last_name": "View", "gender": "female", "date_of_birth": "1985-06-15", "phone": phone }),
    )
    .await;
    patient["id"].as_str().expect("patient").to_owned()
}

/// A walk-in given a number at the desk before any visit is opened: no
/// consultant yet. (An opened visit always has one — OPD assigns it.)
async fn walk_in(app: &common::TestApp, csrf: &str, dept: Uuid) -> String {
    let id = patient(app, csrf).await;
    post(
        app,
        csrf,
        "/api/tokens/issue",
        json!({ "module": "opd", "scope": "department", "scope_id": dept, "patient_id": id }),
    )
    .await;
    id
}

/// A patient's visit today with `doctor`; returns the patient id.
async fn visit(app: &common::TestApp, csrf: &str, dept: Uuid, doctor: Uuid) -> String {
    let id = patient(app, csrf).await;
    post(
        app,
        csrf,
        "/api/opd/encounters",
        json!({ "patient_id": id, "department_id": dept, "doctor_id": doctor }),
    )
    .await;
    id
}

async fn worklist(app: &common::TestApp, client: &Client, view: &str) -> (StatusCode, Vec<String>) {
    let resp = client
        .get(app.url(&format!("/api/tokens/worklist?module=opd&view={view}")))
        .send()
        .await
        .expect("worklist");
    let status = resp.status();
    let rows: Vec<Value> = resp.json().await.unwrap_or_default();
    let ids = rows
        .iter()
        .filter_map(|t| t["patient_id"].as_str().map(ToOwned::to_owned))
        .collect();
    (status, ids)
}

/// Given two doctors in one department and a department elsewhere, When a
/// doctor opens their queue, Then they see their own patients first, then the
/// department's patients with no consultant — never a colleague's, never
/// another department's; And "whole department" adds the colleague's.
#[tokio::test]
async fn a_doctor_sees_their_own_then_the_departments_unassigned() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (clinic, elsewhere) = (department(&app, "A").await, department(&app, "B").await);
    let (me, my_client, my_csrf) = doctor(&app, &csrf, clinic).await;
    let (colleague, _, _) = doctor(&app, &csrf, clinic).await;

    let unassigned = walk_in(&app, &csrf, clinic).await;
    let mine = visit(&app, &csrf, clinic, me).await;
    let theirs = visit(&app, &csrf, clinic, colleague).await;
    let other_dept = walk_in(&app, &csrf, elsewhere).await;

    let (status, queue) = worklist(&app, &my_client, "mine").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        queue,
        vec![mine.clone(), unassigned.clone()],
        "own first, then unassigned"
    );
    assert!(!queue.contains(&theirs) && !queue.contains(&other_dept));

    let (_, department) = worklist(&app, &my_client, "department").await;
    for id in [&mine, &unassigned, &theirs] {
        assert!(department.contains(id), "the whole department");
    }
    assert!(
        !department.contains(&other_dept),
        "but not another department"
    );

    // Call next picks from what the doctor is looking at: their own patient,
    // although the walk-in took a number first.
    let called: Value = my_client
        .post(app.url("/api/tokens/call-next"))
        .header("x-csrf-token", &my_csrf)
        .json(&json!({ "module": "opd", "view": "mine", "counter_label": "Room 4" }))
        .send()
        .await
        .expect("call next")
        .json()
        .await
        .expect("called");
    assert_eq!(called["patient_id"], json!(mine), "own patient first");

    let (status, _) = worklist(&app, &my_client, "everything").await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "an unknown view is refused, not empty"
    );
}
