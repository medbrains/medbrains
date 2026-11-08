//! A consignment implant entered both by the store (usage) and by the OT
//! (registry), in either order, against a real, migrated database: each
//! unit is billed to one patient once, whatever the order.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test stock_leakage_registry -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use common::implants::{audits, knee, name, registry_entry, row, unnamed_usage, unnamed_usage_of};
use common::stock::{consignment, leakage_desk, store_stock, ward};
use common::{insert_patient, pool, scoped, state};
use medbrains_billing::charge_attention::{
    ChargeAttentionItem, DismissRequest, ListChargeAttentionQuery, dismiss_charge_attention,
    list_charge_attention, post_charge_attention,
};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use uuid::Uuid;

/// The patients a bill line under `LKKNEE` names, one per unit billed.
async fn billed_patients(db: &sqlx::PgPool, tenant: Uuid) -> Vec<Uuid> {
    let mut patients: Vec<Uuid> = sqlx::query_scalar(
        "SELECT i.patient_id FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id \
           CROSS JOIN LATERAL generate_series(1, ii.quantity) \
          WHERE ii.tenant_id = $1 AND ii.charge_code = 'LKKNEE'",
    )
    .bind(tenant)
    .fetch_all(db)
    .await
    .unwrap();
    patients.sort();
    patients
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_two_unit_usage_and_two_entries_bill_one_unit_to_each_patient() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let item = knee(&db, w.v.tenant).await;
    let mut tx = scoped(&db, w.v.tenant).await;
    let second = insert_patient(&mut tx, w.v.tenant).await;
    tx.commit().await.unwrap();

    let usage = unnamed_usage_of(&db, &claims, batch, 2).await;
    assert_eq!(store_stock(&db, item).await, 1, "the store took both units");
    registry_entry(&db, &claims, &w, batch, w.v.patient).await;
    registry_entry(&db, &claims, &w, batch, second).await;

    assert_eq!(store_stock(&db, item).await, 1, "no unit was taken twice");
    let mut want = vec![w.v.patient, second];
    want.sort();
    assert_eq!(
        billed_patients(&db, w.v.tenant).await,
        want,
        "one unit each, 2 in all"
    );
    // The store's usage is now the second patient's one unit, posted.
    let (_, status, quantity, patient) = row(&db, usage).await;
    assert_eq!(
        (status.as_str(), quantity, patient),
        ("posted", 1, Some(second))
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_store_recording_an_implant_the_registry_already_billed_cannot_bill_it_again() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;

    // The OT enters the implant first: its usage is recorded and billed.
    registry_entry(&db, &claims, &w, batch, w.v.patient).await;
    assert_eq!(billed_patients(&db, w.v.tenant).await, vec![w.v.patient]);

    // The store then records the same implant, naming no one.
    let duplicate = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, duplicate).await;
    let listed = list_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(ListChargeAttentionQuery {
            status: Some("open".to_owned()),
            kind: Some("unbilled".to_owned()),
            page: None,
            limit: None,
        }),
    )
    .await
    .unwrap()
    .0;
    let hint = listed.data[0].registry_patients.clone().unwrap_or_default();
    let uhid: String = sqlx::query_scalar("SELECT uhid FROM patients WHERE id = $1")
        .bind(w.v.patient)
        .fetch_one(&db)
        .await
        .unwrap();
    assert!(
        hint.contains(&uhid),
        "the desk is told whose registry entry it may be: {hint}"
    );

    // Named to that patient, it cannot be posted: the registry has one implant.
    let named = name(&db, &claims, id, w.v.patient).await.unwrap().0;
    assert_eq!(named.patient_id, Some(w.v.patient));
    let posted = post_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
    )
    .await;
    assert!(matches!(posted, Err(AppError::Conflict(_))), "{posted:?}");

    // The desk dismisses it as a duplicate: the unit goes back.
    let item = knee(&db, w.v.tenant).await;
    assert_eq!(store_stock(&db, item).await, 1, "both records took a unit");
    let dismissed = dismiss(&db, &claims, id, true).await.unwrap().0;
    assert_eq!(dismissed.status, "dismissed");
    assert_eq!(
        store_stock(&db, item).await,
        2,
        "one unit taken, as one was used"
    );
    assert_eq!(batch_left(&db, batch).await, 2);
    assert_eq!(
        vendor_used(&db, batch).await,
        1,
        "the vendor's usage nets to one"
    );
    assert_eq!(
        billed_patients(&db, w.v.tenant).await,
        vec![w.v.patient],
        "billed once"
    );
    assert_eq!(
        audits(
            &db,
            w.v.tenant,
            "billing.charge_attention.duplicate_usage_reversed"
        )
        .await,
        1
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn only_a_duplicate_dismissal_gives_stock_back() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let item = knee(&db, w.v.tenant).await;
    let usage = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, usage).await;

    let dismissed = dismiss(&db, &claims, id, false).await.unwrap().0;
    assert_eq!(dismissed.status, "dismissed");
    assert_eq!(
        store_stock(&db, item).await,
        2,
        "a plain dismissal moves no stock"
    );
    assert_eq!(vendor_used(&db, batch).await, 1);

    // A duplicate flag on any other kind of row is refused.
    let other = unnamed_usage(&db, &claims, batch).await;
    let (other_id, ..) = row(&db, other).await;
    sqlx::query(
        "UPDATE charge_attention_items SET reason = 'charge_failed:database', \
                 patient_id = $2 WHERE id = $1",
    )
    .bind(other_id)
    .bind(w.v.patient)
    .execute(&db)
    .await
    .unwrap();
    let refused = dismiss(&db, &claims, other_id, true).await;
    assert!(
        matches!(refused, Err(AppError::NotFound | AppError::BadRequest(_))),
        "{refused:?}"
    );
    assert_eq!(store_stock(&db, item).await, 1);
}

/// Dismiss the row, as a duplicate usage or not.
async fn dismiss(
    db: &sqlx::PgPool,
    claims: &Claims,
    id: Uuid,
    duplicate_usage: bool,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    dismiss_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
        Json(DismissRequest {
            reason: "Duplicate of the registry's record".to_owned(),
            duplicate_usage,
        }),
    )
    .await
}

/// Units left on the batch.
async fn batch_left(db: &sqlx::PgPool, batch: Uuid) -> i32 {
    sqlx::query_scalar("SELECT quantity FROM batch_stock WHERE id = $1")
        .bind(batch)
        .fetch_one(db)
        .await
        .unwrap()
}

/// The vendor's consignment usage of the batch: units used, net of reversals.
async fn vendor_used(db: &sqlx::PgPool, batch: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(-quantity), 0)::int8 FROM store_stock_movements \
          WHERE batch_stock_id = $1 AND reference_type = 'consignment_usage' \
            AND deleted_at IS NULL",
    )
    .bind(batch)
    .fetch_one(db)
    .await
    .unwrap()
}
