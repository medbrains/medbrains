//! How much a prescription, a discharge summary or an uploaded prescription
//! lets out, as a pharmacist with the built-in role meets it.
//!
//! Two dispenses at once on one prescription release no more than it
//! allows; each issued repeat adds one fill; a frequency the cap cannot count
//! is refused, and "every 4 days" is counted as a number; a discharge summary
//! caps every order on it at what it lists; one uploaded prescription backs
//! one order per drug. And migration 1450 keeps an X or NDPS drug controlled.

use crate::dispense_world::{self, Desk};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// The response refused with 400, its text naming `why`.
fn refused(response: &(StatusCode, Value), why: &str) {
    assert_eq!(response.0, StatusCode::BAD_REQUEST, "{}", response.1);
    let text = response.1.to_string();
    assert!(text.contains(why), "expected {why:?} in {text}");
}

#[tokio::test]
async fn two_dispenses_at_once_release_no_more_than_the_prescription_allows() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let first = d.order(Some(rx), drug, 10).await;
    let second = d.order(Some(rx), drug, 10).await;
    let (a, b) = tokio::join!(d.dispense(first, json!({})), d.dispense(second, json!({})));
    let ok = [&a, &b].iter().filter(|r| r.0 == StatusCode::OK).count();
    assert_eq!(ok, 1, "exactly one goes out: {a:?} {b:?}");
    let loser = if a.0 == StatusCode::OK { &b } else { &a };
    refused(loser, "10 already went out");
}

#[tokio::test]
async fn each_issued_repeat_adds_one_fill() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let earlier = d.order(Some(rx), drug, 10).await;
    d.mark_dispensed(earlier).await;
    let refill = d.order(Some(rx), drug, 10).await;
    refused(&d.dispense(refill, json!({})).await, "10 already went out");

    sqlx::query("UPDATE prescriptions SET repeats_used = 1 WHERE id = $1")
        .bind(rx)
        .execute(&d.app.db)
        .await
        .expect("repeat issued");
    let (status, body) = d.dispense(refill, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

#[tokio::test]
async fn a_frequency_the_cap_cannot_count_is_refused_and_intervals_are_numbers() {
    let d = dispense_world::desk().await;
    let weekly = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(weekly, None, "twice weekly")]).await;
    let order = d.order(Some(rx), weekly, 2).await;
    refused(
        &d.dispense(order, json!({})).await,
        "prescribed quantity cannot be read",
    );

    // 1 tab every 4 days for 5 days: two tablets, not thirty.
    let spaced = d.drug(Some("H1"), false).await;
    let rx = d.prescription(&[(spaced, None, "every 4 days")]).await;
    let over = d.order(Some(rx), spaced, 3).await;
    refused(
        &d.dispense(over, json!({})).await,
        "the prescription allows 2",
    );
    let within = d.order(Some(rx), spaced, 2).await;
    let (status, body) = d.dispense(within, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// A finalized discharge summary listing `quantity` of `drug`, signed off by
/// the desk's doctor today.
async fn discharge_summary(d: &Desk, drug: Uuid, quantity: i32) -> Uuid {
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                                 admission_number, discharged_at) \
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id",
    )
    .bind(d.tenant)
    .bind(d.encounter)
    .bind(d.patient)
    .bind(d.doctor)
    .bind(format!("IP-DW-{}", dispense_world::tag()))
    .fetch_one(&d.app.db)
    .await
    .expect("admission");
    sqlx::query_scalar(
        "INSERT INTO ipd_discharge_summaries (tenant_id, admission_id, status, finalized_at, \
                                              finalized_by, medications_on_discharge) \
         VALUES ($1, $2, 'finalized', now(), $3, $4) RETURNING id",
    )
    .bind(d.tenant)
    .bind(admission)
    .bind(d.doctor)
    .bind(json!([{ "catalog_item_id": drug, "drug_name": "Listed", "quantity": quantity }]))
    .fetch_one(&d.app.db)
    .await
    .expect("summary")
}

/// A discharge order for `quantity` of `drug` against the summary.
async fn discharge_order(d: &Desk, summary: Uuid, drug: Uuid, quantity: i32) -> Uuid {
    let order = d.order(None, drug, quantity).await;
    sqlx::query(
        "UPDATE pharmacy_orders SET dispensing_type = 'discharge', discharge_summary_id = $2 \
          WHERE id = $1",
    )
    .bind(order)
    .bind(summary)
    .execute(&d.app.db)
    .await
    .expect("discharge order");
    order
}

#[tokio::test]
async fn a_discharge_summary_caps_every_order_on_it_at_what_it_lists() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("H"), false).await;
    let summary = discharge_summary(&d, drug, 10).await;
    let earlier = discharge_order(&d, summary, drug, 6).await;
    d.mark_dispensed(earlier).await;
    let over = discharge_order(&d, summary, drug, 5).await;
    refused(
        &d.dispense(over, json!({})).await,
        "the discharge summary allows 10 and 6 already went out",
    );
    let rest = discharge_order(&d, summary, drug, 4).await;
    let (status, body) = d.dispense(rest, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// An order on a verified uploaded prescription with this file hash.
async fn uploaded_order(d: &Desk, sha: &str, drug: Uuid, quantity: i32) -> Uuid {
    let order = d.order(None, drug, quantity).await;
    sqlx::query(
        "INSERT INTO pharmacy_store_orders (tenant_id, patient_id, status, rx_source, \
                                            rx_document_key, rx_document_sha256, verified_by, \
                                            verified_at, pharmacy_order_id) \
         VALUES ($1, $2, 'released', 'upload', $3, $4, $5, now(), $6)",
    )
    .bind(d.tenant)
    .bind(d.patient)
    .bind(format!("rx/{}.pdf", dispense_world::tag()))
    .bind(sha)
    .bind(d.pharmacist.user_id)
    .bind(order)
    .execute(&d.app.db)
    .await
    .expect("upload");
    order
}

#[tokio::test]
async fn one_uploaded_prescription_backs_one_order_per_drug() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("H"), false).await;
    let other = d.drug(Some("H"), false).await;
    let sha = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let first = uploaded_order(&d, &sha, drug, 5).await;
    d.mark_dispensed(first).await;
    let again = uploaded_order(&d, &sha, drug, 5).await;
    refused(
        &d.dispense(again, json!({})).await,
        "already backed an earlier order",
    );
    let another_line = uploaded_order(&d, &sha, other, 5).await;
    let (status, body) = d.dispense(another_line, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

#[tokio::test]
async fn an_x_or_ndps_drug_is_always_controlled_and_the_duplicate_reference_is_checked() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("NDPS"), false).await;
    let controlled = |id: Uuid| {
        sqlx::query_scalar::<_, bool>("SELECT is_controlled FROM pharmacy_catalog WHERE id = $1")
            .bind(id)
            .fetch_one(&d.app.db)
    };
    assert!(controlled(drug).await.expect("read"), "set on insert");
    sqlx::query("UPDATE pharmacy_catalog SET is_controlled = false WHERE id = $1")
        .bind(drug)
        .execute(&d.app.db)
        .await
        .expect("update");
    assert!(controlled(drug).await.expect("read"), "kept on update");

    // With the trigger out of the way, the CHECK still refuses it.
    let mut tx = d.app.db.begin().await.expect("tx");
    sqlx::query("SET LOCAL session_replication_role = replica")
        .execute(&mut *tx)
        .await
        .expect("no triggers");
    let check = sqlx::query("UPDATE pharmacy_catalog SET is_controlled = false WHERE id = $1")
        .bind(drug)
        .execute(&mut *tx)
        .await;
    let error = check
        .expect_err("the CHECK refuses an uncontrolled NDPS drug")
        .to_string();
    assert!(
        error.contains("pharmacy_catalog_schedule_x_ndps_controlled"),
        "{error}"
    );
    drop(tx);

    let order = d.order(None, drug, 1).await;
    let short =
        sqlx::query("UPDATE pharmacy_orders SET schedule_x_duplicate_ref = ' abc ' WHERE id = $1")
            .bind(order)
            .execute(&d.app.db)
            .await
            .expect_err("too short a reference")
            .to_string();
    assert!(
        short.contains("pharmacy_orders_schedule_x_duplicate_ref_check"),
        "{short}"
    );
}
