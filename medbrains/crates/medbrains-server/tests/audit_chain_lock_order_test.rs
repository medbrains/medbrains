//! A cashier and an audited clinical write must not deadlock (migration 1403).
//! The cashier is the real endpoint; the clinical write is held open by hand so
//! the two meet in the one order that closes the cycle. Each test fails every
//! time without the fix, instead of once in a hundred runs.

use crate::payments_world::{World, world};

use std::time::Duration;

use reqwest::StatusCode;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// A transaction that has made an audited write, so holds the chain lock.
async fn clinical_write(w: &World) -> Transaction<'static, Postgres> {
    let mut tx = w.app.db.begin().await.expect("begin");
    medbrains_db::pool::set_tenant_context(&mut tx, &w.tenant)
        .await
        .expect("context");
    sqlx::query(
        "INSERT INTO audit_log (tenant_id, action, entity_type) VALUES ($1, 'test', 'lock_order')",
    )
    .bind(w.tenant)
    .execute(&mut *tx)
    .await
    .expect("audited write");
    tx
}

/// Wait until the cashier's own statement is queued on the chain lock. Waiting
/// for any queued backend would be fooled by the request's other audit rows.
async fn cashier_reaches_the_chain(db: &PgPool) {
    for _ in 0..200 {
        let queued: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM pg_stat_activity \
              WHERE datname = current_database() AND wait_event = 'advisory' \
                AND (query ILIKE '%sequences%' OR query ILIKE '%invoices%' \
                     OR query ILIKE '%payments%' OR query ILIKE '%audit_chain%')",
        )
        .fetch_one(db)
        .await
        .expect("activity");
        if queued > 0 {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    unreachable!("the cashier never reached the chain lock");
}

/// The cashier's request, in the background.
fn cashier(w: &World, path: String, body: Value) -> tokio::task::JoinHandle<(StatusCode, String)> {
    let (client, url, csrf) = (w.app.client.clone(), w.app.url(&path), w.csrf.clone());
    tokio::spawn(async move {
        let response = client
            .post(url)
            .header("x-csrf-token", csrf)
            .json(&body)
            .send()
            .await
            .expect("request");
        let status = response.status();
        (status, response.text().await.unwrap_or_default())
    })
}

/// Given a clinical write holding the chain, about to number a charge, When a
/// cashier raises a bill and queues for the chain, And the clinical write then
/// numbers its charge, Then neither is killed, and both numbers are taken.
#[tokio::test]
async fn raising_a_bill_cannot_deadlock_with_a_clinical_charge() {
    let w = world().await;
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Lock', 'Order', 'female', '9000000105') RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!(
        "UH-LOCK-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .fetch_one(&w.app.db)
    .await
    .expect("patient");
    let number = "SELECT current_val FROM sequences WHERE tenant_id = $1 AND seq_type = 'INVOICE'";
    let before: i64 = sqlx::query_scalar(number)
        .bind(w.tenant)
        .fetch_one(&w.app.db)
        .await
        .expect("sequence");

    let mut clinical = clinical_write(&w).await;
    let raising = cashier(
        &w,
        "/api/billing/invoices".to_owned(),
        json!({ "patient_id": patient }),
    );
    cashier_reaches_the_chain(&w.app.db).await;
    let charged = sqlx::query(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'INVOICE'",
    )
    .bind(w.tenant)
    .execute(&mut *clinical)
    .await;
    assert!(charged.is_ok(), "the clinical charge: {charged:?}");
    clinical.commit().await.expect("clinical commit");

    let (status, body) = raising.await.expect("cashier");
    assert_eq!(status, StatusCode::OK, "{body}");
    let after: i64 = sqlx::query_scalar(number)
        .bind(w.tenant)
        .fetch_one(&w.app.db)
        .await
        .expect("sequence");
    assert_eq!(after, before + 2, "both numbers were taken");
}

/// Given a clinical write holding the chain, about to add to an open bill, When
/// the patient pays that bill and the payment queues for the chain, And the
/// clinical write then updates the bill, Then neither is killed, and the money
/// posts once.
#[tokio::test]
async fn paying_a_bill_cannot_deadlock_with_a_charge_on_it() {
    let w = world().await;
    let invoice = w.bill(1000).await;

    let mut clinical = clinical_write(&w).await;
    let paying = cashier(
        &w,
        format!("/api/billing/invoices/{invoice}/payments"),
        json!({ "amount": 400, "mode": "cash" }),
    );
    cashier_reaches_the_chain(&w.app.db).await;
    let charged = sqlx::query("UPDATE invoices SET notes = 'charged' WHERE id = $1")
        .bind(invoice)
        .execute(&mut *clinical)
        .await;
    assert!(charged.is_ok(), "the clinical charge: {charged:?}");
    clinical.commit().await.expect("clinical commit");

    let (status, body) = paying.await.expect("cashier");
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(w.payments(invoice).await.len(), 1, "the money posts once");
    assert_eq!(w.invoice(invoice).await.0, rust_decimal::Decimal::from(400));
}

/// Given a clinical write holding the chain, When a cashier pays an instalment
/// and queues for the chain, And the clinical write then charges that bill, Then
/// neither is killed, and the money posts once.
#[tokio::test]
async fn paying_an_instalment_cannot_deadlock_with_a_charge_on_the_bill() {
    let w = world().await;
    let invoice = w.bill(1000).await;
    let plan: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_installments (tenant_id, invoice_id, total_amount, \
                                           installment_count, installment_amount) \
         VALUES ($1, $2, 400, 1, 400) RETURNING id",
    )
    .bind(w.tenant)
    .bind(invoice)
    .fetch_one(&w.app.db)
    .await
    .expect("plan");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_installment_items (tenant_id, installment_id, installment_number, \
                                                due_date, amount) \
         VALUES ($1, $2, 1, current_date, 400) RETURNING id",
    )
    .bind(w.tenant)
    .bind(plan)
    .fetch_one(&w.app.db)
    .await
    .expect("item");

    let mut clinical = clinical_write(&w).await;
    let paying = cashier(
        &w,
        format!("/api/billing/installments/{plan}/items/{item}/pay"),
        json!({ "mode": "cash" }),
    );
    cashier_reaches_the_chain(&w.app.db).await;
    let charged = sqlx::query("UPDATE invoices SET notes = 'charged' WHERE id = $1")
        .bind(invoice)
        .execute(&mut *clinical)
        .await;
    assert!(charged.is_ok(), "the clinical charge: {charged:?}");
    clinical.commit().await.expect("clinical commit");

    let (status, body) = paying.await.expect("cashier");
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(w.payments(invoice).await.len(), 1, "the money posts once");
}
