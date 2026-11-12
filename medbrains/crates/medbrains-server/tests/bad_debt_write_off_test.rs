//! Bad-debt write-offs settle what a patient will never pay. One person proposes, another
//! decides, the amount never exceeds what is still owed, and the decider must be able to reach
//! that patient.

use crate::common::{self, Staff, TestApp};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A patient and their ₹1,000 bill.
struct Bill {
    tenant: Uuid,
    patient: Uuid,
    invoice: Uuid,
}

/// Seed a patient and a ₹1,000 bill in `status` with `paid` rupees already paid.
async fn bill(app: &TestApp, status: &str, paid: i64) -> R<Bill> {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'WriteOff', 'Patient', 'other'::gender, '9000001226') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-WO-{tag}"))
    .fetch_one(&app.db)
    .await?;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') \
         RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await?;
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, \
                               total_amount, paid_amount, status) \
         VALUES ($1, $2, $3, $4, 1000, $5, $6::invoice_status) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-WO-{tag}"))
    .bind(patient)
    .bind(encounter)
    .bind(rust_decimal::Decimal::from(paid))
    .bind(status)
    .fetch_one(&app.db)
    .await?;
    Ok(Bill {
        tenant,
        patient,
        invoice,
    })
}

/// Let `staff` reach the bill's patient.
async fn grant(app: &TestApp, b: &Bill, staff: &Staff) -> R<()> {
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'viewer', 'user', $3::text, $3)",
    )
    .bind(b.tenant)
    .bind(b.patient)
    .bind(staff.user_id)
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

/// Ask for a write-off of `amount` on `b`'s bill as `staff`.
async fn propose(
    app: &TestApp,
    staff: &Staff,
    b: &Bill,
    amount: &str,
    reason: &str,
) -> R<(StatusCode, Value)> {
    post(
        app,
        staff,
        "/api/billing/write-offs",
        &json!({ "invoice_id": b.invoice, "amount": amount, "reason": reason }),
    )
    .await
}

/// The bill's paid amount, written-off amount and status.
async fn state(app: &TestApp, invoice: Uuid) -> R<(String, String, String)> {
    Ok(sqlx::query_as(
        "SELECT paid_amount::text, written_off_amount::text, status::text FROM invoices WHERE id = $1",
    )
    .bind(invoice)
    .fetch_one(&app.db)
    .await?)
}

/// Two billing staff who may both propose and decide write-offs.
async fn two_deciders(app: &TestApp, csrf: &str) -> (Staff, Staff) {
    let both = ["billing.write_off.create", "billing.write_off.approve"];
    let a = common::provision_staff_with(app, csrf, "billing_clerk", &both, &[]).await;
    let b = common::provision_staff_with(app, csrf, "billing_clerk", &both, &[]).await;
    (a, b)
}

/// Given a ₹1,000 bill with ₹300 paid, When one person proposes writing off the ₹700 left and
/// another approves, Then the bill is settled with ₹700 written off. A second proposal while
/// the first is pending finds nothing left to reserve; the proposer cannot decide their own.
#[tokio::test]
async fn a_write_off_settles_what_is_left_once_someone_else_approves() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (clerk, supervisor) = two_deciders(&app, &csrf).await;
    let b = bill(&app, "partially_paid", 300).await?;
    grant(&app, &b, &clerk).await?;
    grant(&app, &b, &supervisor).await?;

    let (status, _) = propose(&app, &clerk, &b, "800", "Patient absconded").await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "more than the ₹700 owed is refused"
    );
    let (status, wo) = propose(&app, &clerk, &b, "700", "Patient absconded").await?;
    assert_eq!(status, StatusCode::OK, "{wo}");
    assert_eq!(wo["status"], "pending");
    let (status, _) = propose(&app, &supervisor, &b, "1", "Duplicate ask").await?;
    assert_eq!(status, StatusCode::CONFLICT, "the ₹700 is already reserved");

    let decide = format!(
        "/api/billing/write-offs/{}/approve",
        wo["id"].as_str().ok_or("id")?
    );
    let (status, _) = post(&app, &clerk, &decide, &json!({ "approved": true })).await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "the proposer cannot approve their own"
    );
    assert_eq!(
        state(&app, b.invoice).await?.2,
        "partially_paid",
        "nothing moved yet"
    );

    let (status, approved) = post(&app, &supervisor, &decide, &json!({ "approved": true })).await?;
    assert_eq!(status, StatusCode::OK, "{approved}");
    assert_eq!(
        state(&app, b.invoice).await?,
        ("1000.00".to_owned(), "700.00".to_owned(), "paid".to_owned())
    );

    let (status, _) = post(&app, &supervisor, &decide, &json!({ "approved": true })).await?;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a decided write-off is no longer pending"
    );
    Ok(())
}

/// Given a pending write-off, When it is rejected, Then the bill is untouched and the amount
/// can be proposed again.
#[tokio::test]
async fn a_rejected_write_off_leaves_the_bill_and_frees_the_amount() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (clerk, supervisor) = two_deciders(&app, &csrf).await;
    let b = bill(&app, "issued", 0).await?;
    grant(&app, &b, &clerk).await?;
    grant(&app, &b, &supervisor).await?;

    let (_, wo) = propose(&app, &clerk, &b, "1000", "Charity case").await?;
    let decide = format!(
        "/api/billing/write-offs/{}/approve",
        wo["id"].as_str().ok_or("id")?
    );
    let (status, rejected) = post(
        &app,
        &supervisor,
        &decide,
        &json!({ "approved": false, "notes": "Use the charity scheme" }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{rejected}");
    assert_eq!(rejected["status"], "rejected");
    assert_eq!(
        state(&app, b.invoice).await?,
        ("0.00".to_owned(), "0.00".to_owned(), "issued".to_owned())
    );
    let (status, _) = propose(&app, &clerk, &b, "1000", "Charity case, again").await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "the rejected amount is free to propose again"
    );
    Ok(())
}

/// A proposal needs a real reason, a positive amount and a bill that still owes; and only
/// someone who can reach the patient may decide it.
#[tokio::test]
async fn write_offs_need_a_reason_an_open_bill_and_a_decider_who_can_reach_the_patient() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (clerk, outsider) = two_deciders(&app, &csrf).await;
    let b = bill(&app, "issued", 0).await?;
    grant(&app, &b, &clerk).await?;

    for (amount, reason) in [("100", "no"), ("0", "Absconded"), ("-5", "Absconded")] {
        let (status, _) = propose(&app, &clerk, &b, amount, reason).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{amount} / {reason:?}");
    }
    let settled = bill(&app, "paid", 1000).await?;
    grant(&app, &settled, &clerk).await?;
    let (status, _) = propose(&app, &clerk, &settled, "100", "Absconded").await?;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a paid bill has nothing to write off"
    );

    let (_, wo) = propose(&app, &clerk, &b, "500", "Absconded").await?;
    let decide = format!(
        "/api/billing/write-offs/{}/approve",
        wo["id"].as_str().ok_or("id")?
    );
    let (status, _) = post(&app, &outsider, &decide, &json!({ "approved": true })).await?;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a decider who cannot reach the patient is refused"
    );
    assert_eq!(state(&app, b.invoice).await?.0, "0.00");
    Ok(())
}
