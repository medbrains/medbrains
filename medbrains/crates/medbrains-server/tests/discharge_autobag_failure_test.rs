//! Take-home medicines and the pharmacy order they become (#5953).
//!
//! Marking "take-home meds dispensed" turns the discharge summary's medicines
//! into one pharmacy order. Its error was discarded: the step was stamped, the
//! request answered 200, and the patient went home with no order and nobody
//! was told.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// An admitted patient whose finalized discharge summary lists one drug.
struct Discharge {
    app: common::TestApp,
    csrf: String,
    pharmacist: common::Staff,
    admission: Uuid,
    summary: Uuid,
}

/// Admit a patient and write a finalized summary listing 10 of a drug with
/// `stock` on the shelf.
async fn discharge_with_stock(stock: i32) -> R<Discharge> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let pharmacist = common::provision_staff(&app, &csrf, "pharmacist", &[]).await;
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
            &json!({ "first_name": "Takehome", "last_name": "Meds", "gender": "male",
                       "date_of_birth": "1958-03-03", "phone": "9990005953" }),
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
    let admission: Uuid = created["admission"]["id"]
        .as_str()
        .ok_or("admission id")?
        .parse()?;

    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let drug: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, current_stock) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("DCH-{tag}"))
    .bind(format!("Takehome {tag}"))
    .bind(stock)
    .fetch_one(&app.db)
    .await?;
    let summary: Uuid = sqlx::query_scalar(
        "INSERT INTO ipd_discharge_summaries (tenant_id, admission_id, status, finalized_at, \
                                              finalized_by, medications_on_discharge) \
         VALUES ($1, $2, 'finalized', now(), $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(admission)
    .bind(doctor.user_id)
    .bind(
        json!([{ "catalog_item_id": drug, "drug_name": format!("Takehome {tag}"),
                   "quantity": 10 }]),
    )
    .fetch_one(&app.db)
    .await?;
    Ok(Discharge {
        app,
        csrf,
        pharmacist,
        admission,
        summary,
    })
}

impl Discharge {
    /// The nurse marks rx_dispensed; returns the status and body.
    async fn mark_rx_dispensed(&self) -> R<(reqwest::StatusCode, Value)> {
        let path = format!(
            "/api/ipd/admissions/{}/discharge-workflow/step",
            self.admission
        );
        let resp = self
            .app
            .client
            .post(self.app.url(&path))
            .header("x-csrf-token", &self.csrf)
            .json(&json!({ "step": "rx_dispensed" }))
            .send()
            .await?;
        let status = resp.status();
        Ok((status, resp.json().await.unwrap_or(Value::Null)))
    }

    /// The pharmacy orders raised against the summary.
    async fn orders(&self) -> R<Vec<Uuid>> {
        Ok(
            sqlx::query_scalar("SELECT id FROM pharmacy_orders WHERE discharge_summary_id = $1")
                .bind(self.summary)
                .fetch_all(&self.app.db)
                .await?,
        )
    }
}

/// Given a finalized summary listing a drug the pharmacy has none of, When the
/// nurse marks rx_dispensed, Then the step is refused with the reason, it is
/// not stamped, no order exists, and a pharmacist has an inbox item naming
/// the admission.
#[tokio::test]
async fn unbaggable_discharge_medicines_refuse_the_step_and_tell_pharmacy() -> R<()> {
    let d = discharge_with_stock(0).await?;
    let (status, body) = d.mark_rx_dispensed().await?;
    assert_eq!(status, reqwest::StatusCode::CONFLICT, "{body}");
    let detail = body["detail"].as_str().unwrap_or_default();
    assert!(detail.contains("No pharmacy order was made"), "{body}");
    assert!(detail.contains("Insufficient stock"), "the reason: {body}");
    assert!(
        detail.contains("(administrators included)"),
        "who was told: {body}"
    );

    let stamped: Option<Option<chrono::DateTime<chrono::Utc>>> = sqlx::query_scalar(
        "SELECT rx_dispensed_at FROM ipd_discharge_workflows WHERE admission_id = $1",
    )
    .bind(d.admission)
    .fetch_optional(&d.app.db)
    .await?;
    assert!(stamped.flatten().is_none(), "the step is not marked done");
    assert!(d.orders().await?.is_empty(), "no order exists");

    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications \
          WHERE user_id = $1 AND entity_type = 'admission' AND entity_id = $2 \
            AND title = 'Discharge medicines have no pharmacy order'",
    )
    .bind(d.pharmacist.user_id)
    .bind(d.admission)
    .fetch_one(&d.app.db)
    .await?;
    assert_eq!(told, 1, "the pharmacist has it in their inbox");
    Ok(())
}

/// Given the drug is in stock, When the nurse marks rx_dispensed, Then the
/// step is done, one order exists, and it is handed to the Pharmacy
/// department; When its routing is lost and the step is posted again, Then the
/// order is routed again rather than skipped as already bagged.
#[tokio::test]
async fn a_bagged_discharge_order_reaches_the_pharmacy_and_a_retry_reroutes_it() -> R<()> {
    let d = discharge_with_stock(20).await?;
    let (status, body) = d.mark_rx_dispensed().await?;
    assert!(status.is_success(), "{status}: {body}");
    assert!(body["rx_dispensed_at"].is_string(), "{body}");
    let orders = d.orders().await?;
    assert_eq!(orders.len(), 1, "one order for the summary");
    let order = orders[0];

    let routed = || async {
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM relation_tuples t JOIN departments dp \
                 ON dp.id::text = t.subject_id AND dp.code = 'PHARMACY' \
              WHERE t.object_type = 'pharmacy_order' AND t.object_id = $1 \
                AND t.relation = 'dept_member' AND t.subject_type = 'department' \
                AND t.status = 'active'",
        )
        .bind(order)
        .fetch_one(&d.app.db)
        .await
    };
    assert_eq!(routed().await?, 1, "the Pharmacy department can reach it");

    // Routing lost (as for an order bagged before routing existed).
    sqlx::query(
        "UPDATE relation_tuples SET status = 'revoked' \
          WHERE object_type = 'pharmacy_order' AND object_id = $1",
    )
    .bind(order)
    .execute(&d.app.db)
    .await?;
    let (status, body) = d.mark_rx_dispensed().await?;
    assert!(status.is_success(), "{status}: {body}");
    assert_eq!(d.orders().await?.len(), 1, "no second order");
    assert_eq!(routed().await?, 1, "the existing order is routed again");
    Ok(())
}
