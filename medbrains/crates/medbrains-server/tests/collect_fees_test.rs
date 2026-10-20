//! Collect anywhere (#4885): when the front desk's fees are charged, which
//! bill they land on, and the department every charge is booked to.
//!
//! One test, because it changes the hospital's lane settings: run serially,
//! it restores them before it asserts, so a failure leaves nothing behind.

mod collect_world;
mod common;
mod payments_world;
mod pos_world;

use axum::http::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use collect_world::{entity, patient, put};
use payments_world::World;

/// Check a patient in for an OPD visit: (encounter, queue row).
async fn check_in(w: &World, patient: Uuid, dept: Uuid, doctor: Uuid) -> (Uuid, String) {
    let (code, visit) = w
        .call(
            "POST",
            "/api/opd/encounters",
            json!({ "patient_id": patient, "department_id": dept, "doctor_id": doctor }),
        )
        .await;
    assert_eq!(code, StatusCode::OK, "{visit}");
    let queue = visit["queue"]["id"]
        .as_str()
        .or_else(|| visit["queue_id"].as_str())
        .expect("queue")
        .to_owned();
    let encounter = visit["encounter"]["id"]
        .as_str()
        .or_else(|| visit["id"].as_str())
        .expect("encounter")
        .parse()
        .expect("uuid");
    (encounter, queue)
}

async fn complete(w: &World, queue: &str) {
    for step in ["call", "start", "complete"] {
        let (code, body) = put(w, &format!("/api/opd/queue/{queue}/{step}"), json!({})).await;
        assert!(code.is_success(), "{step}: {code} {body}");
    }
}

/// (unit price, the bill's entity, the line's department) of each `source`
/// line on the patient's bills.
async fn lines(w: &World, patient: Uuid, source: &str) -> Vec<(Decimal, Uuid, Option<Uuid>)> {
    sqlx::query_as(
        "SELECT ii.unit_price, i.legal_entity_id, ii.department_id FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id \
          WHERE i.patient_id = $1 AND ii.source::text = $2",
    )
    .bind(patient)
    .bind(source)
    .fetch_all(&w.app.db)
    .await
    .expect("lines")
}

fn lane_of<'a>(lanes: &'a Value, name: &str) -> &'a Value {
    lanes
        .as_array()
        .and_then(|l| l.iter().find(|x| x["lane"] == name))
        .expect("lane")
}

async fn set_lane(w: &World, lane: &Value, charge_at: &str, fee: Option<i64>, entity: &Value) {
    let name = lane["lane"].as_str().expect("lane");
    let (code, body) = put(
        w,
        &format!("/api/billing/lanes/{name}"),
        json!({ "legal_entity_id": entity, "revenue_department_id": lane["revenue_department_id"],
                "default_mode": lane["default_mode"], "charge_at": charge_at, "fee_amount": fee }),
    )
    .await;
    assert_eq!(code, StatusCode::OK, "{body}");
}

/// Given a ₹100 registration fee billed by its own entity: charged at
/// check-in, both the fee and the consultation land at check-in, the fee on
/// its entity's bill; charged at completion, nothing lands until the visit is
/// completed. Each line names a department — the consultation the visit's —
/// and the migration's backfill restores a line that lost it.
#[tokio::test]
async fn front_desk_fees_follow_the_hospitals_timing_and_lane() {
    let w = pos_world::world().await;
    let doctor: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&w.app.db)
        .await
        .expect("admin");
    let dept: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL \
           AND department_type = 'clinical' ORDER BY code LIMIT 1",
    )
    .bind(w.tenant)
    .fetch_one(&w.app.db)
    .await
    .expect("department");
    let (code, lanes) = w.call("GET", "/api/billing/lanes", json!(null)).await;
    assert_eq!(code, StatusCode::OK, "{lanes}");
    let registration = lane_of(&lanes, "registration").clone();
    let opd = lane_of(&lanes, "opd").clone();
    let (own, _) = entity(&w).await;

    set_lane(&w, &registration, "checkin", Some(100), &json!(own)).await;
    set_lane(&w, &opd, "checkin", None, &opd["legal_entity_id"]).await;
    let a = patient(&w).await;
    let (_, _) = check_in(&w, a, dept, doctor).await;
    let a_fee = lines(&w, a, "registration").await;
    let a_consult = lines(&w, a, "opd").await;

    set_lane(&w, &registration, "complete", Some(100), &json!(own)).await;
    set_lane(&w, &opd, "complete", None, &opd["legal_entity_id"]).await;
    let b = patient(&w).await;
    let (_, queue) = check_in(&w, b, dept, doctor).await;
    let b_before = (
        lines(&w, b, "registration").await,
        lines(&w, b, "opd").await,
    );
    complete(&w, &queue).await;
    let b_after = (
        lines(&w, b, "registration").await,
        lines(&w, b, "opd").await,
    );

    // A consultation line that lost its department, put back by the backfill.
    let restored: Option<Uuid> = sqlx::query_scalar(
        "WITH lost AS ( \
           UPDATE invoice_items ii SET department_id = NULL FROM invoices i \
            WHERE i.id = ii.invoice_id AND i.patient_id = $1 AND ii.source = 'opd' \
            RETURNING ii.id) \
         SELECT id FROM lost",
    )
    .bind(a)
    .fetch_optional(&w.app.db)
    .await
    .expect("lose");
    let backfilled: Option<Uuid> = sqlx::query_scalar(
        "UPDATE invoice_items it \
            SET department_id = public.billing_item_department(it.tenant_id, it.source::text, it.invoice_id) \
          WHERE it.id = $1 AND it.department_id IS NULL RETURNING department_id",
    )
    .bind(restored)
    .fetch_optional(&w.app.db)
    .await
    .expect("backfill")
    .flatten();

    // Put the hospital back before judging anything.
    set_lane(
        &w,
        &registration,
        registration["charge_at"].as_str().unwrap_or("checkin"),
        None,
        &registration["legal_entity_id"],
    )
    .await;
    set_lane(
        &w,
        &opd,
        opd["charge_at"].as_str().unwrap_or("checkin"),
        None,
        &opd["legal_entity_id"],
    )
    .await;

    let hundred = Decimal::from(100);
    assert_eq!(a_fee.len(), 1, "the fee is charged at check-in, once");
    assert_eq!(
        (a_fee[0].0, a_fee[0].1),
        (hundred, own),
        "on its own entity's bill"
    );
    assert_eq!(
        a_consult.len(),
        1,
        "the consultation is charged at check-in"
    );
    assert_eq!(
        a_consult[0].2,
        Some(dept),
        "booked to the visit's department"
    );
    assert_ne!(
        a_consult[0].1, own,
        "the consultation stays on the hospital's bill"
    );
    assert!(
        b_before.0.is_empty() && b_before.1.is_empty(),
        "nothing before completion"
    );
    assert_eq!(
        (b_after.0.len(), b_after.1.len()),
        (1, 1),
        "both at completion"
    );
    assert!(restored.is_some());
    assert_eq!(
        backfilled,
        Some(dept),
        "the backfill books it to the visit's department"
    );
}
