//! The unbilled-orders check after independent review: a hand-entered line
//! on any of the patient's bills counts as billed, at the check and again at
//! Post; a hospital that bills a module by hand is not flagged; an unpriced
//! row cannot be posted; the payer rate card is picked deterministically,
//! falling back to the insurer-wide card; rate plan and tax follow the normal
//! charge path; an order cancelled after it was queued is dismissed at Post;
//! and the on-demand check is throttled.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test leakage_post -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use axum::Extension;
use axum::extract::{Path, State};
use common::orders::{Visit, encounter, lab_order, radiology_order, visit};
use common::{pool, scoped, state};
use medbrains_billing::charge_attention::post_charge_attention;
use medbrains_billing::leakage::{run_for, scan_unbilled_orders};
use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

/// Run the check, unthrottled, as the claims' user.
async fn scan(db: &PgPool, claims: &Claims) -> u64 {
    run_for(db, Actor::from_claims(claims), false)
        .await
        .expect("scan")
}

/// Run one statement under the visit's tenant.
async fn exec(db: &PgPool, v: &Visit, sql: &str) {
    let mut tx = scoped(db, v.tenant).await;
    sqlx::query(sql)
        .bind(v.tenant)
        .bind(v.patient)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
}

/// The queue row for `order`: (id, status, unit price, tax).
async fn row(db: &PgPool, order: Uuid) -> (Uuid, String, Option<Decimal>, Option<Decimal>) {
    sqlx::query_as(
        "SELECT id, status, unit_price_override, tax_percent_override \
           FROM charge_attention_items WHERE source_entity_id = $1",
    )
    .bind(order)
    .fetch_one(db)
    .await
    .unwrap()
}

async fn post(db: &PgPool, claims: &Claims, id: Uuid) -> Result<String, AppError> {
    post_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
    )
    .await
    .map(|j| j.0.status)
}

/// A hand-entered line under `code` on a bill for another visit of the patient.
async fn hand_line_elsewhere(db: &PgPool, v: &Visit, code: &str) {
    let mut tx = scoped(db, v.tenant).await;
    let other = encounter(&mut tx, v.tenant, v.patient, v.department).await;
    sqlx::query(
        "WITH inv AS (INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id) \
                      VALUES ($1, 'LK-INV-' || gen_random_uuid(), $2, $3) RETURNING id) \
         INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, \
           unit_price, total_price) SELECT $1, id, $4, 'By hand', 350, 350 FROM inv",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(other)
    .bind(code)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_hand_line_on_any_of_the_patients_bills_counts_as_billed() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    // The charge master bills the CBC as LAB-CBC; the desk used that code on
    // another visit's bill.
    exec(
        &db,
        &v,
        "INSERT INTO charge_master (tenant_id, code, name, category, base_price) \
         SELECT $1, 'LAB-CBC', 'Complete blood count', 'lab', 350 WHERE $2::uuid IS NOT NULL",
    )
    .await;
    lab_order(&db, &v, "verified", 24).await;
    hand_line_elsewhere(&db, &v, "LAB-CBC").await;
    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn post_refuses_an_order_billed_by_hand_after_it_was_queued() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    assert_eq!(scan(&db, &claims).await, 1);
    hand_line_elsewhere(&db, &v, "LKCBC").await;

    let (id, ..) = row(&db, lab).await;
    let posted = post(&db, &claims, id).await;
    assert!(matches!(posted, Err(AppError::Conflict(_))), "{posted:?}");
    assert_eq!(
        row(&db, lab).await.1,
        "open",
        "left for the desk to dismiss"
    );
    let lines: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM invoice_items WHERE source = 'lab' AND source_id = $1",
    )
    .bind(lab)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(lines, 0, "billed twice");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_module_billed_by_hand_at_the_counter_is_not_flagged() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    lab_order(&db, &v, "verified", 24).await;
    exec(
        &db,
        &v,
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         SELECT $1, 'billing', 'auto_charge_lab', 'false'::jsonb WHERE $2::uuid IS NOT NULL",
    )
    .await;
    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_unpriced_row_cannot_be_posted_and_a_zero_catalogue_price_is_unset() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    exec(
        &db,
        &v,
        "UPDATE lab_test_catalog SET price = 0 WHERE tenant_id = $1 AND $2::uuid IS NOT NULL",
    )
    .await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    assert_eq!(
        scan(&db, &claims).await,
        1,
        "a ₹0 catalogue price is not an exemption"
    );
    let (id, _, price, _) = row(&db, lab).await;
    assert_eq!(price, None);
    let posted = post(&db, &claims, id).await;
    assert!(
        matches!(&posted, Err(AppError::BadRequest(m)) if m == "Set a tariff for this service first."),
        "{posted:?}"
    );

    // With a charge-master price the ₹0 catalogue falls back to it.
    let (claims, v) = visit(&db).await;
    exec(
        &db,
        &v,
        "WITH z AS (UPDATE lab_test_catalog SET price = 0 WHERE tenant_id = $1 RETURNING 1) \
         INSERT INTO charge_master (tenant_id, code, name, category, base_price) \
         SELECT $1, 'LKCBC', 'Complete blood count', 'lab', 400 WHERE $2::uuid IS NOT NULL",
    )
    .await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    assert_eq!(scan(&db, &claims).await, 1);
    assert_eq!(row(&db, lab).await.2, Some(Decimal::from(400)));
}

/// A rate card for Star Health: `tpa` blank is insurer-wide.
async fn card(db: &PgPool, v: &Visit, tpa: &str, price: i64, valid_from_days_ago: i32) {
    let mut tx = scoped(db, v.tenant).await;
    sqlx::query(
        "WITH plan AS (INSERT INTO rate_plans (tenant_id, name) \
                       VALUES ($1, 'Card ' || gen_random_uuid()) RETURNING id), \
              item AS (INSERT INTO rate_plan_items (tenant_id, rate_plan_id, charge_code, \
                         override_price) SELECT $1, id, 'LKCBC', $3 FROM plan) \
         INSERT INTO tpa_rate_cards (tenant_id, tpa_name, insurance_provider, rate_plan_id, \
           valid_from) SELECT $1, $2, 'Star Health', id, current_date - $4 FROM plan",
    )
    .bind(v.tenant)
    .bind(tpa)
    .bind(Decimal::from(price))
    .bind(valid_from_days_ago)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

/// Insure the visit's patient with Star Health through `tpa` (or none).
async fn policy(db: &PgPool, v: &Visit, tpa: Option<&str>) {
    let mut tx = scoped(db, v.tenant).await;
    sqlx::query(
        "INSERT INTO patient_insurance (tenant_id, patient_id, insurance_provider, \
           policy_number, valid_from, valid_until, tpa_name) \
         VALUES ($1, $2, 'Star Health', 'P-' || gen_random_uuid(), current_date - 30, \
           current_date + 300, $3)",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(tpa)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

/// The queued price of one verified CBC for a fresh visit set up by `setup`.
async fn priced_with<F, Fut>(db: &PgPool, setup: F) -> Option<Decimal>
where
    F: FnOnce(PgPool, Visit) -> Fut,
    Fut: Future<Output = ()>,
{
    let (claims, v) = visit(db).await;
    let lab = lab_order(db, &v, "verified", 24).await;
    setup(db.clone(), v).await;
    assert_eq!(scan(db, &claims).await, 1);
    row(db, lab).await.2
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_rate_card_pick_is_deterministic_and_falls_back_to_the_insurer() {
    let db = pool().await;
    // Two policies of equal priority, each with its TPA's card: a TPA's own
    // card beats the insurer-wide one, and the newer card wins the tie.
    let price = priced_with(&db, |db, v| async move {
        card(&db, &v, "", 320, 10).await;
        card(&db, &v, "Medi Assist", 310, 60).await;
        card(&db, &v, "Paramount", 300, 5).await;
        policy(&db, &v, Some("Medi Assist")).await;
        policy(&db, &v, Some("Paramount")).await;
    })
    .await;
    assert_eq!(price, Some(Decimal::from(300)));
    // A TPA with no card of its own falls back to the insurer-wide card.
    let price = priced_with(&db, |db, v| async move {
        card(&db, &v, "", 320, 10).await;
        card(&db, &v, "Medi Assist", 300, 5).await;
        policy(&db, &v, Some("Star Partner TPA")).await;
    })
    .await;
    assert_eq!(price, Some(Decimal::from(320)));
    // A policy with no TPA takes only an insurer-wide card, never a TPA's.
    let price = priced_with(&db, |db, v| async move {
        card(&db, &v, "Medi Assist", 300, 5).await;
        policy(&db, &v, None).await;
    })
    .await;
    assert_eq!(price, Some(Decimal::from(350)), "the base tariff");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_rate_plan_and_tax_follow_the_normal_charge_path_to_the_bill() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let rad = radiology_order(&db, &v).await; // charge master ₹500, 0% tax
    exec(
        &db,
        &v,
        "WITH t AS (UPDATE charge_master SET tax_percent = 18 \
                     WHERE tenant_id = $1 AND code = 'RAD-LKXR' RETURNING 1), \
              plan AS (INSERT INTO rate_plans (tenant_id, name, is_default) \
                       SELECT $1, 'Default', true WHERE $2::uuid IS NOT NULL RETURNING id) \
         INSERT INTO rate_plan_items (tenant_id, rate_plan_id, charge_code, override_price, \
           override_tax_percent) SELECT $1, id, 'RAD-LKXR', 450, 12 FROM plan",
    )
    .await;
    assert_eq!(scan(&db, &claims).await, 1);
    let (id, _, price, tax) = row(&db, rad).await;
    assert_eq!(
        (price, tax),
        (Some(Decimal::from(450)), Some(Decimal::from(12)))
    );

    assert_eq!(post(&db, &claims, id).await.expect("posted"), "posted");
    let (unit, billed_tax): (Decimal, Decimal) = sqlx::query_as(
        "SELECT unit_price, tax_percent FROM invoice_items \
          WHERE source = 'radiology' AND source_id = $1",
    )
    .bind(rad)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!((unit, billed_tax), (Decimal::from(450), Decimal::from(12)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_order_cancelled_after_it_was_queued_is_dismissed_at_post() {
    let db = pool().await;
    let (claims, v) = visit(&db).await;
    let lab = lab_order(&db, &v, "verified", 24).await;
    assert_eq!(scan(&db, &claims).await, 1);
    sqlx::query("UPDATE lab_orders SET status = 'cancelled' WHERE id = $1")
        .bind(lab)
        .execute(&db)
        .await
        .unwrap();

    let (id, ..) = row(&db, lab).await;
    let posted = post(&db, &claims, id).await;
    assert!(matches!(posted, Err(AppError::Conflict(_))), "{posted:?}");
    let (status, reason): (String, Option<String>) =
        sqlx::query_as("SELECT status, dismiss_reason FROM charge_attention_items WHERE id = $1")
            .bind(id)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(
        (status.as_str(), reason.as_deref()),
        ("dismissed", Some("Order cancelled"))
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_on_demand_check_runs_once_per_ten_minutes() {
    let db = pool().await;
    let (claims, _) = visit(&db).await;
    let st = state(db.clone());
    let first = scan_unbilled_orders(State(st.clone()), Extension(claims.clone())).await;
    assert!(first.is_ok(), "{first:?}");
    let again = scan_unbilled_orders(State(st), Extension(claims)).await;
    assert!(
        matches!(again, Err(AppError::TooManyRequests(_))),
        "{again:?}"
    );
}
