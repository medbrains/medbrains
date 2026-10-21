//! Injuries on a medico-legal case: site picked on the body, type, size and
//! the doctor's opinion of their nature — appended, never edited.

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

async fn mlc_case(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Assault', 'Case', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-MI-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let (status, case) = send(
        csrf,
        app.client
            .post(app.url("/api/emergency/mlc"))
            .json(&json!({ "patient_id": patient, "case_type": "assault" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{case}");
    case["id"].as_str().expect("mlc id").to_owned()
}

/// Given an assault case, When the doctor records a laceration on the left
/// forearm, Then it is listed with its code, side, size and nature; an
/// unknown injury type or an empty site is refused.
#[tokio::test]
async fn an_injury_is_recorded_on_the_case_by_site() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let url = app.url(&format!(
        "/api/emergency/mlc/{}/injuries",
        mlc_case(&app, &csrf).await
    ));
    let injury = |site: &str, kind: &str| {
        json!({
            "body_site": site,
            "body_site_code": "FMA9663",
            "body_site_laterality": "left",
            "injury_type": kind,
            "length_cm": 4.5,
            "width_cm": 0.5,
            "nature": "simple",
            "description": "Clean margins",
        })
    };

    let (status, _) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&injury("Left forearm", "scratch")),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "an unknown type is refused"
    );
    let (status, _) = send(
        &csrf,
        app.client.post(&url).json(&injury("  ", "laceration")),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "an injury needs a site"
    );

    let (status, recorded) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&injury("Left forearm", "laceration")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{recorded}");

    let (status, list) = send(&csrf, app.client.get(&url)).await;
    assert_eq!(status, StatusCode::OK, "{list}");
    let rows = list.as_array().expect("list");
    assert_eq!(rows.len(), 1);
    let row = &rows[0];
    assert_eq!(row["body_site"], "Left forearm");
    assert_eq!(row["body_site_code"], "FMA9663");
    assert_eq!(row["body_site_laterality"], "left");
    assert_eq!(row["injury_type"], "laceration");
    assert_eq!(row["nature"], "simple");
    assert_eq!(row["injury_number"], 1);
    assert_eq!(
        row["size_cm"], "4.5 × 0.5 cm",
        "the size as the certificate prints it"
    );

    // The next injury on the same case is number 2.
    let (_, second) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&injury("Right shin", "contusion")),
    )
    .await;
    assert_eq!(second["injury_number"], 2, "{second}");
}
