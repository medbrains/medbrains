//! Stock used on a patient but never charged (revenue integrity wave 1.2):
//! the queue side, against a real, migrated database. An implant used with
//! no patient is queued for the desk to name the patient; the detector finds
//! unbilled stock once; a caller without the permission is refused; and an
//! outage is an error, never a silent ₹0.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test stock_leakage_queue -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use common::stock::{age_stock, consignment, consume, leakage_desk, lines, queue, scan, ward};
use common::{pool, scoped, state};
use medbrains_billing::charge_attention::{
    ListChargeAttentionQuery, NamePatientRequest, list_charge_attention,
    name_patient_charge_attention, post_charge_attention,
};
use medbrains_billing::leakage::run_for;
use medbrains_indent::{ConsignmentUsageRequest, record_consignment_usage};
use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_implant_used_with_no_patient_is_queued_and_the_desk_names_the_patient() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let st = state(db.clone());

    let movement = record_consignment_usage(
        State(st.clone()),
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
    .expect("the usage saves")
    .0;
    let rows = queue(&db, w.v.tenant).await;
    assert_eq!(
        rows,
        vec![(
            movement.id,
            "implant_no_patient".to_owned(),
            "consignment".to_owned(),
            None
        )]
    );
    let page = list_charge_attention(
        State(st.clone()),
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
    let row = &page.data[0];
    assert_eq!(row.patient_id, None);
    assert_eq!(row.amount, Some(Decimal::from(85000)));
    assert!(
        row.description_override
            .as_deref()
            .unwrap()
            .contains("batch K-77"),
        "the row names the batch, so the vendor"
    );

    // Not postable until a patient is named.
    let early =
        post_charge_attention(State(st.clone()), Extension(claims.clone()), Path(row.id)).await;
    assert!(matches!(early, Err(AppError::Conflict(_))), "{early:?}");

    let named = name_patient_charge_attention(
        State(st.clone()),
        Extension(claims.clone()),
        Path(row.id),
        Json(NamePatientRequest {
            patient_id: w.v.patient,
        }),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(named.patient_id, Some(w.v.patient));
    assert_eq!(
        named.encounter_id,
        Some(w.v.encounter),
        "the admission's bill"
    );
    let linked: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM store_stock_movements WHERE id = $1")
            .bind(movement.id)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(
        linked,
        Some(w.v.patient),
        "the consignment record names the patient"
    );

    let posted = post_charge_attention(State(st), Extension(claims.clone()), Path(row.id))
        .await
        .unwrap()
        .0;
    assert_eq!(posted.status, "posted");
    assert_eq!(
        lines(&db, movement.id).await,
        vec![(1, Decimal::from(85000))]
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_detector_finds_unbilled_stock_once() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKSYRINGE", 30, true).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let mut tx = scoped(&db, w.v.tenant).await;
    // Recorded with no charge: billable ward stock, and a consignment implant
    // used on the patient (as before this change, when a failed charge was lost).
    let use_id: Uuid = sqlx::query_scalar(
        "INSERT INTO ward_stock_consumptions (tenant_id, department_id, catalog_item_id, \
           quantity, patient_id, encounter_id, admission_id, consumed_by) \
         VALUES ($1, $2, $3, 3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(w.v.tenant)
    .bind(w.v.department)
    .bind(w.item)
    .bind(w.v.patient)
    .bind(w.v.encounter)
    .bind(w.admission)
    .bind(w.v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let usage: Uuid = sqlx::query_scalar(
        "INSERT INTO store_stock_movements (tenant_id, catalog_item_id, movement_type, \
           quantity, batch_stock_id, patient_id, reference_type, created_by) \
         SELECT $1, catalog_item_id, 'issue', -1, id, $3, 'consignment_usage', $4 \
           FROM batch_stock WHERE id = $2 RETURNING id",
    )
    .bind(w.v.tenant)
    .bind(batch)
    .bind(w.v.patient)
    .bind(w.v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    // Inside the grace window: still the desk's to bill.
    assert_eq!(scan(&db, &claims).await, 0);
    age_stock(&db, w.v.tenant, 5).await;
    assert_eq!(scan(&db, &claims).await, 2);
    assert_eq!(scan(&db, &claims).await, 0, "re-running adds nothing");
    let mut rows = queue(&db, w.v.tenant).await;
    rows.sort();
    let mut want = vec![
        (
            use_id,
            "unbilled_consumption".to_owned(),
            "ward_stock".to_owned(),
            Some(w.v.patient),
        ),
        (
            usage,
            "unbilled_consumption".to_owned(),
            "consignment".to_owned(),
            Some(w.v.patient),
        ),
    ];
    want.sort();
    assert_eq!(rows, want);

    // Posting re-checks and bills the quantity at the catalogue price.
    let id: Uuid =
        sqlx::query_scalar("SELECT id FROM charge_attention_items WHERE source_entity_id = $1")
            .bind(use_id)
            .fetch_one(&db)
            .await
            .unwrap();
    let posted = post_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
    )
    .await
    .expect("posted");
    assert_eq!(posted.0.status, "posted");
    assert_eq!(lines(&db, use_id).await, vec![(3, Decimal::from(30))]);
    assert_eq!(scan(&db, &claims).await, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_permission_nothing_is_used_named_or_posted() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKSWAB", 10, true).await;
    let batch = consignment(&db, &w.v).await;
    let st = state(db.clone());
    let usage = record_consignment_usage(
        State(st.clone()),
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
    .unwrap()
    .0;
    assert_eq!(usage.patient_id, None);
    let row: Uuid =
        sqlx::query_scalar("SELECT id FROM charge_attention_items WHERE tenant_id = $1")
            .bind(w.v.tenant)
            .fetch_one(&db)
            .await
            .unwrap();

    // A nurse without the stores grant cannot use ward stock.
    let mut nurse = claims.clone();
    nurse.role = "nurse".to_owned();
    nurse.permissions.clear();
    let used = consume(&db, &nurse, &w, w.item, Some(w.v.patient)).await;
    assert!(matches!(used, Err(AppError::Forbidden)), "{used:?}");

    // The failed-charge desk does not see or work the implant row.
    let mut clerk = claims.clone();
    clerk.role = "billing_clerk".to_owned();
    let named = name_patient_charge_attention(
        State(st.clone()),
        Extension(clerk.clone()),
        Path(row),
        Json(NamePatientRequest {
            patient_id: w.v.patient,
        }),
    )
    .await;
    assert!(matches!(named, Err(AppError::NotFound)), "{named:?}");
    let post = post_charge_attention(State(st), Extension(clerk), Path(row)).await;
    assert!(matches!(post, Err(AppError::NotFound)), "{post:?}");
    let still: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM charge_attention_items WHERE id = $1")
            .bind(row)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(still, None);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_outage_is_an_error_never_a_silent_zero() {
    let db = pool().await;
    let (claims, w) = ward(&db, "LKDOWN", 50, true).await;
    let down = pool().await;
    down.close().await;

    let used = consume(&down, &claims, &w, w.item, None).await;
    assert!(
        used.is_err(),
        "an outage read as a use with nothing to charge"
    );
    assert!(
        run_for(&down, Actor::from_claims(&claims), false)
            .await
            .is_err(),
        "an outage read as no unbilled stock"
    );
}
