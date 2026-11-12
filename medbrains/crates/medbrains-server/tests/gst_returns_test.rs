//! A GST return summary is prepared from the month's issued invoices and, once filed, is the
//! record of what the hospital declared. Re-preparing a filed month would rewrite that record.

use crate::common::{self, Staff, TestApp};

use reqwest::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A month in the 1900s no other test issues invoices in, as `YYYY-MM`.
fn quiet_month() -> String {
    let n = Uuid::new_v4().as_u128() % 1200;
    format!("{}-{:02}", 1900 + n / 12, n % 12 + 1)
}

/// Issue an invoice in `month` with a ₹1,000 taxable value and ₹90 CGST + ₹90 SGST.
async fn issue(app: &TestApp, month: &str) -> R<()> {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Gst', 'Patient', 'male'::gender, '9000001441') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-GST-{tag}"))
    .fetch_one(&app.db)
    .await?;
    sqlx::query(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, subtotal, \
                cgst_amount, sgst_amount, tax_amount, total_amount, issued_at) \
         VALUES ($1, $2, $3, 'issued'::invoice_status, 1000, 90, 90, 180, 1180, \
                 ($4 || '-15 10:00')::timestamp AT TIME ZONE 'UTC')",
    )
    .bind(tenant)
    .bind(format!("INV-GST-{tag}"))
    .bind(patient)
    .bind(month)
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

/// The stored summary's status, taxable value and invoice count.
async fn summary(app: &TestApp, id: &str) -> R<(String, Decimal, i32)> {
    Ok(sqlx::query_as(
        "SELECT filing_status::text, total_taxable, invoice_count \
           FROM gst_return_summaries WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await?)
}

/// Given two invoices issued in a month, When the accounts clerk prepares GSTR-1, Then the draft
/// carries ₹2,000 taxable from 2 invoices; When it is filed and a third invoice is then issued
/// in that month, Then preparing it again is refused 409 and the filed figures stay ₹2,000 from
/// 2; and filing it a second time is refused 409.
#[tokio::test]
async fn a_filed_return_is_never_recomputed() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let month = quiet_month();
    issue(&app, &month).await?;
    issue(&app, &month).await?;
    let body = json!({ "return_type": "GSTR-1", "period": month });

    let (status, draft) = post(&app, &clerk, "/api/billing/gst-returns/generate", &body).await?;
    assert_eq!(status, StatusCode::OK, "{draft}");
    let id = draft["id"].as_str().ok_or("id")?.to_owned();
    let filed_figures = ("draft".to_owned(), Decimal::new(2000, 0), 2);
    assert_eq!(summary(&app, &id).await?, filed_figures);

    let file = format!("/api/billing/gst-returns/{id}/file");
    let (status, _) = post(&app, &clerk, &file, &json!({})).await?;
    assert_eq!(status, StatusCode::OK);

    issue(&app, &month).await?;
    let (status, answer) = post(&app, &clerk, "/api/billing/gst-returns/generate", &body).await?;
    assert_eq!(status, StatusCode::CONFLICT, "{answer}");
    assert_eq!(
        summary(&app, &id).await?,
        ("filed".to_owned(), Decimal::new(2000, 0), 2)
    );

    let (status, _) = post(&app, &clerk, &file, &json!({})).await?;
    assert_eq!(status, StatusCode::CONFLICT, "filing is once");
    let (status, _) = post(
        &app,
        &clerk,
        &format!("/api/billing/gst-returns/{}/file", Uuid::new_v4()),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::NOT_FOUND);
    Ok(())
}

/// Given a draft not yet filed, When an invoice is added and it is prepared again, Then the
/// draft is recomputed (₹1,000 → ₹2,000); When the request is GSTR-2B, a month that does not
/// exist, or comes from a receptionist, Then 400, 400 and 403 and no summary is stored for it.
#[tokio::test]
async fn a_draft_is_recomputed_and_only_real_returns_are_prepared() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let month = quiet_month();
    let path = "/api/billing/gst-returns/generate";
    issue(&app, &month).await?;
    let body = json!({ "return_type": "GSTR-3B", "period": month });
    let (status, draft) = post(&app, &clerk, path, &body).await?;
    assert_eq!(status, StatusCode::OK, "{draft}");
    let id = draft["id"].as_str().ok_or("id")?.to_owned();
    issue(&app, &month).await?;
    let (status, _) = post(&app, &clerk, path, &body).await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        summary(&app, &id).await?,
        ("draft".to_owned(), Decimal::new(2000, 0), 2)
    );

    let refused = [
        (
            &clerk,
            json!({ "return_type": "GSTR-2B", "period": month }),
            StatusCode::BAD_REQUEST,
        ),
        (
            &clerk,
            json!({ "return_type": "GSTR-1", "period": "1999-13" }),
            StatusCode::BAD_REQUEST,
        ),
        (
            &clerk,
            json!({ "return_type": "GSTR-1", "period": "March" }),
            StatusCode::BAD_REQUEST,
        ),
        (
            &desk,
            json!({ "return_type": "GSTR-1", "period": month }),
            StatusCode::FORBIDDEN,
        ),
    ];
    for (who, body, want) in refused {
        let (status, answer) = post(&app, who, path, &body).await?;
        assert_eq!(status, want, "{body}: {answer}");
    }
    let stored: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM gst_return_summaries WHERE period = $1 AND return_type <> 'GSTR-3B'",
    )
    .bind(&month)
    .fetch_one(&app.db)
    .await?;
    assert_eq!(stored, 0);
    Ok(())
}
