//! Take-home medicines that cannot become a pharmacy order (#5953).
//!
//! Marking "take-home meds dispensed" turns the discharge summary's medicines
//! into one pharmacy order. Its error was discarded: the step was stamped, the
//! request answered 200, and the patient went home with no order and nobody
//! was told.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// Given a finalized summary listing a drug the pharmacy has none of, When the
/// nurse marks rx_dispensed, Then the step is refused with the reason, it is
/// not stamped, no order exists, and a pharmacist has an inbox
/// item naming the admission.
#[tokio::test]
async fn unbaggable_discharge_medicines_refuse_the_step_and_tell_pharmacy() -> R<()> {
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

    // Sold here, none on the shelf: the order is refused on stock.
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let drug: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, current_stock) \
         VALUES ($1, $2, $3, 0) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("DCH-{tag}"))
    .bind(format!("Takehome {tag}"))
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

    let resp = app
        .client
        .post(app.url(&format!(
            "/api/ipd/admissions/{admission}/discharge-workflow/step"
        )))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "step": "rx_dispensed" }))
        .send()
        .await?;
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    assert_eq!(status, reqwest::StatusCode::CONFLICT, "{body}");
    let detail = body["detail"].as_str().unwrap_or_default();
    assert!(detail.contains("No pharmacy order was made"), "{body}");
    assert!(detail.contains("Insufficient stock"), "the reason: {body}");
    assert!(
        detail.contains("Pharmacy staff have been notified"),
        "{body}"
    );

    let stamped: Option<Option<chrono::DateTime<chrono::Utc>>> = sqlx::query_scalar(
        "SELECT rx_dispensed_at FROM ipd_discharge_workflows WHERE admission_id = $1",
    )
    .bind(admission)
    .fetch_optional(&app.db)
    .await?;
    assert!(stamped.flatten().is_none(), "the step is not marked done");

    let orders: i64 =
        sqlx::query_scalar("SELECT count(*) FROM pharmacy_orders WHERE discharge_summary_id = $1")
            .bind(summary)
            .fetch_one(&app.db)
            .await?;
    assert_eq!(orders, 0, "no order exists");

    let told: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications \
          WHERE user_id = $1 AND entity_type = 'admission' AND entity_id = $2 \
            AND title = 'Discharge medicines have no pharmacy order'",
    )
    .bind(pharmacist.user_id)
    .bind(admission)
    .fetch_one(&app.db)
    .await?;
    assert_eq!(told, 1, "the pharmacist has it in their inbox");
    Ok(())
}
