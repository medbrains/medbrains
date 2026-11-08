//! The unbilled-orders check against a real, migrated database, one test per
//! scenario in the PR: orders done and unbilled are queued with their tariff,
//! payer rate, department and age; packages, bills already raised, cancelled
//! orders, exemptions and camp orders are not; re-running adds nothing; a
//! caller without the permission sees and works none of it; and an outage is
//! an error, never an empty queue.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test leakage -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use common::orders::{lab_order, payer_rate, procedure_order, radiology_order, visit};
use common::{pool, scoped, state};
use medbrains_billing::charge_attention::{
    ChargeAttentionSummaryQuery, DismissRequest, ListChargeAttentionQuery,
    charge_attention_summary, dismiss_charge_attention, list_charge_attention,
    post_charge_attention,
};
use medbrains_billing::leakage::{run_for, scan_unbilled_orders};
use medbrains_core::permissions;
use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

/// Run the check as the claims' user.
async fn scan(db: &PgPool, claims: &Claims) -> u64 {
    run_for(db, Actor::from_claims(claims)).await.expect("scan")
}

/// The open unbilled-order rows: (order, amount, age in days, department).
async fn open_rows(
    db: &PgPool,
    claims: &Claims,
) -> Vec<(Uuid, Option<Decimal>, i32, Option<Uuid>)> {
    let page = list_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(list_query(Some("unbilled"))),
    )
    .await
    .expect("list")
    .0;
    page.data
        .into_iter()
        .map(|r| (r.source_entity_id, r.amount, r.age_days, r.department_id))
        .collect()
}

fn list_query(kind: Option<&str>) -> ListChargeAttentionQuery {
    ListChargeAttentionQuery {
        status: Some("open".to_owned()),
        kind: kind.map(str::to_owned),
        page: None,
        limit: None,
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn done_unbilled_orders_are_queued_with_tariff_department_and_age() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let lab = lab_order(&db, &v, "verified", 72).await;
    let rad = radiology_order(&db, &v).await;
    let (proc, _) = procedure_order(&db, &v).await;

    assert_eq!(scan(&db, &claims).await, 3);
    let rows = open_rows(&db, &claims).await;
    // Largest amount first.
    assert_eq!(
        rows.iter().map(|r| (r.0, r.1)).collect::<Vec<_>>(),
        vec![
            (rad, Some(Decimal::from(500))),
            (lab, Some(Decimal::from(350))),
            (proc, Some(Decimal::from(200)))
        ]
    );
    let lab_row = rows.iter().find(|r| r.0 == lab).unwrap();
    assert_eq!(lab_row.2, 3, "age in days counts from verification");
    assert_eq!(lab_row.3, Some(v.department));

    let summary = charge_attention_summary(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(ChargeAttentionSummaryQuery {
            kind: Some("unbilled".to_owned()),
        }),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(summary.open_count, 3);
    assert_eq!(summary.open_amount, Some(Decimal::from(1050)));

    // Post the lab row: the bill gets the tariff amount under the order's id.
    let id: Uuid =
        sqlx::query_scalar("SELECT id FROM charge_attention_items WHERE source_entity_id = $1")
            .bind(lab)
            .fetch_one(&db)
            .await
            .unwrap();
    let posted = post_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
    )
    .await
    .expect("posted")
    .0;
    assert_eq!(posted.status, "posted");
    let price: Decimal = sqlx::query_scalar(
        "SELECT unit_price FROM invoice_items WHERE source = 'lab' AND source_id = $1",
    )
    .bind(lab)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(price, Decimal::from(350));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_patients_payer_rate_card_prices_the_row() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    payer_rate(&db, &v, "LKCBC", 300).await;

    assert_eq!(scan(&db, &claims).await, 1);
    assert_eq!(open_rows(&db, &claims).await[0].0, lab);
    assert_eq!(open_rows(&db, &claims).await[0].1, Some(Decimal::from(300)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn package_covered_orders_are_not_flagged() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    lab_order(&db, &v, "verified", 24).await;
    let (_, procedure) = procedure_order(&db, &v).await;
    let mut tx = scoped(&db, v.tenant).await;
    // The patient's health package includes the dressing.
    sqlx::query(
        "WITH pkg AS (INSERT INTO doctor_packages (tenant_id, code, name, total_price) \
                      VALUES ($1, 'LKPKG', 'Wound care', 1000) RETURNING id), \
              inc AS (INSERT INTO doctor_package_inclusions (tenant_id, package_id, \
                        inclusion_type, procedure_id, included_quantity) \
                      SELECT $1, id, 'procedure', $3, 5 FROM pkg) \
         INSERT INTO patient_package_subscriptions (tenant_id, package_id, patient_id, \
           purchased_at, valid_until, total_paid) \
         SELECT $1, id, $2, now() - interval '10 days', now() + interval '80 days', 1000 FROM pkg",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(procedure)
    .execute(&mut *tx)
    .await
    .unwrap();
    // The visit's bill carries a billing package that lists the CBC.
    sqlx::query(
        "WITH bp AS (INSERT INTO billing_packages (tenant_id, code, name, total_price) \
                     VALUES ($1, 'LKDAYCARE', 'Day care', 5000) RETURNING id), \
              bpi AS (INSERT INTO billing_package_items (tenant_id, package_id, charge_code, \
                        description, unit_price) SELECT $1, id, 'LKCBC', 'CBC', 0 FROM bp), \
              inv AS (INSERT INTO invoices (tenant_id, invoice_number, patient_id, \
                        encounter_id) VALUES ($1, 'LK-INV-' || gen_random_uuid(), $2, $3) \
                      RETURNING id) \
         INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, \
           unit_price, total_price) SELECT $1, id, 'LKDAYCARE', 'Day care', 5000, 5000 FROM inv",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(v.encounter)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn already_billed_orders_are_not_flagged() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    radiology_order(&db, &v).await;
    let mut tx = scoped(&db, v.tenant).await;
    // The CBC by its order id; the X-ray by hand, its charge code only.
    sqlx::query(
        "WITH inv AS (INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id) \
                      VALUES ($1, 'LK-INV-' || gen_random_uuid(), $2, $3) RETURNING id) \
         INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, source, \
           source_id, unit_price, total_price) \
         SELECT $1, id, 'LKCBC', 'CBC', 'lab'::charge_source, $4, 350, 350 FROM inv \
         UNION ALL \
         SELECT $1, id, 'RAD-LKXR', 'X-ray', 'manual'::charge_source, NULL::uuid, 500, 500 \
           FROM inv",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(v.encounter)
    .bind(lab)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn cancelled_recent_exempt_and_camp_orders_are_not_flagged() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    lab_order(&db, &v, "cancelled", 24).await;
    lab_order(&db, &v, "verified", 1).await; // inside the grace window
    let camp = lab_order(&db, &v, "verified", 24).await;
    sqlx::query("UPDATE lab_orders SET camp_id = gen_random_uuid() WHERE id = $1")
        .bind(camp)
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(scan(&db, &claims).await, 0);

    // A scheme that prices the dressing at ₹0 exempts it.
    procedure_order(&db, &v).await;
    payer_rate(&db, &v, "LKDRESS", 0).await;
    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn rerunning_adds_nothing_and_a_dismissed_order_stays_dismissed() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    assert_eq!(scan(&db, &claims).await, 1);
    assert_eq!(scan(&db, &claims).await, 0);

    let id: Uuid =
        sqlx::query_scalar("SELECT id FROM charge_attention_items WHERE source_entity_id = $1")
            .bind(lab)
            .fetch_one(&db)
            .await
            .unwrap();
    let dismissed = dismiss_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
        Json(DismissRequest {
            reason: "Package-included".to_owned(),
        }),
    )
    .await
    .expect("dismissed")
    .0;
    assert_eq!(dismissed.status, "dismissed");
    assert_eq!(scan(&db, &claims).await, 0);
    let rows: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM charge_attention_items WHERE tenant_id = $1")
            .bind(v.tenant)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(rows, 1);
    // The run itself is on the audit chain.
    let runs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE tenant_id = $1 AND action = 'billing.leakage.scan'",
    )
    .bind(v.tenant)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(runs, 3);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_leakage_permission_the_rows_are_neither_seen_nor_worked() {
    let db = pool().await;
    let (mut claims, v) = visit(&db).await;
    lab_order(&db, &v, "verified", 24).await;
    assert_eq!(scan(&db, &claims).await, 1);
    let id: Uuid = sqlx::query_scalar("SELECT id FROM charge_attention_items WHERE tenant_id = $1")
        .bind(v.tenant)
        .fetch_one(&db)
        .await
        .unwrap();

    // The desk that works failed charges, but not leakage.
    claims.role = "billing_clerk".to_owned();
    claims.permissions = vec![
        permissions::billing::charge_attention::VIEW.to_owned(),
        permissions::billing::charge_attention::RESOLVE.to_owned(),
    ];
    let st = state(db.clone());
    let scanned = scan_unbilled_orders(State(st.clone()), Extension(claims.clone())).await;
    assert!(
        matches!(scanned, Err(AppError::Forbidden)),
        "scan: {scanned:?}"
    );
    let list = list_charge_attention(
        State(st.clone()),
        Extension(claims.clone()),
        Query(list_query(None)),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(list.meta.total, 0, "a leakage row was shown");
    let post = post_charge_attention(State(st.clone()), Extension(claims.clone()), Path(id)).await;
    assert!(matches!(post, Err(AppError::NotFound)), "post: {post:?}");

    claims.permissions.clear();
    let list = list_charge_attention(State(st), Extension(claims), Query(list_query(None))).await;
    assert!(matches!(list, Err(AppError::Forbidden)), "list");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_outage_is_an_error_never_an_empty_queue() {
    let db = pool().await;
    let (claims, _) = visit(&db).await;
    let down = pool().await;
    down.close().await;

    let list = list_charge_attention(
        State(state(down.clone())),
        Extension(claims.clone()),
        Query(list_query(Some("unbilled"))),
    )
    .await;
    assert!(list.is_err(), "an outage read as an empty queue");
    let summary = charge_attention_summary(
        State(state(down.clone())),
        Extension(claims.clone()),
        Query(ChargeAttentionSummaryQuery { kind: None }),
    )
    .await;
    assert!(summary.is_err(), "an outage read as ₹0 unbilled");
    assert!(run_for(&down, Actor::from_claims(&claims)).await.is_err());
}
