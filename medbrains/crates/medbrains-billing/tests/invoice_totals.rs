//! An invoice's header adds up, against a real, migrated database: over
//! random invoices of one to eight lines, subtotal + tax is the total to the
//! paisa, and the total is the sum of the stored lines. Before the fix the
//! header summed unrounded tax beside rounded line totals and about a third
//! of invoices were a paisa out.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test invoice_totals -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_server_services::billing::{AutoChargeInput, auto_charge};
use rust_decimal::Decimal;
use uuid::Uuid;

mod common;

use common::{fixture, insert_patient, pool, scoped};

/// A small deterministic generator, so a failure names a reproducible invoice.
struct Lcg(u64);

impl Lcg {
    fn next(&mut self, below: u64) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1);
        (self.0 >> 33) % below
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn subtotal_plus_tax_is_the_total_on_every_invoice() {
    let db = pool().await;
    let (claims, _) = fixture(&db).await;
    let mut rng = Lcg(5_270);
    let rates = [0, 5, 12, 18, 28];
    let mut tx = scoped(&db, claims.tenant_id).await;
    let mut patients = Vec::new();
    for _ in 0..60 {
        let patient = insert_patient(&mut tx, claims.tenant_id).await;
        for _ in 0..=rng.next(8) {
            let input = AutoChargeInput {
                patient_id: patient,
                charge_code: "MISC".to_owned(),
                source: "manual".to_owned(),
                source_id: Uuid::new_v4(),
                quantity: i32::try_from(1 + rng.next(5)).unwrap(),
                unit_price_override: Some(Decimal::new(
                    i64::try_from(1 + rng.next(99_999)).unwrap(),
                    2,
                )),
                tax_percent_override: Some(Decimal::from(
                    rates[usize::try_from(rng.next(5)).unwrap()],
                )),
                ..Default::default()
            };
            auto_charge(&mut tx, &claims.tenant_id, input)
                .await
                .expect("charge");
        }
        patients.push(patient);
    }
    tx.commit().await.unwrap();

    let rows: Vec<(Uuid, Decimal, Decimal, Decimal, Decimal)> = sqlx::query_as(
        "SELECT i.id, i.subtotal, i.tax_amount, i.total_amount, \
                (SELECT SUM(total_price) FROM invoice_items ii WHERE ii.invoice_id = i.id) \
           FROM invoices i WHERE i.patient_id = ANY($1)",
    )
    .bind(&patients)
    .fetch_all(&db)
    .await
    .unwrap();
    assert_eq!(rows.len(), patients.len());
    let off: Vec<_> = rows
        .iter()
        .filter(|(_, sub, tax, total, lines)| sub + tax != *total || total != lines)
        .collect();
    assert!(
        off.is_empty(),
        "{} of {} invoices do not add up, e.g. {:?}",
        off.len(),
        rows.len(),
        off.first()
    );
}
