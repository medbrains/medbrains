//! A supplier with more entries than are listed still gets the right
//! closing balance and totals, and an opening balance for what is not shown.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-materials --lib vendor_ledger -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used)]

use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_long_ledger_keeps_every_rupee_in_its_balance() {
    let db = PgPool::connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL"))
        .await
        .unwrap();
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Vendor ledger test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("VL{code}"))
    .fetch_one(&db)
    .await
    .unwrap();
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, 'v' || substr(md5(random()::text), 1, 12), gen_random_uuid()::text || '@vl.test', \
                 'Accounts', 'billing_clerk') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&db)
    .await
    .unwrap();
    let vendor: Uuid = sqlx::query_scalar(
        "INSERT INTO vendors (tenant_id, code, name) VALUES ($1, 'V1', 'Supplier') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&db)
    .await
    .unwrap();
    // Seven payments of ₹1 … ₹7 on seven days: ₹28 in all.
    sqlx::query(
        "INSERT INTO supplier_payments (tenant_id, vendor_id, payment_number, created_by, \
                                        paid_amount, payment_date) \
         SELECT $1, $2, 'SP-' || n, $3, n, DATE '2026-01-01' + n FROM generate_series(1, 7) n",
    )
    .bind(tenant)
    .bind(vendor)
    .bind(user)
    .execute(&db)
    .await
    .unwrap();

    let mut conn = db.acquire().await.unwrap();
    let got = super::ledger_listing(&mut conn, tenant, vendor, 3)
        .await
        .unwrap();
    drop(conn);

    let amounts: Vec<Decimal> = got.entries.iter().map(|e| e.debit).collect();
    assert_eq!(
        amounts,
        [5, 6, 7].map(Decimal::from),
        "the latest three are listed"
    );
    assert_eq!(got.total_payments, Decimal::from(28));
    assert_eq!(got.closing_balance, Decimal::from(-28));
    assert_eq!(
        got.opening_balance,
        Decimal::from(-10),
        "₹1 … ₹4 brought forward"
    );
    assert_eq!(got.earlier_entries, 4);
    assert_eq!(
        got.entries.last().map(|e| e.running_balance),
        Some(Decimal::from(-28))
    );
}
