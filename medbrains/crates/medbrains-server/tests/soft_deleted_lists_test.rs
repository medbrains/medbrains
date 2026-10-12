//! A deleted record leaves the lists. Deleting is soft — the row stays, with
//! `deleted_at` set, for audit — so every list must say so in its query. A
//! deleted patient still came up in patient search, and a deleted invoice
//! still counted towards what a patient owed.

mod common;

use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn deleted_patients_and_invoices_leave_the_patient_list() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let patient = |last: &'static str| {
        let db = app.db.clone();
        let uhid = format!("UH-SD-{last}-{tag}");
        async move {
            let id: Uuid = sqlx::query_scalar(
                "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                 VALUES ($1, $2, 'Softdel', $3, 'male', $4) RETURNING id",
            )
            .bind(tenant)
            .bind(&uhid)
            .bind(last)
            .bind(format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]))
            .fetch_one(&db)
            .await
            .expect("patient");
            id
        }
    };
    let kept = patient("Kept").await;
    let gone = patient("Gone").await;
    // Two unpaid bills for the kept patient; one is then deleted.
    for amount in [100, 250] {
        sqlx::query(
            "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, total_amount) \
             VALUES ($1, $2, $3, 'issued', $4)",
        )
        .bind(tenant)
        .bind(format!("SD-{tag}-{amount}"))
        .bind(kept)
        .bind(amount)
        .execute(&app.db)
        .await
        .expect("invoice");
    }
    // DELETE is soft: the guardrail trigger sets deleted_at and keeps the row.
    sqlx::query("DELETE FROM invoices WHERE invoice_number = $1")
        .bind(format!("SD-{tag}-250"))
        .execute(&app.db)
        .await
        .expect("delete invoice");
    sqlx::query("DELETE FROM patients WHERE id = $1")
        .bind(gone)
        .execute(&app.db)
        .await
        .expect("delete patient");

    let list: Value = app
        .client
        .get(app.url(&format!("/api/patients?search=Softdel&per_page=50")))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let rows = list["patients"].as_array().cloned().unwrap_or_default();
    let ids: Vec<&str> = rows.iter().filter_map(|p| p["id"].as_str()).collect();
    assert!(ids.contains(&kept.to_string().as_str()), "{list}");
    assert!(
        !ids.contains(&gone.to_string().as_str()),
        "a deleted patient is gone from search: {list}"
    );
    let owed = rows
        .iter()
        .find(|p| p["id"] == kept.to_string())
        .and_then(|p| p["outstanding_balance"].as_str().map(str::to_owned))
        .and_then(|s| s.parse::<f64>().ok());
    assert_eq!(owed, Some(100.0), "a deleted bill isn't owed: {list}");
}
