//! A desk cannot put an implant that is inside a patient back on the shelf
//! by calling a real usage a duplicate (#5265 review), against a real,
//! migrated database. Returning stock needs a registry entry near the usage,
//! must leave the named patient their registry implants, and needs the
//! store's stock permission.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test stock_leakage_duplicate -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod common;

use axum::extract::{Path, State};
use axum::{Extension, Json};
use common::implants::{knee, registry_entry, row, unnamed_usage};
use common::stock::{consignment, consignment_priced, leakage_desk, store_stock, ward};
use common::{pool, state};
use medbrains_billing::charge_attention::{
    ChargeAttentionItem, DismissRequest, dismiss_charge_attention,
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use sqlx::PgPool;
use uuid::Uuid;

/// Dismiss the row as a duplicate usage.
async fn dismiss_duplicate(
    db: &PgPool,
    claims: &Claims,
    id: Uuid,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    dismiss_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
        Json(DismissRequest {
            reason: "Duplicate of the registry's record".to_owned(),
            duplicate_usage: true,
        }),
    )
    .await
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_real_usage_with_no_registry_match_is_not_returned() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let item = knee(&db, w.v.tenant).await;
    let usage = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, usage).await;

    let refused = dismiss_duplicate(&db, &claims, id).await;
    assert!(matches!(refused, Err(AppError::Conflict(_))), "{refused:?}");
    assert_eq!(store_stock(&db, item).await, 2, "the implant stayed used");
    assert_eq!(row(&db, usage).await.1, "open");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_usage_the_registry_claimed_is_not_returned() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    // Unpriced, so the claimed row stays open for the desk.
    let batch = consignment_priced(&db, &w.v, 0).await;
    let item = knee(&db, w.v.tenant).await;
    let usage = unnamed_usage(&db, &claims, batch).await;
    registry_entry(&db, &claims, &w, batch, w.v.patient).await;
    let (id, status, _, patient) = row(&db, usage).await;
    assert_eq!((status.as_str(), patient), ("open", Some(w.v.patient)));

    let refused = dismiss_duplicate(&db, &claims, id).await;
    assert!(matches!(refused, Err(AppError::Conflict(_))), "{refused:?}");
    assert_eq!(
        store_stock(&db, item).await,
        2,
        "the patient's implant stayed used"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_billing_only_desk_cannot_return_stock() {
    let db = pool().await;
    let (mut claims, w) = ward(&db, "LKUNUSED", 1, false).await;
    leakage_desk(&mut claims);
    let batch = consignment(&db, &w.v).await;
    let item = knee(&db, w.v.tenant).await;
    // A true duplicate: the registry recorded it, then the store did again.
    registry_entry(&db, &claims, &w, batch, w.v.patient).await;
    let duplicate = unnamed_usage(&db, &claims, batch).await;
    let (id, ..) = row(&db, duplicate).await;

    let mut desk = claims.clone();
    desk.role = "billing_clerk".to_owned();
    desk.permissions = vec![
        permissions::billing::leakage::VIEW.to_owned(),
        permissions::billing::leakage::RESOLVE.to_owned(),
    ];
    let refused = dismiss_duplicate(&db, &desk, id).await;
    assert!(matches!(refused, Err(AppError::Forbidden)), "{refused:?}");
    assert_eq!(store_stock(&db, item).await, 1, "no stock moved");
    assert_eq!(
        row(&db, duplicate).await.1,
        "open",
        "nothing was dismissed either"
    );

    // A desk that may also move store stock may.
    let returned = dismiss_duplicate(&db, &claims, id)
        .await
        .expect("returned")
        .0;
    assert_eq!(returned.status, "dismissed");
    assert_eq!(store_stock(&db, item).await, 2);
}
