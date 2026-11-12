//! A pharmacy day settlement is closed by one person and checked by another, once.

use crate::common::{self, Staff, TestApp};

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A day in the 1960s no other test's settlement lands on (settlements are tenant-wide per day).
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 3600).unwrap_or(0);
    NaiveDate::from_ymd_opt(1960, 1, 1).unwrap_or_default() + Duration::days(offset)
}

/// Send `body` with `method` to `path` as `staff`; the status and JSON answer.
async fn send(
    app: &TestApp,
    staff: &Staff,
    method: reqwest::Method,
    path: &str,
    body: &Value,
) -> R<(StatusCode, Value)> {
    let res = staff
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", &staff.csrf)
        .json(body)
        .send()
        .await?;
    let status = res.status();
    Ok((status, res.json().await.unwrap_or(Value::Null)))
}

/// Given a closed settlement, When the person who closed it verifies it, Then 409 and nothing
/// changes; When someone else verifies it, Then it is verified; and again, Then 409.
#[tokio::test]
async fn the_closer_cannot_verify_their_own_settlement() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let closer = common::provision_staff(&app, &csrf, "pharmacist", &[]).await;
    let checker = common::provision_staff(&app, &csrf, "pharmacist", &[]).await;

    let (status, settlement) = send(
        &app,
        &closer,
        reqwest::Method::GET,
        &format!("/api/pharmacy/settlements?date={}", quiet_day()),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{settlement}");
    let id = settlement["id"].as_str().ok_or("id")?.to_owned();
    let (status, closed) = send(
        &app,
        &closer,
        reqwest::Method::PUT,
        &format!("/api/pharmacy/settlements/{id}/close"),
        &json!({ "cash_counted": "0" }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{closed}");

    let verify = format!("/api/pharmacy/settlements/{id}/verify");
    let (status, _) = send(&app, &closer, reqwest::Method::PUT, &verify, &json!({})).await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the closer cannot sign off their own count"
    );
    let untouched: (String, Option<Uuid>) = sqlx::query_as(
        "SELECT status, verified_by FROM pharmacy_day_settlements WHERE id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await?;
    assert_eq!(untouched, ("closed".to_owned(), None));

    let (status, verified) =
        send(&app, &checker, reqwest::Method::PUT, &verify, &json!({})).await?;
    assert_eq!(status, StatusCode::OK, "{verified}");
    assert_eq!(verified["status"], "verified");
    let (status, _) = send(&app, &checker, reqwest::Method::PUT, &verify, &json!({})).await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a verified settlement is not verified again"
    );
    Ok(())
}
