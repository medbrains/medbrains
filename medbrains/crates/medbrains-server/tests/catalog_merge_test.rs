//! Duplicate drugs in the pharmacy catalogue (#4861): the report finds them,
//! a merge moves every reference and the stock onto the drug kept, and two
//! drugs that differ in schedule are never merged.

use crate::grn_world;

use grn_world::{send, user, world};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

async fn batch_on(w: &grn_world::World, drug: Uuid, qty: i32) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date, \
             quantity_received, quantity_on_hand) \
         VALUES ($1, $2, $3, '2031-01-31', $4, $4) RETURNING id",
    )
    .bind(w.tenant)
    .bind(drug)
    .bind(format!("MB{}", &Uuid::new_v4().simple().to_string()[..6]))
    .bind(qty)
    .fetch_one(&w.app.db)
    .await
    .expect("batch")
}

/// A drug of this run's own and a copy of it under another code, `schedule`
/// on the copy. The name is random so earlier runs' drugs, left in a reused
/// database, are not near-duplicates of it and do not crowd the report.
async fn drug_and_copy(w: &grn_world::World, schedule: &str) -> (Uuid, Uuid) {
    let name = format!("Q{}", &Uuid::new_v4().simple().to_string()[..12]);
    let original: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, strength, dosage_form, drug_schedule, \
             current_stock, store_catalog_id) \
         SELECT tenant_id, $2, $3, strength, dosage_form, drug_schedule, 0, store_catalog_id \
           FROM pharmacy_catalog WHERE id = $1 RETURNING id",
    )
    .bind(w.drugs[0].pharmacy_id)
    .bind(format!("M{}", &Uuid::new_v4().simple().to_string()[..10]).to_uppercase())
    .bind(&name)
    .fetch_one(&w.app.db)
    .await
    .expect("original");
    let copy = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, strength, dosage_form, drug_schedule, \
             current_stock, store_catalog_id) \
         SELECT tenant_id, code || 'X', name || ' tab', strength, dosage_form, $2, 7, store_catalog_id \
           FROM pharmacy_catalog WHERE id = $1 RETURNING id",
    )
    .bind(original)
    .bind(schedule)
    .fetch_one(&w.app.db)
    .await
    .expect("duplicate");
    (original, copy)
}

async fn stock_of(w: &grn_world::World, drug: Uuid) -> i32 {
    sqlx::query_scalar("SELECT current_stock FROM pharmacy_catalog WHERE id = $1")
        .bind(drug)
        .fetch_one(&w.app.db)
        .await
        .expect("stock")
}

/// Drugs left live would crowd later runs' reports in the shared database.
async fn retire(w: &grn_world::World, copy: Uuid) {
    sqlx::query("UPDATE pharmacy_catalog SET deleted_at = now() WHERE id = $1")
        .bind(copy)
        .execute(&w.app.db)
        .await
        .expect("retire copy");
}

/// Given a drug and a copy of it holding a batch and 7 in stock, When the
/// pharmacist lists duplicates, Then the pair is there; When they merge the
/// copy into the drug, Then the batch points at the drug, its stock is added,
/// the copy is retired pointing at the drug, and the merge is recorded.
#[tokio::test]
async fn a_merge_moves_references_and_stock_to_the_drug_kept() {
    let w = world().await;
    let (kept, copy) = drug_and_copy(&w, "H").await;
    let batch = batch_on(&w, copy, 7).await;
    let before = stock_of(&w, kept).await;

    let (status, pairs) = w
        .call("GET", "/api/pharmacy/catalog/duplicates", json!(null))
        .await;
    assert_eq!(status, StatusCode::OK, "{pairs}");
    let listed = pairs.as_array().expect("pairs").iter().any(|p| {
        [&p["a_id"], &p["b_id"]].contains(&&json!(copy))
            && [&p["a_id"], &p["b_id"]].contains(&&json!(kept))
    });
    assert!(listed, "the copy is reported: {pairs}");

    let (status, merged) = w
        .call("POST", "/api/pharmacy/catalog/merge", json!({
            "survivor_id": kept, "merged_id": copy, "reason": "Same drug imported twice under two codes",
        }))
        .await;
    assert_eq!(status, StatusCode::OK, "{merged}");
    assert_eq!(
        merged["repointed"]["pharmacy_batches.catalog_item_id"], 1,
        "{merged}"
    );
    assert_eq!(merged["stock_moved"], 7);

    let on: Uuid = sqlx::query_scalar("SELECT catalog_item_id FROM pharmacy_batches WHERE id = $1")
        .bind(batch)
        .fetch_one(&w.app.db)
        .await
        .expect("batch");
    assert_eq!(on, kept, "the batch now belongs to the drug kept");
    assert_eq!(stock_of(&w, kept).await, before + 7);
    let (into, gone): (Option<Uuid>, bool) = sqlx::query_as(
        "SELECT merged_into_id, deleted_at IS NOT NULL FROM pharmacy_catalog WHERE id = $1",
    )
    .bind(copy)
    .fetch_one(&w.app.db)
    .await
    .expect("copy");
    assert_eq!((into, gone), (Some(kept), true));
}

/// Given a Schedule H drug and a Schedule X "copy", Then the report says why
/// they may not merge, and a merge is refused with nothing moved.
#[tokio::test]
async fn drugs_differing_in_schedule_are_never_merged() {
    let w = world().await;
    let (original, copy) = drug_and_copy(&w, "X").await;
    let batch = batch_on(&w, copy, 3).await;
    let (_, pairs) = w
        .call("GET", "/api/pharmacy/catalog/duplicates", json!(null))
        .await;
    let pair = pairs
        .as_array()
        .expect("pairs")
        .iter()
        .find(|p| p["a_id"] == json!(copy) || p["b_id"] == json!(copy))
        .cloned();
    assert!(
        pair.is_some_and(|p| p["blocked_reason"].is_string()),
        "{pairs}"
    );

    let (status, body) = w
        .call("POST", "/api/pharmacy/catalog/merge", json!({
            "survivor_id": original, "merged_id": copy, "reason": "Looks the same to me",
        }))
        .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    let on: Uuid = sqlx::query_scalar("SELECT catalog_item_id FROM pharmacy_batches WHERE id = $1")
        .bind(batch)
        .fetch_one(&w.app.db)
        .await
        .expect("batch");
    assert_eq!(on, copy, "nothing moved");
    retire(&w, copy).await;
    retire(&w, original).await;
}

/// Given a store keeper (no `pharmacy.catalog.merge`), Then the report and the
/// merge both answer 403.
#[tokio::test]
async fn merging_needs_its_permission() {
    let w = world().await;
    let (original, copy) = drug_and_copy(&w, "H").await;
    let keeper = user(&w.app, &w.csrf, "store_keeper", &[], &[]).await;
    let me = (&keeper.client, keeper.csrf.as_str());
    let (status, _) = send(
        me,
        &w.app,
        "GET",
        "/api/pharmacy/catalog/duplicates",
        json!(null),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = send(
        me,
        &w.app,
        "POST",
        "/api/pharmacy/catalog/merge",
        json!({
            "survivor_id": original, "merged_id": copy, "reason": "Same drug twice",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    retire(&w, copy).await;
    retire(&w, original).await;
}
