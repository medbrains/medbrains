//! Bank reconciliation ties each line of the hospital's bank statement to the receipt or refund
//! behind it. A line is matched once, a receipt backs one line, and a line whose amount differs
//! from its receipt is held for review rather than called reconciled.

use crate::common::{self, Staff, TestApp};

use chrono::{Duration, NaiveDate};
use reqwest::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A day in the 1960s no other test's payments or statement lines land on.
fn quiet_day() -> NaiveDate {
    let offset = i64::try_from(Uuid::new_v4().as_u128() % 3000).unwrap_or(0);
    NaiveDate::from_ymd_opt(1962, 1, 1).unwrap_or_default() + Duration::days(offset)
}

/// An amount in paise no other test uses, so auto-reconcile can only pair this test's rows.
fn odd_amount() -> Decimal {
    let paise = i64::try_from(Uuid::new_v4().as_u128() % 9_000_000).unwrap_or(0) + 1_000_001;
    Decimal::new(paise, 2)
}

/// The hospital's tenant, and a fresh issued bill to hang receipts on.
async fn bill(app: &TestApp) -> R<(Uuid, Uuid)> {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Recon', 'Patient', 'female'::gender, '9000001331') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-BR-{tag}"))
    .fetch_one(&app.db)
    .await?;
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, total_amount, status) \
         VALUES ($1, $2, $3, 100000, 'issued'::invoice_status) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-BR-{tag}"))
    .bind(patient)
    .fetch_one(&app.db)
    .await?;
    Ok((tenant, invoice))
}

/// A completed card receipt of `amount` taken at noon on `day`.
async fn receipt(app: &TestApp, day: NaiveDate, amount: Decimal) -> R<Uuid> {
    let (tenant, invoice) = bill(app).await?;
    Ok(sqlx::query_scalar(
        "INSERT INTO payments (tenant_id, invoice_id, amount, mode, paid_at) \
         VALUES ($1, $2, $3, 'card'::payment_mode, ($4::date + time '12:00') AT TIME ZONE 'UTC') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(amount)
    .bind(day)
    .fetch_one(&app.db)
    .await?)
}

/// A refund of `amount` paid back on a fresh bill.
async fn refund(app: &TestApp, amount: Decimal) -> R<Uuid> {
    let (tenant, invoice) = bill(app).await?;
    Ok(sqlx::query_scalar(
        "INSERT INTO refunds (tenant_id, invoice_id, refund_number, amount, reason, mode) \
         VALUES ($1, $2, $3, $4, 'Overpaid', 'upi'::payment_mode) RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(format!(
        "RF-BR-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .bind(amount)
    .fetch_one(&app.db)
    .await?)
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

/// A statement line for `day`: money in when `credit`, else money out.
fn line(day: NaiveDate, amount: Decimal, credit: bool) -> Value {
    let (debit, credit) = if credit {
        (Decimal::ZERO, amount)
    } else {
        (amount, Decimal::ZERO)
    };
    json!({ "bank_name": "Test Bank", "account_number": "000111", "transaction_date": day,
            "debit_amount": debit.to_string(), "credit_amount": credit.to_string() })
}

/// Import `lines` as batch `batch` as `clerk`; the ids of the lines it created, in order.
async fn import(app: &TestApp, clerk: &Staff, batch: &str, lines: Vec<Value>) -> R<Vec<Uuid>> {
    let body = json!({ "import_batch": batch, "transactions": lines });
    let (status, answer) = post(app, clerk, "/api/billing/bank-transactions/import", &body).await?;
    assert_eq!(status, StatusCode::OK, "{answer}");
    Ok(sqlx::query_scalar(
        "SELECT id FROM bank_transactions WHERE import_batch = $1 ORDER BY credit_amount DESC, id",
    )
    .bind(batch)
    .fetch_all(&app.db)
    .await?)
}

/// A line's reconciliation state: status, matched payment, matched refund, variance.
async fn state(
    app: &TestApp,
    id: Uuid,
) -> R<(String, Option<Uuid>, Option<Uuid>, Option<Decimal>)> {
    Ok(sqlx::query_as(
        "SELECT recon_status::text, matched_payment_id, matched_refund_id, variance_amount \
           FROM bank_transactions WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&app.db)
    .await?)
}

/// A fresh, unique import batch name.
fn batch() -> String {
    format!("BR-{}", Uuid::new_v4().simple())
}

/// Given a statement, When it is empty, or a line has both a debit and a credit, neither, or a
/// negative amount, Then the import is refused and nothing of it is stored; When the lines are
/// one-sided, Then each is stored unmatched. A receptionist cannot import at all.
#[tokio::test]
async fn a_statement_line_is_money_in_or_money_out() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let day = quiet_day();
    let path = "/api/billing/bank-transactions/import";
    let both = json!({ "bank_name": "B", "account_number": "1", "transaction_date": day,
                       "debit_amount": "10", "credit_amount": "10" });
    let neither = json!({ "bank_name": "B", "account_number": "1", "transaction_date": day,
                          "debit_amount": "0", "credit_amount": "0" });
    let negative = json!({ "bank_name": "B", "account_number": "1", "transaction_date": day,
                           "debit_amount": "0", "credit_amount": "-5" });
    let name = batch();
    for lines in [
        vec![],
        vec![line(day, odd_amount(), true), both],
        vec![neither],
        vec![negative],
    ] {
        let body = json!({ "import_batch": name, "transactions": lines });
        let (status, answer) = post(&app, &clerk, path, &body).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{answer}");
    }
    let stored: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM bank_transactions WHERE import_batch = $1")
            .bind(&name)
            .fetch_one(&app.db)
            .await?;
    assert_eq!(stored, 0, "a refused statement stores none of its lines");

    let body = json!({ "import_batch": batch(), "transactions": [line(day, odd_amount(), true)] });
    let (status, _) = post(&app, &desk, path, &body).await?;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let ids = import(
        &app,
        &clerk,
        &name,
        vec![
            line(day, odd_amount(), true),
            line(day, odd_amount(), false),
        ],
    )
    .await?;
    assert_eq!(ids.len(), 2);
    for id in ids {
        assert_eq!(state(&app, id).await?.0, "unmatched");
    }
    Ok(())
}

/// Given two equal credits on one day and a single receipt of that amount, When auto-reconcile
/// runs, Then exactly one line is matched to the receipt and the other stays unmatched; When it
/// runs again, Then the receipt is not claimed a second time.
#[tokio::test]
async fn auto_reconcile_never_pairs_one_receipt_with_two_lines() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let (day, amount) = (quiet_day(), odd_amount());
    let pay = receipt(&app, day, amount).await?;
    let ids = import(
        &app,
        &clerk,
        &batch(),
        vec![line(day, amount, true), line(day, amount, true)],
    )
    .await?;
    let path = "/api/billing/bank-transactions/auto-reconcile";

    for run in 0..2 {
        let (status, answer) = post(&app, &clerk, path, &json!({})).await?;
        assert_eq!(status, StatusCode::OK, "{answer}");
        let mut states = Vec::new();
        for id in &ids {
            states.push(state(&app, *id).await?);
        }
        let matched: Vec<_> = states.iter().filter(|s| s.0 == "matched").collect();
        assert_eq!(matched.len(), 1, "run {run}: {states:?}");
        assert_eq!(matched[0].1, Some(pay));
        assert_eq!(matched[0].3, Some(Decimal::ZERO));
        assert!(states.iter().any(|s| s.0 == "unmatched" && s.1.is_none()));
    }
    Ok(())
}

/// Given a ₹X credit and a ₹X receipt, When the clerk matches them by hand, Then the line is
/// matched with no variance; When the line is matched again, or another credit is matched to the
/// same receipt, Then 409; When a receipt is matched to a debit line, both a payment and a refund
/// are named, or the line does not exist, Then 400/400/404. A credit ₹15 short of its receipt is
/// held as a discrepancy with that variance, and a refund matches a debit line.
#[tokio::test]
async fn a_manual_match_is_one_line_to_one_receipt() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let (day, amount) = (quiet_day(), odd_amount());
    let pay = receipt(&app, day, amount).await?;
    let short_pay = receipt(&app, day, amount).await?;
    let back = refund(&app, amount).await?;
    let short = amount - Decimal::new(15, 0);
    // A reference no receipt carries keeps a parallel auto-reconcile run off these lines.
    let fenced = |mut l: Value| {
        l["reference_number"] = json!(format!("HAND-{}", Uuid::new_v4().simple()));
        l
    };
    let ids = import(
        &app,
        &clerk,
        &batch(),
        vec![
            fenced(line(day, amount, true)),
            fenced(line(day, amount, true)),
            fenced(line(day, short, true)),
            fenced(line(day, amount, false)),
        ],
    )
    .await?;
    let (credit, twin, short_line, debit) = (ids[0], ids[1], ids[2], ids[3]);
    let to = |id: Uuid| format!("/api/billing/bank-transactions/{id}/match");

    let (status, _) = post(&app, &clerk, &to(credit), &json!({ "payment_id": pay })).await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        state(&app, credit).await?,
        ("matched".to_owned(), Some(pay), None, Some(Decimal::ZERO))
    );

    let refused = [
        (
            to(credit),
            json!({ "payment_id": short_pay }),
            StatusCode::CONFLICT,
        ),
        (to(twin), json!({ "payment_id": pay }), StatusCode::CONFLICT),
        (
            to(debit),
            json!({ "payment_id": short_pay }),
            StatusCode::BAD_REQUEST,
        ),
        (
            to(twin),
            json!({ "payment_id": short_pay, "refund_id": back }),
            StatusCode::BAD_REQUEST,
        ),
        (to(twin), json!({}), StatusCode::BAD_REQUEST),
        (
            to(twin),
            json!({ "payment_id": Uuid::new_v4() }),
            StatusCode::BAD_REQUEST,
        ),
        (
            to(Uuid::new_v4()),
            json!({ "payment_id": short_pay }),
            StatusCode::NOT_FOUND,
        ),
    ];
    for (path, body, want) in refused {
        let (status, answer) = post(&app, &clerk, &path, &body).await?;
        assert_eq!(status, want, "{path} {body}: {answer}");
    }
    assert_eq!(state(&app, twin).await?.0, "unmatched");
    assert_eq!(state(&app, debit).await?.0, "unmatched");
    assert_eq!(
        state(&app, credit).await?.1,
        Some(pay),
        "the first match stands"
    );

    let (status, _) = post(
        &app,
        &clerk,
        &to(short_line),
        &json!({ "payment_id": short_pay }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        state(&app, short_line).await?,
        (
            "discrepancy".to_owned(),
            Some(short_pay),
            None,
            Some(Decimal::new(-15, 0))
        )
    );

    let (status, _) = post(&app, &clerk, &to(debit), &json!({ "refund_id": back })).await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        state(&app, debit).await?,
        ("matched".to_owned(), None, Some(back), Some(Decimal::ZERO))
    );
    Ok(())
}
