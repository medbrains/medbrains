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

/// A hospital, an online order and its invoice, in one statement:
/// `(tenant, order, invoice)`.
async fn order_and_invoice(db: &PgPool) -> (Uuid, Uuid, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    sqlx::query_as(
        "WITH t AS (INSERT INTO tenants (code, name, hospital_type) \
                    VALUES ($1, 'GST split test', 'multi_specialty') RETURNING id), \
              p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                    SELECT id, gen_random_uuid()::text, 'Test', 'Patient', 'female', '9000000000' \
                      FROM t RETURNING id, tenant_id), \
              o AS (INSERT INTO pharmacy_orders (tenant_id) SELECT id FROM t RETURNING id), \
              i AS (INSERT INTO invoices (tenant_id, invoice_number, patient_id) \
                    SELECT tenant_id, gen_random_uuid()::text, id FROM p RETURNING id) \
         SELECT t.id, o.id, i.id FROM t, o, i",
    )
    .bind(format!("GS{code}"))
    .fetch_one(db)
    .await
    .expect("order and invoice")
}

/// Every MRP from ₹0.01 to ₹3.00 at 5%, 12% and 18%, one to three units,
/// priced the way the storefront prices it, as catalogue item, order line
/// and invoice line, in one statement. Returns each order line's MRP.
async fn seed_lines(
    db: &PgPool,
    tenant: Uuid,
    order: Uuid,
    invoice: Uuid,
) -> HashMap<Uuid, Decimal> {
    let (mut lines, mut rates, mut prices, mut quantities) = (vec![], vec![], vec![], vec![]);
    let mut mrp_of = HashMap::new();
    for (n, rate) in (1..=300).flat_map(|p| [5, 12, 18].map(|r| (p, r))) {
        let mrp = Decimal::new(n, 2);
        let line = Uuid::new_v4();
        lines.push(line);
        rates.push(Decimal::from(rate));
        prices.push(taxable_unit_price(mrp, Decimal::from(rate)));
        quantities.push(1 + i32::try_from(n % 3).unwrap());
        mrp_of.insert(line, mrp);
    }
    sqlx::query(
        "WITH input AS MATERIALIZED ( \
           SELECT gen_random_uuid() AS catalog_id, l.line, l.rate, l.price, l.quantity \
             FROM unnest($4::uuid[], $5::numeric[], $6::numeric[], $7::int[]) \
                  AS l(line, rate, price, quantity)), \
         catalog AS ( \
           INSERT INTO pharmacy_catalog (id, tenant_id, code, name, gst_rate, hsn_code) \
           SELECT catalog_id, $1, catalog_id::text, 'Item', rate, '3004' FROM input), \
         order_lines AS ( \
           INSERT INTO pharmacy_order_items (id, tenant_id, order_id, drug_name, catalog_item_id) \
           SELECT line, $1, $2, 'Item', catalog_id FROM input) \
         INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, quantity, \
                                    unit_price, total_price, pharmacy_order_id, source_id, source) \
         SELECT $1, $3, 'RX', 'Item', quantity, price, price * quantity, $2, line, 'pharmacy' \
           FROM input",
    )
    .bind(tenant)
    .bind(order)
    .bind(invoice)
    .bind(&lines)
    .bind(&rates)
    .bind(&prices)
    .bind(&quantities)
    .execute(db)
    .await
    .expect("seed lines");
    mrp_of
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn cgst_plus_sgst_is_the_line_tax_on_every_line() {
    let db = PgPool::connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL"))
        .await
        .unwrap();
    let (tenant, order, invoice) = order_and_invoice(&db).await;
    let mrp_of = seed_lines(&db, tenant, order, invoice).await;
    let mut conn = db.acquire().await.unwrap();
    super::tax_lines(&mut conn, tenant, order)
        .await
        .expect("tax lines");
    drop(conn);

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
