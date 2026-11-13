//! Concessions take money off a patient's bill, so they are maker-checker: one person asks,
//! someone else decides, and the arithmetic has to add up before anyone sees it.

use crate::common::{self, Staff, TestApp};

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// A test step's result: a failed seed or request fails the test with its error.
type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A patient with an open bill holding one ₹1,000 consultation line.
struct Bill {
    tenant: Uuid,
    patient: Uuid,
    invoice: Uuid,
    item: Uuid,
}

/// Seed a patient, an encounter, an invoice in `status` and its one ₹1,000 line.
async fn bill(app: &TestApp, status: &str) -> R<Bill> {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Concession', 'Patient', 'male'::gender, '9000001225') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-CON-{tag}"))
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
                               total_amount, status) \
         VALUES ($1, $2, $3, $4, 1000, $5::invoice_status) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-CON-{tag}"))
    .bind(patient)
    .bind(encounter)
    .bind(status)
    .fetch_one(&app.db)
    .await?;
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, unit_price, \
                                    total_price) \
         VALUES ($1, $2, 'CONS', 'Consultation', 1000, 1000) RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .fetch_one(&app.db)
    .await?;
    Ok(Bill {
        tenant,
        patient,
        invoice,
        item,
    })
}

/// Let `staff` reach the bill's patient, as a billing desk is assigned to a patient.
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

/// Send `body` to `path` as `staff`; the status and JSON answer (Null when not JSON).
async fn send(
    app: &TestApp,
    staff: &Staff,
    method: Method,
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

/// A request for a 20% concession on the bill's line, with any field in `overrides` replaced.
fn twenty_percent(b: &Bill, overrides: &Value) -> Value {
    let mut body = json!({
        "invoice_id": b.invoice, "invoice_item_id": b.item, "patient_id": b.patient,
        "concession_type": "staff", "original_amount": "1000", "concession_percent": "20",
        "concession_amount": "200", "final_amount": "800", "reason": "Staff family",
    });
    if let (Some(map), Some(extra)) = (body.as_object_mut(), overrides.as_object()) {
        for (k, v) in extra {
            map.insert(k.clone(), v.clone());
        }
    }
    body
}

/// The bill's total, as text, read from the database.
async fn total(app: &TestApp, invoice: Uuid) -> R<String> {
    Ok(
        sqlx::query_scalar("SELECT total_amount::text FROM invoices WHERE id = $1")
            .bind(invoice)
            .fetch_one(&app.db)
            .await?,
    )
}

/// Given a ₹1,000 line, When a clerk asks for a 20% concession and a supervisor approves it,
/// Then the line and the bill drop to ₹800. The clerk cannot approve their own request, and an
/// approved concession cannot be approved or rejected again.
#[tokio::test]
async fn a_concession_is_asked_by_one_person_and_approved_by_another() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let approve = ["billing.concessions.approve"];
    let clerk = common::provision_staff_with(&app, &csrf, "billing_clerk", &approve, &[]).await;
    let supervisor =
        common::provision_staff_with(&app, &csrf, "billing_clerk", &approve, &[]).await;
    let b = bill(&app, "issued").await?;
    grant(&app, &b, &clerk).await?;
    grant(&app, &b, &supervisor).await?;

    let (status, asked) = send(
        &app,
        &clerk,
        Method::POST,
        "/api/billing/concessions",
        &twenty_percent(&b, &json!({})),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{asked}");
    assert_eq!(asked["status"], "pending");
    assert_eq!(
        total(&app, b.invoice).await?,
        "1000.00",
        "nothing moves while it is pending"
    );
    let id = asked["id"].as_str().ok_or("concession id")?.to_owned();

    let (status, _) = send(
        &app,
        &clerk,
        Method::PUT,
        &format!("/api/billing/concessions/{id}/approve"),
        &json!({}),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "the requester cannot approve their own"
    );

    let (status, approved) = send(
        &app,
        &supervisor,
        Method::PUT,
        &format!("/api/billing/concessions/{id}/approve"),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::OK, "{approved}");
    assert_eq!(approved["status"], "approved");
    assert_eq!(total(&app, b.invoice).await?, "800.00");

    for action in ["approve", "reject"] {
        let (status, _) = send(
            &app,
            &supervisor,
            Method::PUT,
            &format!("/api/billing/concessions/{id}/{action}"),
            &json!({}),
        )
        .await?;
        assert_eq!(
            status,
            StatusCode::CONFLICT,
            "a decided concession cannot be {action}d again"
        );
    }
    Ok(())
}

/// Given a ₹1,000 line, When the numbers do not add up, the reason is missing, the line belongs
/// to another bill amount, or the bill is already paid, Then the request is refused and no
/// concession is recorded.
#[tokio::test]
async fn a_concession_whose_numbers_do_not_add_up_is_refused() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let b = bill(&app, "issued").await?;
    grant(&app, &b, &clerk).await?;

    let bad = [
        json!({ "final_amount": "850" }),
        json!({ "concession_amount": "1200", "final_amount": "-200" }),
        json!({ "concession_amount": "0", "final_amount": "1000" }),
        json!({ "reason": "ok" }),
        json!({ "concession_percent": "120" }),
        json!({ "original_amount": "1200", "final_amount": "1000" }),
        json!({ "concession_type": "  " }),
    ];
    for overrides in bad {
        let (status, body) = send(
            &app,
            &clerk,
            Method::POST,
            "/api/billing/concessions",
            &twenty_percent(&b, &overrides),
        )
        .await?;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "{overrides} must be refused: {body}"
        );
    }

    let paid = bill(&app, "paid").await?;
    grant(&app, &paid, &clerk).await?;
    let (status, _) = send(
        &app,
        &clerk,
        Method::POST,
        "/api/billing/concessions",
        &twenty_percent(&paid, &json!({})),
    )
    .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a paid bill needs a credit note, not a concession"
    );

    let recorded: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM billing_concessions WHERE patient_id = ANY($1)")
            .bind(vec![b.patient, paid.patient])
            .fetch_one(&app.db)
            .await?;
    assert_eq!(recorded, 0);
    Ok(())
}

/// Given a clerk who may ask but not approve, When they try to approve someone else's request,
/// Then 403; and When they ask for a patient they were never assigned, Then 404.
#[tokio::test]
async fn approving_needs_its_permission_and_asking_needs_the_patient() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let asker = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let other = common::provision_staff(
        &app,
        &csrf,
        "billing_clerk",
        &["billing.concessions.approve"],
    )
    .await;
    let b = bill(&app, "issued").await?;
    let stranger = bill(&app, "issued").await?;
    grant(&app, &b, &asker).await?;
    grant(&app, &b, &other).await?;

    let (_, asked) = send(
        &app,
        &asker,
        Method::POST,
        "/api/billing/concessions",
        &twenty_percent(&b, &json!({})),
    )
    .await?;
    let id = asked["id"].as_str().ok_or("concession id")?.to_owned();
    let (status, _) = send(
        &app,
        &other,
        Method::PUT,
        &format!("/api/billing/concessions/{id}/approve"),
        &json!({}),
    )
    .await?;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = send(
        &app,
        &asker,
        Method::POST,
        "/api/billing/concessions",
        &twenty_percent(&stranger, &json!({})),
    )
    .await?;
    assert_eq!(status, StatusCode::NOT_FOUND);
    Ok(())
}
