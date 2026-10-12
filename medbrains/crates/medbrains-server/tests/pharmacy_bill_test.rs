//! A bill whose lines are medicines prints as a pharmacy bill: batch, expiry
//! and MRP per line, the schedule, the hospital's GSTIN and drug licence as
//! staff set them on the Billing settings screen, what the patient saved on
//! MRP, and the balance. A deleted line is not on the bill. Its QR resolves,
//! by number and code, to a public check that names no patient.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_medicine_bill_prints_batch_mrp_schedule_and_verifies_publicly() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();

    // The settings, as the Billing settings screen saves them.
    for (category, key, value) in [
        ("billing", "gst_number", json!("33AABCU9603R1ZM")),
        (
            "billing",
            "drug_licence",
            json!("TN-20B-1234 / TN-21B-1235"),
        ),
    ] {
        let resp = app
            .client
            .put(app.url("/api/setup/settings"))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "category": category, "key": key, "value": value }))
            .send()
            .await
            .expect("setting");
        assert!(
            resp.status().is_success(),
            "{category}.{key}: {}",
            resp.status()
        );
    }

    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Bill', 'Patient', 'female', '9000000001') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-PB-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, manufacturer, drug_schedule, mrp, hsn_code) \
         VALUES ($1, $2, 'Telmisartan 40 mg tablet', 'Telmisartan', 'Glenmark', 'H', 8.00, '3004') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("TEL-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("catalog");
    let batch: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date) \
         VALUES ($1, $2, $3, DATE '2027-08-31') RETURNING id",
    )
    .bind(tenant)
    .bind(item)
    .bind(format!("TL{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("batch");
    let number = format!("INV-PB-{tag}");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, subtotal, tax_amount, \
                               total_amount, paid_amount, cgst_amount, sgst_amount) \
         VALUES ($1, $2, $3, 'issued', 204.00, 24.48, 228.48, 100.00, 12.24, 12.24) RETURNING id",
    )
    .bind(tenant)
    .bind(&number)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    for (desc, total) in [
        ("Telmisartan 40 mg tablet", 228.48),
        ("Withdrawn line", 999.00),
    ] {
        sqlx::query(
            "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, quantity, unit_price, \
                                        total_price, pharmacy_batch_id, cgst_amount, sgst_amount, discount_amount) \
             VALUES ($1, $2, 'PHARM', $3, 30, 6.80, $4, $5, 12.24, 12.24, 36.00)",
        )
        .bind(tenant)
        .bind(invoice)
        .bind(desc)
        .bind(total)
        .bind(batch)
        .execute(&app.db)
        .await
        .expect("line");
    }
    // Deleting is soft: the line stays for audit but must leave the bill.
    sqlx::query(
        "DELETE FROM invoice_items WHERE invoice_id = $1 AND description = 'Withdrawn line'",
    )
    .bind(invoice)
    .execute(&app.db)
    .await
    .expect("delete line");

    let bill: Value = app
        .get(
            &app.client,
            &format!("/api/print-data/gst-invoice/{invoice}"),
        )
        .await
        .json()
        .await
        .expect("json");
    assert_eq!(bill["is_pharmacy"], true, "{bill}");
    assert_eq!(
        bill["hospital_gstin"], "33AABCU9603R1ZM",
        "the GSTIN the settings screen saved"
    );
    assert_eq!(bill["drug_licence"], "TN-20B-1234 / TN-21B-1235");
    let items = bill["items"].as_array().expect("items");
    assert_eq!(items.len(), 1, "a deleted line is not on the bill: {bill}");
    let line = &items[0];
    assert_eq!(line["batch_number"], format!("TL{tag}"));
    assert_eq!(line["expiry"], "08/27");
    assert_eq!(line["schedule"], "H");
    assert_eq!(line["generic_name"], "Telmisartan");
    assert_eq!(bill["schedules"], json!(["H"]));
    assert_eq!(bill["mrp_total"], "240.00", "MRP 8.00 × 30");
    assert_eq!(bill["savings"], "11.52", "240.00 − 228.48 billed");
    assert_eq!(bill["balance_due"], "128.48");

    let code: String = sqlx::query_scalar("SELECT verify_code FROM invoices WHERE id = $1")
        .bind(invoice)
        .fetch_one(&app.db)
        .await
        .expect("code");
    let public = reqwest::Client::new();
    let ok = public
        .get(app.url(&format!("/api/public/bills/verify?n={number}&c={code}")))
        .send()
        .await
        .expect("verify");
    assert_eq!(ok.status(), StatusCode::OK);
    let check: Value = ok.json().await.expect("json");
    assert_eq!(check["invoice_number"], number.as_str());
    assert!(
        check.get("patient_name").is_none(),
        "no patient detail on a public check: {check}"
    );
    let wrong = public
        .get(app.url(&format!("/api/public/bills/verify?n={number}&c=000000")))
        .send()
        .await
        .expect("verify");
    assert_eq!(
        wrong.status(),
        StatusCode::NOT_FOUND,
        "the number alone verifies nothing"
    );
}
