//! The hospital's marks: every staff role reads the emblem and name banner for
//! the header; only the branding manager saves them; and the patient card's
//! print data carries both.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};

/// A generated 1×1 PNG: a test image, never a real hospital's logo.
const PIXEL: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/// PUT one branding key as `client`: the status.
async fn save(
    client: &reqwest::Client,
    app: &common::TestApp,
    csrf: &str,
    key: &str,
    value: &str,
) -> StatusCode {
    client
        .put(app.url("/api/setup/branding"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "key": key, "value": value }))
        .send()
        .await
        .expect("save branding")
        .status()
}

/// Given an admin saved an emblem and a name banner, When a nurse opens any
/// screen, Then the header's read answers both with a cache validator and a
/// repeat read is a bodiless 304; the nurse cannot save branding; an SVG or a
/// text data URL is refused; a nurse denied `branding.view` reads nothing; and
/// the patient card's print data carries both marks.
#[tokio::test]
async fn every_staff_role_sees_the_marks_only_the_manager_saves_them() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    assert_eq!(
        save(&app.client, &app, &csrf, "logo_url", PIXEL).await,
        StatusCode::OK
    );
    assert_eq!(
        save(&app.client, &app, &csrf, "name_banner_url", PIXEL).await,
        StatusCode::OK
    );
    for refused in [
        "data:image/svg+xml;base64,PHN2Zy8+",
        "data:text/html;base64,PGI+",
    ] {
        let status = save(&app.client, &app, &csrf, "logo_url", refused).await;
        assert!(status.is_client_error(), "{refused}: {status}");
    }

    let nurse = common::provision_staff(&app, &csrf, "nurse", &[]).await;
    let resp = nurse
        .client
        .get(app.url("/api/branding/marks"))
        .send()
        .await
        .expect("marks");
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(resp.headers()["cache-control"], "private, max-age=300");
    let etag = resp.headers()["etag"].clone();
    let marks: Value = resp.json().await.expect("marks json");
    assert_eq!(marks["emblem"], PIXEL);
    assert_eq!(marks["name_banner"], PIXEL);
    assert_eq!(
        marks.as_object().map(|m| m.len()),
        Some(3),
        "only the three marks"
    );
    let again = nurse
        .client
        .get(app.url("/api/branding/marks"))
        .header("if-none-match", etag)
        .send()
        .await
        .expect("marks again");
    assert_eq!(again.status(), StatusCode::NOT_MODIFIED);

    assert_eq!(
        save(&nurse.client, &app, &nurse.csrf, "logo_url", PIXEL).await,
        StatusCode::FORBIDDEN,
        "a nurse does not save branding"
    );
    let denied = common::provision_staff(&app, &csrf, "nurse", &["branding.view"]).await;
    let status = denied
        .client
        .get(app.url("/api/branding/marks"))
        .send()
        .await
        .expect("denied")
        .status();
    assert_eq!(status, StatusCode::FORBIDDEN);

    let phone = format!("9{}", &uuid::Uuid::new_v4().as_u128().to_string()[..9]);
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "first_name": "Mark", "last_name": "Test", "gender": "female", "date_of_birth": "1992-03-04", "phone": phone, "address": { "line1": "1 Test Street", "city": "Testville" } }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("patient");
    let id = patient["id"].as_str().expect("patient id");
    for path in [
        format!("/api/print-data/patient-card/{id}"),
        format!("/api/print-data/opd-card/{id}"),
    ] {
        let card: Value = app
            .client
            .get(app.url(&path))
            .send()
            .await
            .expect("card")
            .json()
            .await
            .expect("card json");
        assert_eq!(card["hospital_logo_url"], PIXEL, "{path}");
        assert_eq!(card["hospital_name_banner_url"], PIXEL, "{path}");
    }
}
