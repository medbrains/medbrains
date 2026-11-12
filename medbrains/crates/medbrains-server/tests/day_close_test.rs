//! A cashier's day close tallies what the system says was collected against what is in the
//! drawer, and someone else checks it. A variance is never signed off as balanced.

use crate::common::{self, Staff, TestApp};

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A day in the 1970s no other test's payments land on.
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 3000).unwrap_or(0);
    NaiveDate::from_ymd_opt(1972, 1, 1).unwrap_or_default() + Duration::days(offset)
}

/// Record, on `day` at counter `counter`, a ₹500 cash, ₹300 card and ₹200 UPI payment
/// against a fresh bill.
async fn takings(app: &TestApp, day: NaiveDate, counter: &str) -> R<()> {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Till', 'Patient', 'male'::gender, '9000001227') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-DC-{tag}"))
    .fetch_one(&app.db)
    .await?;
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, total_amount, status) \
         VALUES ($1, $2, $3, 1000, 'issued'::invoice_status) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-DC-{tag}"))
    .bind(patient)
    .fetch_one(&app.db)
    .await?;
    sqlx::query(
        "INSERT INTO payments (tenant_id, invoice_id, amount, mode, paid_at, counter_id) \
         SELECT $1, $2, a, m::payment_mode, ($3::date + time '11:00') AT TIME ZONE 'UTC', $4 \
           FROM (VALUES (500, 'cash'), (300, 'card'), (200, 'upi')) AS t(a, m)",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(day)
    .bind(counter)
    .execute(&app.db)
    .await?;
    Ok(())
}

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

/// A JSON money string as a whole number of rupees, compared by value.
fn rupees(value: &Value) -> R<i64> {
    let amount: rust_decimal::Decimal = value.as_str().ok_or("money is a string")?.parse()?;
    Ok(amount.trunc().to_string().parse()?)
}

/// Close counter `counter` on `day` as `cashier` with these drawer and settlement figures.
async fn close(
    app: &TestApp,
    cashier: &Staff,
    day: NaiveDate,
    counter: &str,
    cash: i64,
    card: i64,
    upi: i64,
) -> R<Value> {
    let (status, row) = post(
        app,
        cashier,
        "/api/billing/day-closes",
        &json!({
            "close_date": day, "counter_id": counter, "actual_cash": cash.to_string(),
            "actual_card": card.to_string(), "actual_upi": upi.to_string(),
        }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{row}");
    Ok(row)
}

/// Given a counter that took ₹500 cash, ₹300 card and ₹200 UPI, When the cashier closes with
/// exactly that in hand, Then the tally shows ₹1,000 collected and no variance, and a second
/// person's check signs it off as verified. The cashier cannot check their own close, and a
/// checked close cannot be checked again.
#[tokio::test]
async fn a_balanced_close_is_signed_off_by_someone_other_than_the_cashier() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cashier = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let supervisor = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let (day, counter) = (
        quiet_day(),
        format!("C-{}", &Uuid::new_v4().simple().to_string()[..8]),
    );
    takings(&app, day, &counter).await?;
    takings(&app, day, "SOMEONE-ELSES-COUNTER").await?;

    let row = close(&app, &cashier, day, &counter, 500, 300, 200).await?;
    assert_eq!(
        rupees(&row["expected_cash"])?,
        500,
        "only this counter's cash: {row}"
    );
    assert_eq!(rupees(&row["total_collected"])?, 1000);
    assert_eq!(row["payments_count"], 3);
    assert_eq!(rupees(&row["cash_difference"])?, 0);
    let verify = format!(
        "/api/billing/day-closes/{}/verify",
        row["id"].as_str().ok_or("id")?
    );

    let (status, _) = post(&app, &cashier, &verify, &json!({})).await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the cashier cannot sign off their own count"
    );

    let (status, checked) = post(
        &app,
        &supervisor,
        &verify,
        &json!({ "verification_notes": "Counted" }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{checked}");
    assert_eq!(checked["status"], "verified");

    let (status, _) = post(&app, &supervisor, &verify, &json!({})).await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a checked close is not checked again"
    );
    Ok(())
}

/// Given the same takings, When the drawer is ₹50 short or the card settlement does not match,
/// Then the variance is recorded and the check marks the close as a discrepancy, never verified.
#[tokio::test]
async fn a_short_drawer_or_unmatched_settlement_is_a_discrepancy() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cashier = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let supervisor = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    for (cash, card, label) in [(450, 300, "short cash"), (500, 250, "card settlement")] {
        let (day, counter) = (
            quiet_day(),
            format!("C-{}", &Uuid::new_v4().simple().to_string()[..8]),
        );
        takings(&app, day, &counter).await?;
        let row = close(&app, &cashier, day, &counter, cash, card, 200).await?;
        let verify = format!(
            "/api/billing/day-closes/{}/verify",
            row["id"].as_str().ok_or("id")?
        );
        let (status, checked) = post(&app, &supervisor, &verify, &json!({})).await?;
        assert_eq!(status, StatusCode::OK, "{label}: {checked}");
        assert_eq!(checked["status"], "discrepancy", "{label}");
    }
    Ok(())
}

/// Given a clerk without the verify permission, When they check a close, Then 403.
#[tokio::test]
async fn checking_a_close_needs_its_permission() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let cashier = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let junior =
        common::provision_staff(&app, &csrf, "billing_clerk", &["billing.day_close.verify"]).await;
    let (day, counter) = (
        quiet_day(),
        format!("C-{}", &Uuid::new_v4().simple().to_string()[..8]),
    );
    takings(&app, day, &counter).await?;
    let row = close(&app, &cashier, day, &counter, 500, 300, 200).await?;
    let verify = format!(
        "/api/billing/day-closes/{}/verify",
        row["id"].as_str().ok_or("id")?
    );
    let (status, _) = post(&app, &junior, &verify, &json!({})).await?;
    assert_eq!(status, StatusCode::FORBIDDEN);
    Ok(())
}
