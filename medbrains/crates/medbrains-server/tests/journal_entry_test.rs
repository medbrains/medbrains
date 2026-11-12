//! Manual journal entries move money between ledger accounts. An entry is accepted only when
//! every line moves money one way by a positive amount and the two sides balance; a posted
//! entry is undone by a reversing entry, never edited.

use crate::common::{self, Staff, TestApp};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// Two fresh GL accounts of this tenant: a cash asset and a revenue account.
async fn accounts(app: &TestApp) -> R<(Uuid, Uuid)> {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let mut ids = Vec::new();
    for (kind, name) in [("asset", "Cash"), ("revenue", "OPD revenue")] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO gl_accounts (tenant_id, code, name, account_type) \
             VALUES ($1, $2, $3, $4) RETURNING id",
        )
        .bind(tenant)
        .bind(format!("{tag}-{kind}"))
        .bind(name)
        .bind(kind)
        .fetch_one(&app.db)
        .await?;
        ids.push(id);
    }
    Ok((ids[0], ids[1]))
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

/// An entry with these `(account, debit, credit)` lines.
fn entry(lines: &[(Uuid, i64, i64)]) -> Value {
    json!({
        "entry_date": "2026-11-12",
        "description": "Cash takings",
        "lines": lines.iter().map(|(a, dr, cr)| json!({
            "account_id": a, "debit_amount": dr.to_string(), "credit_amount": cr.to_string(),
        })).collect::<Vec<_>>(),
    })
}

/// A JSON money string as whole rupees, compared by value.
fn rupees(value: &Value) -> R<i64> {
    let amount: rust_decimal::Decimal = value.as_str().ok_or("money is a string")?.parse()?;
    Ok(amount.trunc().to_string().parse()?)
}

/// Given ₹1,000 of cash takings, When the accountant records Dr Cash / Cr Revenue, posts it and
/// later reverses it, Then the reversal is a new posted entry with the sides swapped, and the
/// original reads as reversed. A draft cannot be reversed, and a posted entry cannot be posted
/// twice.
#[tokio::test]
async fn an_entry_is_recorded_posted_and_undone_by_a_reversal() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let books = [
        "billing.journal.list",
        "billing.journal.create",
        "billing.journal.post",
    ];
    let accountant = common::provision_staff_with(&app, &csrf, "billing_clerk", &books, &[]).await;
    let (cash, revenue) = accounts(&app).await?;

    let (status, created) = post(
        &app,
        &accountant,
        "/api/billing/journal-entries",
        &entry(&[(cash, 1000, 0), (revenue, 0, 1000)]),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{created}");
    assert_eq!(created["entry"]["status"], "draft");
    let id = created["entry"]["id"].as_str().ok_or("id")?.to_owned();

    let (status, _) = post(
        &app,
        &accountant,
        &format!("/api/billing/journal-entries/{id}/reverse"),
        &json!({}),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a draft has nothing to reverse"
    );

    let (status, posted) = post(
        &app,
        &accountant,
        &format!("/api/billing/journal-entries/{id}/post"),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{posted}");
    assert_eq!(posted["status"], "posted");
    let (status, _) = post(
        &app,
        &accountant,
        &format!("/api/billing/journal-entries/{id}/post"),
        &json!({}),
    )
    .await?;
    assert_ne!(status, StatusCode::OK, "a posted entry is not posted again");

    let (status, reversal) = post(
        &app,
        &accountant,
        &format!("/api/billing/journal-entries/{id}/reverse"),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{reversal}");
    assert_eq!(reversal["entry"]["status"], "posted");
    assert_eq!(reversal["entry"]["reversal_of_id"], id.as_str());
    let lines = reversal["lines"].as_array().ok_or("lines")?;
    let cash_line = lines
        .iter()
        .find(|l| l["account_id"] == cash.to_string())
        .ok_or("cash line")?;
    assert_eq!(
        (
            rupees(&cash_line["debit_amount"])?,
            rupees(&cash_line["credit_amount"])?
        ),
        (0, 1000),
        "cash is credited back"
    );
    let original: String =
        sqlx::query_scalar("SELECT status::text FROM journal_entries WHERE id = $1::uuid")
            .bind(&id)
            .fetch_one(&app.db)
            .await?;
    assert_eq!(original, "reversed");
    Ok(())
}

/// Entries that balance but mean nothing, or do not balance, are refused before anything is
/// written; and posting needs its own permission.
#[tokio::test]
async fn entries_that_do_not_move_money_one_way_are_refused() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff_with(
        &app,
        &csrf,
        "billing_clerk",
        &["billing.journal.create"],
        &["billing.journal.post"],
    )
    .await;
    let (cash, revenue) = accounts(&app).await?;

    let refused = [
        (vec![(cash, 1000, 0), (revenue, 0, 900)], "unbalanced"),
        (vec![(cash, 0, 0), (revenue, 0, 0)], "all zero"),
        (vec![(cash, -500, 0), (revenue, 0, -500)], "negative"),
        (
            vec![(cash, 500, 500), (revenue, 0, 0)],
            "both sides on one line",
        ),
        (vec![(cash, 0, 0)], "one line"),
    ];
    for (lines, why) in refused {
        let (status, body) =
            post(&app, &clerk, "/api/billing/journal-entries", &entry(&lines)).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{why}: {body}");
    }
    let written: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entry_lines WHERE account_id = ANY($1)")
            .bind(vec![cash, revenue])
            .fetch_one(&app.db)
            .await?;
    assert_eq!(written, 0, "no refused entry left a line behind");

    let (status, created) = post(
        &app,
        &clerk,
        "/api/billing/journal-entries",
        &entry(&[(cash, 10, 0), (revenue, 0, 10)]),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["entry"]["id"].as_str().ok_or("id")?.to_owned();
    let (status, _) = post(
        &app,
        &clerk,
        &format!("/api/billing/journal-entries/{id}/post"),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::FORBIDDEN);
    Ok(())
}
