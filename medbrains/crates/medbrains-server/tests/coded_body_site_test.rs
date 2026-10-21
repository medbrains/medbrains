//! A body site picked on the anatomy model is kept as a code and a side,
//! next to the words a chart prints.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A visit to record the wound against.
async fn encounter(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Coded', 'Site', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-BS-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned()
}

/// Given a nurse picks "Left femur" on the body, When the wound is saved,
/// Then the FMA code and the side are kept with the printed words; an
/// unknown side is refused rather than stored.
#[tokio::test]
async fn a_picked_wound_site_keeps_its_code_and_side() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter_id = encounter(&app, &csrf).await;

    let (status, wound) = send(
        &csrf,
        app.client.post(app.url("/api/nurse/wounds")).json(&json!({
            "encounter_id": encounter_id,
            "body_site": "Left femur",
            "body_site_code": "FMA24474",
            "body_site_laterality": "left",
            "classification": "pressure_injury",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{wound}");
    assert_eq!(wound["body_site"], "Left femur");
    assert_eq!(wound["body_site_code"], "FMA24474");
    assert_eq!(wound["body_site_laterality"], "left");

    let (status, _) = send(
        &csrf,
        app.client.post(app.url("/api/nurse/wounds")).json(&json!({
            "encounter_id": encounter_id,
            "body_site": "Heel",
            "body_site_laterality": "upper",
        })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "an unknown side is refused"
    );
}

/// A patient on file, for orders that do not need a visit.
async fn patient(app: &common::TestApp) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Ordered', 'Site', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-BO-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// Given a doctor orders an X-ray of the left knee picked on the body, Then
/// the order keeps the code and the side — wrong-side imaging starts as an
/// ambiguous body-part field.
#[tokio::test]
async fn a_radiology_order_keeps_the_picked_body_part() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let modality: Uuid = sqlx::query_scalar(
        "SELECT m.id FROM radiology_modalities m JOIN users u ON u.tenant_id = m.tenant_id \
          WHERE u.username = 'admin' AND m.is_active AND m.deleted_at IS NULL LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("modality");

    let (status, order) = send(
        &csrf,
        app.client
            .post(app.url("/api/radiology/orders"))
            .json(&json!({
                "patient_id": patient(&app).await,
                "modality_id": modality,
                "body_part": "Left knee joint",
                "body_part_code": "FMA24978",
                "body_part_laterality": "left",
            })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{order}");
    let order = order.get("order").unwrap_or(&order);
    assert_eq!(order["body_part_code"], "FMA24978");
    assert_eq!(order["body_part_laterality"], "left");
}

/// Given a surgery booked on the right knee picked on the body, Then the
/// booking carries the site and the side into site marking; an unknown side
/// is refused.
#[tokio::test]
async fn an_ot_booking_carries_the_surgical_site_and_side() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (room, surgeon): (Uuid, Uuid) = sqlx::query_as(
        "SELECT r.id, d.id FROM ot_rooms r \
           JOIN users d ON d.tenant_id = r.tenant_id AND d.role = 'doctor' AND d.is_active \
                       AND d.deleted_at IS NULL \
           JOIN users a ON a.tenant_id = r.tenant_id AND a.username = 'admin' \
          WHERE r.deleted_at IS NULL LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("room and surgeon");
    let booking = |laterality: &str| {
        json!({
            "patient_id": Uuid::nil(),
            "ot_room_id": room,
            "primary_surgeon_id": surgeon,
            "scheduled_date": "2031-01-15",
            "scheduled_start": "2031-01-15T09:00:00Z",
            "scheduled_end": "2031-01-15T11:00:00Z",
            "procedure_name": "Arthroscopy",
            "surgical_site": "Right knee joint",
            "surgical_site_code": "FMA24977",
            "laterality": laterality,
            "credential_override_reason": "test fixture",
        })
    };
    let mut ok = booking("right");
    ok["patient_id"] = json!(patient(&app).await);

    let (status, row) = send(
        &csrf,
        app.client.post(app.url("/api/ot/bookings")).json(&ok),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{row}");
    assert_eq!(row["surgical_site"], "Right knee joint");
    assert_eq!(row["surgical_site_code"], "FMA24977");
    assert_eq!(row["laterality"], "right");

    let (status, _) = send(
        &csrf,
        app.client
            .post(app.url("/api/ot/bookings"))
            .json(&booking("upper")),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "an unknown side is refused"
    );
}
