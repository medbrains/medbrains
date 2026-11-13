//! Tax deducted at source moves deducted → deposited (challan) → certificate issued (Form 16A),
//! and each deduction is reported in the quarter its date falls in. A wrong PAN, quarter or order
//! of steps would misstate the TDS return the hospital files.

use crate::common::{self, Staff, TestApp};

use reqwest::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// POST `body` to `path` as `staff`; the status and JSON answer (Null when not JSON).
async fn post(app: &TestApp, staff: &Staff, path: &str, body: &Value) -> R<(StatusCode, Value)> {
    let res = staff
        .client
        .post(app.url(path))
        .header("x-csrf-token", &staff.csrf)
        .json(body)
        .send()
        .await?;
    let status = res.status();
    Ok((status, res.json().await.unwrap_or(Value::Null)))
}

/// A deduction under 194J on ₹10,000 at 10% on 12 Nov 2026, with `changes` applied over it.
fn deduction(changes: &Value) -> Value {
    let mut body = json!({
        "deductee_name": "Dr Visiting Consultant", "deductee_pan": "abcde1234f",
        "tds_section": "194J", "tds_rate": "10", "base_amount": "10000",
        "deducted_date": "2026-11-12", "financial_year": "2026-27", "quarter": "Q3",
    });
    if let (Some(base), Some(over)) = (body.as_object_mut(), changes.as_object()) {
        for (k, v) in over {
            base.insert(k.clone(), v.clone());
        }
    }
    body
}

/// The stored deduction's status, PAN, TDS amount and challan number.
async fn row(app: &TestApp, id: &str) -> R<(String, String, Decimal, Option<String>)> {
    Ok(sqlx::query_as(
        "SELECT status::text, deductee_pan, tds_amount, challan_number \
           FROM tds_deductions WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await?)
}

/// Given a consultant's fee, When the accounts clerk records the deduction with a lower-case
/// PAN, Then it is stored with the PAN upper-cased and ₹1,000 TDS; When it is given a
/// certificate before deposit, Then 409; When the challan predates the deduction, Then 400;
/// When deposited, then certified, Then each step is recorded once and repeating either is 409.
#[tokio::test]
async fn a_deduction_is_deposited_before_it_is_certified() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let (status, created) = post(&app, &clerk, "/api/billing/tds", &deduction(&json!({}))).await?;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["id"].as_str().ok_or("id")?.to_owned();
    assert_eq!(
        row(&app, &id).await?,
        (
            "deducted".to_owned(),
            "ABCDE1234F".to_owned(),
            Decimal::new(1000, 0),
            None
        )
    );

    let certify = format!("/api/billing/tds/{id}/certificate");
    let deposit = format!("/api/billing/tds/{id}/deposit");
    let cert = json!({ "certificate_number": "16A-1", "certificate_date": "2026-12-20" });
    let (status, _) = post(&app, &clerk, &certify, &cert).await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "no certificate before deposit"
    );
    let early = json!({ "challan_number": "CH-0", "challan_date": "2026-11-01" });
    let (status, _) = post(&app, &clerk, &deposit, &early).await?;
    assert_eq!(status, StatusCode::BAD_REQUEST, "deposit before deduction");
    let blank = json!({ "challan_number": "  ", "challan_date": "2026-12-05" });
    let (status, _) = post(&app, &clerk, &deposit, &blank).await?;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(row(&app, &id).await?.0, "deducted");

    let challan = json!({ "challan_number": "CH-1", "challan_date": "2026-12-05" });
    let (status, _) = post(&app, &clerk, &deposit, &challan).await?;
    assert_eq!(status, StatusCode::OK);
    let again = json!({ "challan_number": "CH-2", "challan_date": "2026-12-06" });
    let (status, _) = post(&app, &clerk, &deposit, &again).await?;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(
        row(&app, &id).await?.3.as_deref(),
        Some("CH-1"),
        "the challan stands"
    );

    let (status, _) = post(&app, &clerk, &certify, &cert).await?;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = post(&app, &clerk, &certify, &cert).await?;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(row(&app, &id).await?.0, "certificate_issued");

    let missing = format!("/api/billing/tds/{}/deposit", Uuid::new_v4());
    let (status, _) = post(&app, &clerk, &missing, &challan).await?;
    assert_eq!(status, StatusCode::NOT_FOUND);
    Ok(())
}

/// Given a deduction, When its PAN is malformed, its amount or rate is not positive, its rate is
/// over 100%, or its quarter or financial year is not the one its date falls in, Then it is
/// refused 400 and nothing is stored; a receptionist is refused 403.
#[tokio::test]
async fn a_deduction_that_would_misstate_the_return_is_refused() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let name = format!("Refused {}", Uuid::new_v4().simple());
    let bad = [
        json!({ "deductee_pan": "ABCDE1234" }),
        json!({ "deductee_pan": "1BCDE1234F" }),
        json!({ "base_amount": "0" }),
        json!({ "tds_rate": "0" }),
        json!({ "tds_rate": "101" }),
        json!({ "quarter": "Q4" }),
        json!({ "financial_year": "2025-26" }),
        json!({ "deducted_date": "2027-01-10" }),
        json!({ "deductee_name": "  " }),
    ];
    for change in bad {
        let mut body = deduction(&change);
        if change.get("deductee_name").is_none() {
            body["deductee_name"] = json!(name);
        }
        let (status, answer) = post(&app, &clerk, "/api/billing/tds", &body).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{change}: {answer}");
    }
    let mut body = deduction(&json!({}));
    body["deductee_name"] = json!(name);
    let (status, _) = post(&app, &desk, "/api/billing/tds", &body).await?;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let stored: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM tds_deductions WHERE deductee_name = $1")
            .bind(&name)
            .fetch_one(&app.db)
            .await?;
    assert_eq!(stored, 0);

    let q4 = deduction(&json!({ "deducted_date": "2027-01-10", "quarter": "Q4" }));
    let (status, answer) = post(&app, &clerk, "/api/billing/tds", &q4).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "January is Q4 of the year that began in April: {answer}"
    );
    Ok(())
}
