//! Partial reversals of an invoice line, against a real, migrated database:
//! however a line's quantity is split into returns, the reversals add up to
//! the line exactly, total and every GST head. Before the fix each partial
//! was the line's amount × q/Q rounded on its own, so three returns of one
//! could credit a paisa more or less than was charged.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test partial_reversals -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_server_services::billing::{
    AutoChargeInput, auto_charge, reverse_invoice_item_by_id_in_tx,
};
use rust_decimal::Decimal;
use uuid::Uuid;

mod common;

use common::{fixture, pool, scoped};

/// A small deterministic generator, so a failure names a reproducible line.
struct Lcg(u64);

impl Lcg {
    fn next(&mut self, below: u64) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1);
        (self.0 >> 33) % below
    }

    fn paise(&mut self, below: u64) -> Decimal {
        Decimal::new(i64::try_from(1 + self.next(below)).unwrap(), 2)
    }
}

type Amounts = (Decimal, Decimal, Decimal, Decimal);

const AMOUNTS: &str = "SELECT COALESCE(SUM(total_price), 0), COALESCE(SUM(cgst_amount), 0), \
     COALESCE(SUM(sgst_amount), 0), COALESCE(SUM(igst_amount), 0) FROM invoice_items";

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn any_split_of_a_line_into_returns_sums_to_the_line() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let mut rng = Lcg(717);
    let mut off = Vec::new();
    for case in 0..40 {
        let mut tx = scoped(&db, claims.tenant_id).await;
        let quantity = i32::try_from(2 + rng.next(9)).unwrap();
        let input = AutoChargeInput {
            patient_id: patient,
            charge_code: "MISC".to_owned(),
            source: "manual".to_owned(),
            source_id: Uuid::new_v4(),
            quantity,
            unit_price_override: Some(rng.paise(2_000)),
            tax_percent_override: Some(Decimal::from(
                [5, 12, 18][usize::try_from(rng.next(3)).unwrap()],
            )),
            ..Default::default()
        };
        let item = auto_charge(&mut tx, &claims.tenant_id, input)
            .await
            .unwrap()
            .item_id;
        sqlx::query(
            "UPDATE invoice_items SET cgst_amount = $2, sgst_amount = $3, igst_amount = $4 WHERE id = $1",
        )
        .bind(item)
        .bind(rng.paise(9_999))
        .bind(rng.paise(9_999))
        .bind(rng.paise(9_999))
        .execute(&mut *tx)
        .await
        .unwrap();
        let mut left = quantity;
        while left > 0 {
            let part = i32::try_from(1 + rng.next(u64::try_from(left).unwrap())).unwrap();
            reverse_invoice_item_by_id_in_tx(
                &mut tx,
                &claims.tenant_id,
                item,
                Some(part),
                claims.sub,
                "returned",
                "test",
                Uuid::new_v4(),
            )
            .await
            .unwrap()
            .expect("a reversal");
            left -= part;
        }
        let line: Amounts = sqlx::query_as(&format!("{AMOUNTS} WHERE id = $1"))
            .bind(item)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        let reversed: Amounts = sqlx::query_as(&format!("{AMOUNTS} WHERE reversal_of_id = $1"))
            .bind(item)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let negated = (-reversed.0, -reversed.1, -reversed.2, -reversed.3);
        if negated != line {
            off.push((case, line, negated));
        }
    }
    assert!(
        off.is_empty(),
        "{} of 40 lines did not reverse exactly, e.g. {:?}",
        off.len(),
        off.first()
    );
}
