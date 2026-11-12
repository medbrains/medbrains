//! Patient advances (deposits) are money held for a patient: collected, set against their
//! bills, and refunded. Every rupee taken in has to end up on a bill or back with the patient,
//! never on someone else's bill and never twice.

use crate::common::{self, Staff, TestApp};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A patient of this tenant, with an issued, unpaid bill of `bill_total`.
struct Patient {
    id: Uuid,
    invoice: Uuid,
}

/// The admin's tenant.
async fn tenant(app: &TestApp) -> R<Uuid> {
    Ok(
        sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await?,
    )
}

/// Make a patient with an encounter and an issued bill of `bill_total` rupees, none paid.
async fn patient_with_bill(app: &TestApp, tenant: Uuid, bill_total: i64) -> R<Patient> {
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Advance', 'Patient', 'female'::gender, '9000001224') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-ADV-{tag}"))
    .fetch_one(&app.db)
    .await?;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(tenant)
    .bind(id)
    .fetch_one(&app.db)
    .await?;
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, \
                               total_amount, paid_amount, status) \
         VALUES ($1, $2, $3, $4, $5, 0, 'issued'::invoice_status) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-ADV-{tag}"))
    .bind(id)
    .bind(encounter)
    .bind(rust_decimal::Decimal::from(bill_total))
    .fetch_one(&app.db)
    .await?;
    Ok(Patient { id, invoice })
}

/// Let `staff` reach `patient`, the way a hospital assigns a billing desk to a patient.
async fn grant(app: &TestApp, tenant: Uuid, patient: Uuid, staff: &Staff) -> R<()> {
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'viewer', 'user', $3::text, $3)",
    )
    .bind(tenant)
    .bind(patient)
    .bind(staff.user_id)
    .execute(&app.db)
    .await?;
    Ok(())
}

/// POST `body` to `path` as `staff`; the status and the JSON answer (Null when not JSON).
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

/// A JSON money string ("5000.00", or "0" for a zero numeric) as whole rupees, compared by
/// value so the test does not depend on how the column's scale is rendered.
fn money(value: &Value) -> R<i64> {
    let amount: rust_decimal::Decimal = value.as_str().ok_or("money is a string")?.parse()?;
    Ok(amount.trunc().to_string().parse()?)
}

/// The bill's paid amount and status, read from the database.
async fn bill(app: &TestApp, invoice: Uuid) -> R<(String, String)> {
    Ok(
        sqlx::query_as("SELECT paid_amount::text, status::text FROM invoices WHERE id = $1")
            .bind(invoice)
            .fetch_one(&app.db)
            .await?,
    )
}

/// Given a ₹5,000 deposit and a ₹3,000 bill, When the desk sets ₹2,000 then ₹1,000 against the
/// bill, Then the bill is paid and ₹2,000 stays on deposit; When that ₹2,000 is refunded with a
/// reason, Then the deposit is closed as refunded. Every over-draw is refused on the way.
#[tokio::test]
async fn a_deposit_is_spent_on_the_patients_bill_and_the_rest_refunded() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await?;
    let desk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let p = patient_with_bill(&app, tenant, 3000).await?;
    grant(&app, tenant, p.id, &desk).await?;

    let (status, refused) = post(
        &app,
        &desk,
        "/api/billing/advances",
        &json!({ "patient_id": p.id, "amount": 0, "payment_mode": "cash" }),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a zero deposit is refused: {refused}"
    );

    let (status, advance) = post(&app, &desk, "/api/billing/advances",
        &json!({ "patient_id": p.id, "amount": "5000", "payment_mode": "cash", "purpose": "admission" })).await?;
    assert_eq!(status, StatusCode::OK, "{advance}");
    assert_eq!(money(&advance["balance"])?, 5000);
    assert_eq!(advance["status"], "active");
    let adv = advance["id"].as_str().ok_or("advance id")?.to_owned();

    let adjust = format!("/api/billing/advances/{adv}/adjust");
    let (status, _) = post(
        &app,
        &desk,
        &adjust,
        &json!({ "invoice_id": p.invoice, "amount": "3500" }),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "more than the bill owes is refused"
    );

    let (status, first) = post(
        &app,
        &desk,
        &adjust,
        &json!({ "invoice_id": p.invoice, "amount": "2000" }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(
        bill(&app, p.invoice).await?,
        ("2000.00".to_owned(), "partially_paid".to_owned())
    );

    let (status, _) = post(
        &app,
        &desk,
        &adjust,
        &json!({ "invoice_id": p.invoice, "amount": "1000" }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        bill(&app, p.invoice).await?,
        ("3000.00".to_owned(), "paid".to_owned())
    );

    let (status, _) = post(
        &app,
        &desk,
        &adjust,
        &json!({ "invoice_id": p.invoice, "amount": "1" }),
    )
    .await?;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a paid bill takes no more");

    let refund = format!("/api/billing/advances/{adv}/refund");
    let (status, _) = post(
        &app,
        &desk,
        &refund,
        &json!({ "amount": "2000", "reason": "  " }),
    )
    .await?;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a refund needs a reason");
    let (status, _) = post(
        &app,
        &desk,
        &refund,
        &json!({ "amount": "2500", "reason": "Discharged" }),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "more than the balance is refused"
    );

    let (status, closed) = post(
        &app,
        &desk,
        &refund,
        &json!({ "amount": "2000", "reason": "Discharged", "mode": "upi" }),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{closed}");
    assert_eq!(money(&closed["balance"])?, 0);
    assert_eq!(closed["status"], "refunded");

    let (status, _) = post(
        &app,
        &desk,
        &refund,
        &json!({ "amount": "1", "reason": "again" }),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a refunded deposit has nothing left to give"
    );
    Ok(())
}

/// Given two patients, When the desk tries to set one patient's deposit against the other's
/// bill, Then it is refused and neither bill nor deposit moves.
#[tokio::test]
async fn a_deposit_never_pays_another_patients_bill() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await?;
    let desk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let (owner, other) = (
        patient_with_bill(&app, tenant, 1000).await?,
        patient_with_bill(&app, tenant, 1000).await?,
    );
    grant(&app, tenant, owner.id, &desk).await?;
    grant(&app, tenant, other.id, &desk).await?;

    let (_, advance) = post(
        &app,
        &desk,
        "/api/billing/advances",
        &json!({ "patient_id": owner.id, "amount": "800", "payment_mode": "cash" }),
    )
    .await?;
    let adv = advance["id"].as_str().ok_or("advance id")?.to_owned();
    let (status, _) = post(
        &app,
        &desk,
        &format!("/api/billing/advances/{adv}/adjust"),
        &json!({ "invoice_id": other.invoice, "amount": "500" }),
    )
    .await?;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        bill(&app, other.invoice).await?,
        ("0.00".to_owned(), "issued".to_owned())
    );
    let balance: String =
        sqlx::query_scalar("SELECT balance::text FROM patient_advances WHERE id = $1::uuid")
            .bind(&adv)
            .fetch_one(&app.db)
            .await?;
    assert_eq!(balance, "800.00");
    Ok(())
}

/// Given a desk without the refund permission, When it refunds a deposit, Then 403; and given a
/// patient the desk was never assigned, When it takes a deposit for them, Then it is refused
/// as if the patient did not exist.
#[tokio::test]
async fn refunds_need_their_permission_and_deposits_need_the_patient() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await?;
    let desk =
        common::provision_staff(&app, &csrf, "billing_clerk", &["billing.advances.refund"]).await;
    let mine = patient_with_bill(&app, tenant, 1000).await?;
    let stranger = patient_with_bill(&app, tenant, 1000).await?;
    grant(&app, tenant, mine.id, &desk).await?;

    let (_, advance) = post(
        &app,
        &desk,
        "/api/billing/advances",
        &json!({ "patient_id": mine.id, "amount": "300", "payment_mode": "cash" }),
    )
    .await?;
    let adv = advance["id"].as_str().ok_or("advance id")?.to_owned();
    let (status, _) = post(
        &app,
        &desk,
        &format!("/api/billing/advances/{adv}/refund"),
        &json!({ "amount": "100", "reason": "Asked" }),
    )
    .await?;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = post(
        &app,
        &desk,
        "/api/billing/advances",
        &json!({ "patient_id": stranger.id, "amount": "300", "payment_mode": "cash" }),
    )
    .await?;
    assert_eq!(status, StatusCode::NOT_FOUND);
    Ok(())
}
