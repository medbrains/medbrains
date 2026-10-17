//! The discharge bill checklist (#292): an admission's final bill cannot be
//! issued while an order performed for the stay is missing from it, and the
//! checklist shows what the advance leaves to collect.

mod common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

async fn id(app: &common::TestApp, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(&app.db).await.expect(sql)
}

fn money(v: &Value) -> f64 {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(f64::NAN)
}

#[tokio::test]
async fn the_final_bill_waits_for_every_order_on_the_stay() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = id(
        &app,
        "SELECT tenant_id FROM users WHERE username = 'admin'",
        &[],
    )
    .await;
    let admin = id(&app, "SELECT id FROM users WHERE username = 'admin'", &[]).await;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let patient = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Final', 'Bill', 'male', '9000000292') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-FB-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter = id(
        &app,
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'ipd') RETURNING id",
        &[tenant, patient],
    )
    .await;
    let admission = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, admission_number) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(admin)
    .bind(format!("IP-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("admission");
    let invoice = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, admission_id, \
                               status, subtotal, total_amount) \
         VALUES ($1, $2, $3, $4, $5, 'draft', 3000, 3000) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-FB-{tag}"))
    .bind(patient)
    .bind(encounter)
    .bind(admission)
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    id(&app, "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, unit_price, total_price, source) \
         VALUES ($1, $2, 'BED', 'Room rent', 3000, 3000, 'ipd') RETURNING id", &[tenant, invoice]).await;
    let test = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $2, 'Serum creatinine') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CR{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("test");
    let order = id(
        &app,
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
        &[tenant, encounter, patient, test, admin],
    )
    .await;
    sqlx::query(
        "INSERT INTO patient_advances (tenant_id, patient_id, advance_number, amount, balance) \
         VALUES ($1, $2, $3, 5000, 5000)",
    )
    .bind(tenant)
    .bind(patient)
    .bind(format!("ADV-{tag}"))
    .execute(&app.db)
    .await
    .expect("advance");

    let checklist = |app: &common::TestApp| {
        let url = app.url(&format!(
            "/api/billing/admissions/{admission}/final-bill-checklist"
        ));
        let client = app.client.clone();
        async move {
            let r = client.get(url).send().await.expect("checklist");
            assert_eq!(r.status(), StatusCode::OK);
            r.json::<Value>().await.expect("json")
        }
    };
    let issue = |app: &common::TestApp| {
        let req = app
            .client
            .post(app.url(&format!("/api/billing/invoices/{invoice}/issue")))
            .header("x-csrf-token", &csrf);
        async move { req.send().await.expect("issue") }
    };

    let open = checklist(&app).await;
    assert_eq!(open["unbilled_orders"][0]["name"], "Serum creatinine");
    assert_eq!(
        money(&open["net_payable"]),
        -2000.0,
        "the advance covers the bill: refund due"
    );
    let refused = issue(&app).await;
    assert_eq!(refused.status(), StatusCode::CONFLICT);
    assert!(
        refused
            .text()
            .await
            .unwrap_or_default()
            .contains("not on the bill")
    );

    id(&app, "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, unit_price, total_price, source, source_id) \
         VALUES ($1, $2, 'CREAT', 'Serum creatinine', 250, 250, 'lab', $3) RETURNING id", &[tenant, invoice, order]).await;
    let done = checklist(&app).await;
    assert_eq!(done["blockers"].as_array().map(Vec::len), Some(0), "{done}");
    assert_eq!(issue(&app).await.status(), StatusCode::OK);
}
