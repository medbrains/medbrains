//! The storefront's GST split against a real, migrated database: on every
//! line CGST + SGST is the line's tax to the paisa, and the line with its tax
//! is never above MRP. Rounding each half on its own put 48.7% of lines a
//! paisa out, and could put a line a paisa over MRP.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-pharmacy --lib storefront::invoice -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used)]

use medbrains_core::pharmacy_storefront::taxable_unit_price;
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

/// Insert a row and return its id.
async fn id(db: &PgPool, sql: &str, binds: &[Uuid]) -> Uuid {
    binds
        .iter()
        .fold(sqlx::query_scalar(sql), |q, b| q.bind(*b))
        .fetch_one(db)
        .await
        .expect(sql)
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn cgst_plus_sgst_is_the_line_tax_on_every_line() {
    let db = PgPool::connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL"))
        .await
        .unwrap();
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'GST split test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("GS{code}"))
    .fetch_one(&db)
    .await
    .unwrap();
    let t = [tenant];
    let patient = id(&db, "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, gen_random_uuid()::text, 'Test', 'Patient', 'female', '9000000000') RETURNING id", &t).await;
    let order = id(
        &db,
        "INSERT INTO pharmacy_orders (tenant_id) VALUES ($1) RETURNING id",
        &t,
    )
    .await;
    let invoice = id(
        &db,
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id) \
         VALUES ($1, gen_random_uuid()::text, $2) RETURNING id",
        &[tenant, patient],
    )
    .await;
    // Every MRP from ₹0.01 to ₹3.00 at 5%, 12% and 18%, one to three units,
    // priced the way the storefront prices it.
    let mut mrp_of = HashMap::new();
    for (n, rate) in (1..=300).flat_map(|p| [5, 12, 18].map(|r| (p, r))) {
        let mrp = Decimal::new(n, 2);
        let price = taxable_unit_price(mrp, Decimal::from(rate));
        let quantity = 1 + i32::try_from(n % 3).unwrap();
        let catalog: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_catalog (tenant_id, code, name, gst_rate, hsn_code) \
             VALUES ($1, gen_random_uuid()::text, 'Item', $2, '3004') RETURNING id",
        )
        .bind(tenant)
        .bind(Decimal::from(rate))
        .fetch_one(&db)
        .await
        .unwrap();
        let line: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_order_items (tenant_id, order_id, drug_name, catalog_item_id) \
             VALUES ($1, $2, 'Item', $3) RETURNING id",
        )
        .bind(tenant)
        .bind(order)
        .bind(catalog)
        .fetch_one(&db)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, quantity, \
             unit_price, total_price, pharmacy_order_id, source_id, source) \
             VALUES ($1, $2, 'RX', 'Item', $3, $4, $4 * $3, $5, $6, 'pharmacy')",
        )
        .bind(tenant)
        .bind(invoice)
        .bind(quantity)
        .bind(price)
        .bind(order)
        .bind(line)
        .execute(&db)
        .await
        .unwrap();
        mrp_of.insert(line, mrp);
    }
    let mut tx = db.begin().await.unwrap();
    super::tax_lines(&mut tx, tenant, order)
        .await
        .expect("tax lines");
    tx.commit().await.unwrap();

    let rows: Vec<(Uuid, Decimal, i32, Decimal, Decimal, Decimal)> = sqlx::query_as(
        "SELECT source_id, unit_price, quantity, gst_rate, cgst_amount, sgst_amount \
           FROM invoice_items WHERE invoice_id = $1",
    )
    .bind(invoice)
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(rows.len(), 900);
    let hundred = Decimal::ONE_HUNDRED;
    let off: Vec<_> = rows
        .iter()
        .filter(|(line, price, qty, rate, cgst, sgst)| {
            let taxable = price * Decimal::from(*qty);
            let tax = (taxable * rate / hundred)
                .round_dp_with_strategy(2, rust_decimal::RoundingStrategy::MidpointAwayFromZero);
            let over_mrp = taxable + cgst + sgst > mrp_of[line] * Decimal::from(*qty);
            cgst + sgst != tax || over_mrp
        })
        .collect();
    assert!(
        off.is_empty(),
        "{} of 900 lines split wrong, e.g. {:?}",
        off.len(),
        off.first()
    );
}
