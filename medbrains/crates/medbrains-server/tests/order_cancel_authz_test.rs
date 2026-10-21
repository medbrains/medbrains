//! Who may cancel a lab or radiology order: the doctor who placed it, or the
//! department that runs it. A second doctor who can see the patient may read
//! the order but not cancel it — and is told 404, not 403.

mod common;

use common::{Staff, TestApp, provision_staff};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn tenant(app: &TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

async fn patient(app: &TestApp, tenant: Uuid) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Cancel', 'Case', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-CX-{tag}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// Everyone in these tests may view the patient — the cancel rule is the
/// only thing that tells them apart.
async fn make_attending(app: &TestApp, tenant: Uuid, patient: Uuid, user: Uuid) {
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
    .expect("attending tuple");
}

async fn staff_on(app: &TestApp, csrf: &str, role: &str, tenant: Uuid, patient: Uuid) -> Staff {
    let s = provision_staff(app, csrf, role, &[]).await;
    make_attending(app, tenant, patient, s.user_id).await;
    s
}

async fn admin_post(app: &TestApp, csrf: &str, path: &str, body: Value) -> Value {
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

async fn put(staff: &Staff, url: String, body: Value) -> (StatusCode, Value) {
    let resp = staff
        .client
        .put(url)
        .header("x-csrf-token", &staff.csrf)
        .json(&body)
        .send()
        .await
        .expect("put");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn id_of(v: &Value) -> Uuid {
    v.as_str().and_then(|s| s.parse().ok()).expect("id")
}

/// A lab order for `patient`, placed by `doctor`.
async fn lab_order(app: &TestApp, csrf: &str, tenant: Uuid, patient: Uuid, doctor: Uuid) -> Uuid {
    let test_id: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $2, 'Creatinine') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CR-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("test");
    let placed = admin_post(
        app,
        csrf,
        "/api/lab/direct-orders",
        json!({ "patient_id": patient, "test_ids": [test_id], "referral": { "kind": "self" } }),
    )
    .await;
    let order = id_of(&placed["orders"][0]["id"]);
    sqlx::query("UPDATE lab_orders SET ordered_by = $2 WHERE id = $1")
        .bind(order)
        .bind(doctor)
        .execute(&app.db)
        .await
        .expect("ordered_by");
    order
}

/// A radiology order for `patient`, placed by `doctor`.
async fn radiology_order(
    app: &TestApp,
    csrf: &str,
    modality: Uuid,
    patient: Uuid,
    doctor: Uuid,
) -> Uuid {
    let placed = admin_post(
        app,
        csrf,
        "/api/radiology/orders",
        json!({ "patient_id": patient, "modality_id": modality, "body_part": "Chest" }),
    )
    .await;
    let order = id_of(&placed["id"]);
    sqlx::query("UPDATE radiology_orders SET ordered_by = $2 WHERE id = $1")
        .bind(order)
        .bind(doctor)
        .execute(&app.db)
        .await
        .expect("ordered_by");
    order
}

async fn modality(app: &TestApp, tenant: Uuid) -> Uuid {
    let tag = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'X-ray') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CX{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality")
}

async fn lab_status(app: &TestApp, order: Uuid) -> String {
    sqlx::query_scalar("SELECT status::text FROM lab_orders WHERE id = $1")
        .bind(order)
        .fetch_one(&app.db)
        .await
        .expect("status")
}

async fn radiology_status(app: &TestApp, order: Uuid) -> String {
    sqlx::query_scalar("SELECT status::text FROM radiology_orders WHERE id = $1")
        .bind(order)
        .fetch_one(&app.db)
        .await
        .expect("status")
}

/// Given doctor A's lab order for P and doctor B also on P's care team,
/// When B cancels it, Then 404 and it stays ordered; When A cancels it,
/// Then 200. Given another of A's orders, When the lab desk cancels it,
/// Then 200.
#[tokio::test]
async fn a_lab_order_is_cancelled_by_its_orderer_or_the_lab_not_another_doctor() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let orderer = staff_on(&app, &csrf, "doctor", tenant, patient).await;
    let colleague = staff_on(&app, &csrf, "doctor", tenant, patient).await;
    let lab = staff_on(&app, &csrf, "lab_technician", tenant, patient).await;

    let order = lab_order(&app, &csrf, tenant, patient, orderer.user_id).await;
    let url = app.url(&format!("/api/lab/orders/{order}/cancel"));

    let (status, body) = put(&colleague, url.clone(), json!({})).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    assert_eq!(
        lab_status(&app, order).await,
        "ordered",
        "refused, untouched"
    );

    let (status, body) = put(&orderer, url, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(lab_status(&app, order).await, "cancelled");

    let other = lab_order(&app, &csrf, tenant, patient, orderer.user_id).await;
    let (status, body) = put(
        &lab,
        app.url(&format!("/api/lab/orders/{other}/cancel")),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the lab desk cancels any order: {body}"
    );
    assert_eq!(lab_status(&app, other).await, "cancelled");
}

/// The same rule for imaging: B is refused with 404, A and the radiology
/// desk may cancel.
#[tokio::test]
async fn a_radiology_order_is_cancelled_by_its_orderer_or_the_radiology_desk() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let modality = modality(&app, tenant).await;
    let orderer = staff_on(&app, &csrf, "doctor", tenant, patient).await;
    let colleague = staff_on(&app, &csrf, "doctor", tenant, patient).await;
    let desk = staff_on(&app, &csrf, "radiology_tech", tenant, patient).await;
    let reason = json!({ "cancellation_reason": "Duplicate request" });

    let order = radiology_order(&app, &csrf, modality, patient, orderer.user_id).await;
    let url = app.url(&format!("/api/radiology/orders/{order}/cancel"));

    let (status, body) = put(&colleague, url.clone(), reason.clone()).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    assert_eq!(radiology_status(&app, order).await, "ordered");

    // Nor through the status endpoint, which cancelled with no reason, no
    // charge reversal and from any state.
    let (status, body) = put(
        &colleague,
        app.url(&format!("/api/radiology/orders/{order}/status")),
        json!({ "status": "cancelled" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(radiology_status(&app, order).await, "ordered");

    let (status, body) = put(&orderer, url, reason.clone()).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(radiology_status(&app, order).await, "cancelled");

    let other = radiology_order(&app, &csrf, modality, patient, orderer.user_id).await;
    let (status, body) = put(
        &desk,
        app.url(&format!("/api/radiology/orders/{other}/cancel")),
        reason,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "the desk cancels any order: {body}");
    assert_eq!(radiology_status(&app, other).await, "cancelled");
}

/// The radiology desk still runs a doctor's study from start to finish.
#[tokio::test]
async fn the_radiology_desk_still_moves_a_study_through_its_states() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let modality = modality(&app, tenant).await;
    let orderer = staff_on(&app, &csrf, "doctor", tenant, patient).await;
    let desk = staff_on(&app, &csrf, "radiology_tech", tenant, patient).await;

    let order = radiology_order(&app, &csrf, modality, patient, orderer.user_id).await;
    let url = app.url(&format!("/api/radiology/orders/{order}/status"));
    for next in ["in_progress", "completed"] {
        let (status, body) = put(&desk, url.clone(), json!({ "status": next })).await;
        assert_eq!(status, StatusCode::OK, "{next}: {body}");
        assert_eq!(radiology_status(&app, order).await, next);
    }
}

/// Given a doctor on P's care team, When they open P's imaging order, Then
/// 200 with the built-in role; without `radiology.orders.view` it was 403.
#[tokio::test]
async fn a_doctor_reads_the_imaging_they_care_for() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let modality = modality(&app, tenant).await;
    let doctor = staff_on(&app, &csrf, "doctor", tenant, patient).await;
    let order = radiology_order(&app, &csrf, modality, patient, doctor.user_id).await;
    let url = app.url(&format!("/api/radiology/orders/{order}"));

    let resp = doctor.client.get(url.clone()).send().await.expect("get");
    assert_eq!(resp.status(), StatusCode::OK);

    let before = provision_staff(&app, &csrf, "doctor", &["radiology.orders.view"]).await;
    make_attending(&app, tenant, patient, before.user_id).await;
    let resp = before.client.get(url).send().await.expect("get");
    assert_eq!(
        resp.status(),
        StatusCode::FORBIDDEN,
        "what the role used to answer"
    );
}
