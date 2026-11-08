//! The findings of the independent review of #5265, each a scenario against
//! a real, migrated database:
//! - a consignment implant is billed once, by its usage, even when the OT
//!   also enters it in the registry;
//! - stock returned before its charge is posted is never billed;
//! - turning an item's billable flag on later never bills old uses;
//! - the desk may change the named patient, audited;
//! - another hospital's patient is not found;
//! - a ₹0 implant cannot be posted.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test stock_leakage_review -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use axum::extract::{Path, State};
use axum::{Extension, Json};
use common::stock::{
    Ward, age_stock, consignment, consignment_priced, consume, failing_code, leakage_desk,
    lift_fault, lines, refuse_failing_codes, scan, store_item, store_stock, ward,
};
use common::{fixture, insert_patient, pool, scoped, state};
use medbrains_billing::charge_attention::{
    NamePatientRequest, name_patient_charge_attention, post_charge_attention,
};
use medbrains_core::inventory::ImplantRegistryEntry;
use medbrains_indent::implants::create_implant_entry;
use medbrains_indent::{
    ConsignmentUsageRequest, CreateImplantRequest, IssueToPatientRequest, ReturnToStoreRequest,
    issue_to_patient, record_consignment_usage, return_to_store,
};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_ward_stock::consume::ConsumeCharge;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

/// The store records one knee implant of `batch` used, naming no one.
async fn unnamed_usage(db: &PgPool, claims: &Claims, batch: Uuid) -> Uuid {
    record_consignment_usage(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(ConsignmentUsageRequest {
            batch_stock_id: batch,
            quantity: 1,
            patient_id: None,
            encounter_id: None,
            admission_id: None,
            notes: None,
        }),
    )
    .await
    .expect("usage saves")
    .0
    .id
}

/// The OT nurse enters an implant of `batch` in the registry for `patient`.
async fn registry_entry(
    db: &PgPool,
    claims: &Claims,
    w: &Ward,
    batch: Uuid,
    patient: Uuid,
) -> ImplantRegistryEntry {
    create_implant_entry(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(CreateImplantRequest {
            catalog_item_id: knee(db, w.v.tenant).await,
            batch_stock_id: Some(batch),
            patient_id: patient,
            serial_number: Some("SN-1".to_owned()),
            implant_date: "2026-11-08".to_owned(),
            implant_site: Some("Left knee".to_owned()),
            surgeon_id: None,
            manufacturer: None,
            model_number: None,
            warranty_expiry: None,
            notes: None,
        }),
    )
    .await
    .expect("entry saves")
    .0
}

/// The knee implant store item of the tenant.
async fn knee(db: &PgPool, tenant: Uuid) -> Uuid {
    sqlx::query_scalar("SELECT id FROM store_catalog WHERE tenant_id = $1 AND code = 'LKKNEE'")
        .bind(tenant)
        .fetch_one(db)
        .await
        .unwrap()
}

/// Every bill line of the tenant under `code`: (source, source id, quantity).
async fn code_lines(db: &PgPool, tenant: Uuid, code: &str) -> Vec<(String, Uuid, i32)> {
    sqlx::query_as(
        "SELECT source::text, source_id, quantity FROM invoice_items \
          WHERE tenant_id = $1 AND charge_code = $2",
    )
    .bind(tenant)
    .bind(code)
    .fetch_all(db)
    .await
    .unwrap()
}

/// The queue row for `source`: (id, status, quantity, patient).
async fn row(db: &PgPool, source: Uuid) -> (Uuid, String, i32, Option<Uuid>) {
    sqlx::query_as(
        "SELECT id, status, quantity, patient_id FROM charge_attention_items \
          WHERE source_entity_id = $1",
    )
    .bind(source)
    .fetch_one(db)
    .await
    .unwrap()
}

/// Audit rows of the tenant under `action`.
async fn audits(db: &PgPool, tenant: Uuid, action: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM audit_log WHERE tenant_id = $1 AND action = $2")
        .bind(tenant)
        .bind(action)
        .fetch_one(db)
        .await
        .unwrap()
}

/// Name `patient` on the queue row `id`.
async fn name(
    db: &PgPool,
    claims: &Claims,
    id: Uuid,
    patient: Uuid,
) -> Result<Json<medbrains_billing::charge_attention::ChargeAttentionItem>, AppError> {
    name_patient_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
        Json(NamePatientRequest {
            patient_id: patient,
        }),
    )
    .await
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_implant_used_then_entered_in_the_registry_is_billed_once_to_that_patient() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let item = knee(&db, w.v.tenant).await;

    let movement = unnamed_usage(&db, &claims, batch).await;
    assert_eq!(store_stock(&db, item).await, 2);
    let entry = registry_entry(&db, &claims, &w, batch, w.v.patient).await;

    assert_eq!(store_stock(&db, item).await, 2, "the stock was taken once");
    assert_eq!(
        code_lines(&db, w.v.tenant, "LKKNEE").await,
        vec![("consumable".to_owned(), movement, 1)],
        "one charge, by the usage, none by the registry entry {}",
        entry.id
    );
    let (_, status, _, patient) = row(&db, movement).await;
    assert_eq!((status.as_str(), patient), ("posted", Some(w.v.patient)));
    let named: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM store_stock_movements WHERE id = $1")
            .bind(movement)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(named, Some(w.v.patient));
    assert_eq!(
        audits(&db, w.v.tenant, "indent.consignment_usage.patient_named").await,
        1
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_registry_entry_with_no_usage_records_the_usage_and_bills_once() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    let batch = consignment(&db, &w.v).await;
    let item = knee(&db, w.v.tenant).await;

    registry_entry(&db, &claims, &w, batch, w.v.patient).await;
    assert_eq!(store_stock(&db, item).await, 2);
    let billed = code_lines(&db, w.v.tenant, "LKKNEE").await;
    assert_eq!(billed.len(), 1, "{billed:?}");
    assert_eq!(billed[0].0, "consumable");
    assert_eq!(
        audits(&db, w.v.tenant, "indent.consignment_usage.recorded").await,
        1
    );
}

/// Issue `quantity` of a store item whose charges fail until lifted.
/// Returns (item code, issue id).
async fn failing_issue(db: &PgPool, claims: &Claims, w: &Ward, quantity: i32) -> (String, Uuid) {
    refuse_failing_codes(db).await;
    let code = failing_code();
    let item = store_item(db, &w.v, &code, 40).await;
    let issue = issue_to_patient(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(IssueToPatientRequest {
            patient_id: w.v.patient,
            catalog_item_id: item,
            batch_stock_id: None,
            department_id: Some(w.v.department),
            encounter_id: None,
            admission_id: None,
            quantity,
            unit_price: Some(Decimal::from(40)),
            is_chargeable: Some(true),
            notes: None,
        }),
    )
    .await
    .expect("the issue saves")
    .0;
    (code, issue.id)
}

/// Return `quantity` of the issue to the store.
async fn give_back(db: &PgPool, claims: &Claims, w: &Ward, issue: Uuid, quantity: i32) {
    let item: Uuid =
        sqlx::query_scalar("SELECT catalog_item_id FROM patient_consumable_issues WHERE id = $1")
            .bind(issue)
            .fetch_one(db)
            .await
            .unwrap();
    let back = return_to_store(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(ReturnToStoreRequest {
            catalog_item_id: item,
            quantity,
            department_id: Some(w.v.department),
            patient_consumable_id: Some(issue),
            notes: None,
        }),
    )
    .await
    .expect("returned")
    .0;
    assert_eq!(back.quantity, quantity);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn stock_returned_before_its_charge_posts_is_never_billed() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    let (code, issue) = failing_issue(&db, &claims, &w, 5).await;
    let (id, status, quantity, _) = row(&db, issue).await;
    assert_eq!(
        (status.as_str(), quantity),
        ("open", 5),
        "the failed charge is queued"
    );

    give_back(&db, &claims, &w, issue, 2).await;
    assert_eq!(row(&db, issue).await.2, 3, "the queue follows the return");

    lift_fault(&db, &code).await;
    let posted = post_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
    )
    .await
    .expect("posted");
    assert_eq!(posted.0.status, "posted");
    assert_eq!(lines(&db, issue).await, vec![(3, Decimal::from(40))]);

    // All of it back: the failed charge is dismissed, nothing billed.
    let (_, all_back) = failing_issue(&db, &claims, &w, 2).await;
    give_back(&db, &claims, &w, all_back, 2).await;
    assert_eq!(row(&db, all_back).await.1, "dismissed");
    assert!(lines(&db, all_back).await.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn post_bills_only_what_is_left_of_stock_the_check_found() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let item = store_item(&db, &w.v, "LKGAUZE", 40).await;
    let mut tx = scoped(&db, w.v.tenant).await;
    // Issued with no charge, as before charge_or_queue.
    let issue: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_consumable_issues (tenant_id, patient_id, catalog_item_id, \
           department_id, quantity, unit_price, is_chargeable, issued_by) \
         VALUES ($1, $2, $3, $4, 5, 40, true, $5) RETURNING id",
    )
    .bind(w.v.tenant)
    .bind(w.v.patient)
    .bind(item)
    .bind(w.v.department)
    .bind(w.v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 1);
    let (id, _, quantity, _) = row(&db, issue).await;
    assert_eq!(quantity, 5);

    // Two come back after the check ran, outside the return screen.
    sqlx::query("UPDATE patient_consumable_issues SET returned_qty = 2 WHERE id = $1")
        .bind(issue)
        .execute(&db)
        .await
        .unwrap();
    post_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
    )
    .await
    .expect("posted");
    assert_eq!(lines(&db, issue).await, vec![(3, Decimal::from(40))]);
    assert_eq!(row(&db, issue).await.2, 3, "the row says what was billed");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn turning_an_item_billable_later_never_bills_old_uses() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKFLUSH", 25, false).await;
    let old = consume(&db, &claims, &w, w.item, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(old.charge, ConsumeCharge::NotBillable);

    sqlx::query("UPDATE pharmacy_catalog SET is_patient_billable = true WHERE id = $1")
        .bind(w.item)
        .execute(&db)
        .await
        .unwrap();
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(
        scan(&db, &claims).await,
        0,
        "an old use was raised as a leak"
    );
    let new = consume(&db, &claims, &w, w.item, Some(w.v.patient))
        .await
        .unwrap();
    assert_eq!(new.charge, ConsumeCharge::Posted);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_desk_can_change_the_named_patient_and_each_naming_is_audited() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let movement = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, movement).await;
    let mut tx = scoped(&db, w.v.tenant).await;
    let other = insert_patient(&mut tx, w.v.tenant).await;
    let third = insert_patient(&mut tx, w.v.tenant).await;
    tx.commit().await.unwrap();

    name(&db, &claims, id, w.v.patient).await.unwrap();
    let renamed = name(&db, &claims, id, other).await.unwrap().0;
    assert_eq!(renamed.patient_id, Some(other));
    let on_usage: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM store_stock_movements WHERE id = $1")
            .bind(movement)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(on_usage, Some(other));
    assert_eq!(
        audits(&db, w.v.tenant, "billing.charge_attention.patient_named").await,
        2
    );

    // The usage record now names someone the row does not: refused.
    sqlx::query("UPDATE store_stock_movements SET patient_id = $2 WHERE id = $1")
        .bind(movement)
        .bind(third)
        .execute(&db)
        .await
        .unwrap();
    let refused = name(&db, &claims, id, w.v.patient).await;
    assert!(matches!(refused, Err(AppError::Conflict(_))), "{refused:?}");
    assert_eq!(
        row(&db, movement).await.3,
        Some(other),
        "the row is unchanged"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn another_hospitals_patient_is_not_found() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKBANDAGE", 30, true).await;
    leakage_desk(&mut claims);
    let (_, stranger) = fixture(&db).await;
    let batch = consignment(&db, &w.v).await;
    let movement = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, movement).await;

    let named = name(&db, &claims, id, stranger).await;
    assert!(matches!(named, Err(AppError::NotFound)), "{named:?}");
    let used = consume(&db, &claims, &w, w.item, Some(stranger)).await;
    assert!(matches!(used, Err(AppError::NotFound)), "{used:?}");
    assert_eq!(row(&db, movement).await.3, None);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_implant_with_no_price_cannot_be_posted() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment_priced(&db, &w.v, 0).await;
    let movement = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, movement).await;
    name(&db, &claims, id, w.v.patient).await.unwrap();

    let posted = post_charge_attention(State(state(db.clone())), Extension(claims), Path(id)).await;
    assert!(matches!(posted, Err(AppError::BadRequest(_))), "{posted:?}");
    assert!(lines(&db, movement).await.is_empty());
}
