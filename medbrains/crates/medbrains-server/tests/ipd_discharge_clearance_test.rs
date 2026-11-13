//! Clearing a patient to go home: the discharge checklist and No-Dues.
//!
//! The checklist says who confirmed each step (medicines explained, lines
//! removed, valuables returned), so a second tick must not rewrite it and an
//! untick must not leave a name behind. No-Dues is issued by billing, who reach
//! a patient through billing access rather than the ward's care team, and only
//! once the admission's bills are paid.

use crate::common;

use reqwest::{Method, StatusCode};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// An admitted patient and the admin who admitted them.
struct Ward {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    admin: Uuid,
    patient: Uuid,
    admission: Uuid,
}

/// Admit a fresh patient, without a bed.
async fn admit() -> R<Ward> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await?;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await?;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "first_name": "Going", "last_name": "Home", "gender": "female",
                       "date_of_birth": "1962-07-07", "phone": "9990000084" }),
        )
        .send()
        .await?
        .json()
        .await?;
    let created: Value = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "patient_id": patient["id"], "department_id": depts[0]["id"],
                       "doctor_id": doctor.user_id }),
        )
        .send()
        .await?
        .json()
        .await?;
    Ok(Ward {
        tenant,
        admin,
        patient: patient["id"].as_str().ok_or("patient id")?.parse()?,
        admission: created["admission"]["id"]
            .as_str()
            .ok_or("admission id")?
            .parse()?,
        app,
        csrf,
    })
}

impl Ward {
    /// Send `body` to the admission's `sub` path as `who` (the admin if `None`).
    async fn send(
        &self,
        who: Option<&common::Staff>,
        method: Method,
        sub: &str,
        body: &Value,
    ) -> R<(StatusCode, Value)> {
        let (client, csrf) = who.map_or((&self.app.client, &self.csrf), |s| (&s.client, &s.csrf));
        let path = format!("/api/ipd/admissions/{}/{sub}", self.admission);
        let resp = client
            .request(method, self.app.url(&path))
            .header("x-csrf-token", csrf)
            .json(body)
            .send()
            .await?;
        let status = resp.status();
        Ok((status, resp.json().await.unwrap_or(Value::Null)))
    }

    /// Give `staff` a viewer tuple on `object_type` `object_id`.
    async fn grant(&self, staff: &common::Staff, object_type: &str, object_id: Uuid) -> R<()> {
        sqlx::query(
            "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                    subject_type, subject_id, granted_by) \
             VALUES ($1, $2, $3, 'viewer', 'user', $4::text, $4)",
        )
        .bind(self.tenant)
        .bind(object_type)
        .bind(object_id)
        .bind(staff.user_id)
        .execute(&self.app.db)
        .await?;
        Ok(())
    }
}

/// A checklist item's status, completer and time.
type Tick = (String, Option<Uuid>, Option<chrono::DateTime<chrono::Utc>>);

/// Read one checklist item from the table.
async fn tick_row(db: &sqlx::PgPool, id: Uuid) -> R<Tick> {
    Ok(sqlx::query_as(
        "SELECT status, completed_by, completed_at FROM ipd_discharge_checklists WHERE id = $1",
    )
    .bind(id)
    .fetch_one(db)
    .await?)
}

/// Given a nurse who may read the checklist but not change it, When she starts
/// it, Then 403 and no items exist; When the admin starts it, Then ten items
/// are pending; When an item is ticked, ticked again by a nurse, set to an
/// unknown status, and unticked, Then the first completer stands, the unknown
/// status is refused, and unticking leaves no completer.
#[tokio::test]
async fn a_checklist_tick_keeps_its_first_completer() -> R<()> {
    let w = admit().await?;
    let reader = common::provision_staff(
        &w.app,
        &w.csrf,
        "nurse",
        &["ipd.discharge_checklist.update"],
    )
    .await;
    w.grant(&reader, "admission", w.admission).await?;
    let start = w
        .send(
            Some(&reader),
            Method::POST,
            "discharge-checklist",
            &json!({}),
        )
        .await?;
    assert_eq!(
        start.0,
        StatusCode::FORBIDDEN,
        "starting the list writes rows"
    );
    let (_, none) = w
        .send(None, Method::GET, "discharge-checklist", &Value::Null)
        .await?;
    assert_eq!(none.as_array().map(Vec::len), Some(0));

    let (status, items) = w
        .send(None, Method::POST, "discharge-checklist", &json!({}))
        .await?;
    assert_eq!(status, StatusCode::OK, "{items}");
    let items = items.as_array().ok_or("items")?;
    assert_eq!(items.len(), 10);
    let id: Uuid = items[0]["id"].as_str().ok_or("item id")?.parse()?;
    let sub = format!("discharge-checklist/{id}");

    let done = json!({ "status": "completed" });
    assert_eq!(
        w.send(None, Method::PUT, &sub, &done).await?.0,
        StatusCode::OK
    );
    let first = tick_row(&w.app.db, id).await?;
    assert_eq!((first.0.as_str(), first.1), ("completed", Some(w.admin)));

    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    w.grant(&nurse, "admission", w.admission).await?;
    assert_eq!(
        w.send(Some(&nurse), Method::PUT, &sub, &done).await?.0,
        StatusCode::OK
    );
    assert_eq!(
        tick_row(&w.app.db, id).await?,
        first,
        "a second tick rewrote who did it"
    );

    let odd = json!({ "status": "done" });
    assert_eq!(
        w.send(None, Method::PUT, &sub, &odd).await?.0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(tick_row(&w.app.db, id).await?, first);

    let undo = json!({ "status": "pending" });
    assert_eq!(
        w.send(None, Method::PUT, &sub, &undo).await?.0,
        StatusCode::OK
    );
    assert_eq!(
        tick_row(&w.app.db, id).await?,
        ("pending".to_owned(), None, None)
    );
    Ok(())
}

/// Given a billing clerk with billing access to the patient but no place on
/// the ward's care team, When the admission's bill is unpaid, Then No-Dues is
/// refused 409 and none exists; When the bill is paid, Then she issues it and
/// can read it back with a zero balance.
#[tokio::test]
async fn billing_issues_no_dues_once_the_bill_is_paid() -> R<()> {
    let w = admit().await?;
    let clerk = common::provision_staff(&w.app, &w.csrf, "billing_clerk", &[]).await;
    w.grant(&clerk, "patient", w.patient).await?;
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, admission_id, status, \
             subtotal, total_amount, paid_amount) \
         VALUES ($1, $2, $3, $4, 'issued', 4500, 4500, 1000) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("INV-ND-{tag}"))
    .bind(w.patient)
    .bind(w.admission)
    .fetch_one(&w.app.db)
    .await?;
    let sub = "no-dues-certificate";

    let (status, body) = w.send(Some(&clerk), Method::POST, sub, &json!({})).await?;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    let (status, none) = w.send(Some(&clerk), Method::GET, sub, &Value::Null).await?;
    assert_eq!((status, none), (StatusCode::OK, Value::Null));

    sqlx::query("UPDATE invoices SET paid_amount = total_amount, status = 'paid' WHERE id = $1")
        .bind(invoice)
        .execute(&w.app.db)
        .await?;
    let (status, cert) = w.send(Some(&clerk), Method::POST, sub, &json!({})).await?;
    assert_eq!(status, StatusCode::OK, "{cert}");
    let (_, read) = w.send(Some(&clerk), Method::GET, sub, &Value::Null).await?;
    let balance: Decimal = read["balance"].as_str().ok_or("balance")?.parse()?;
    assert_eq!(
        (balance, read["issued_by"].as_str()),
        (Decimal::ZERO, Some(clerk.user_id.to_string().as_str()))
    );
    Ok(())
}
