//! The controlled-drug and allergy controls at the counter and the pick, as a
//! pharmacist with the built-in role meets them — no bypass role anywhere,
//! except where a hospital admin is the point.
//!
//! Schedule X needs an authorised prescriber, a witness and the retained
//! duplicate's reference; an NDPS dispense without a witness needs the
//! override granted by name, which a hospital admin's bypass does not carry;
//! morphine never goes out without a prescription; an unknown allergy status
//! is asked about at the counter and at the pick, where the schedule gate's
//! refusals are filed too; the NDPS register never goes below zero; wrong
//! witness passwords are limited, and a locked-out colleague cannot witness.

use crate::dispense_world::{self, Desk, dispense_as, staff};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const GATE: &str = "SCHEDULE_DISPENSE_REFUSED";

/// `extra` with the witness's confirmation merged in.
fn witnessed_with(d: &Desk, extra: Value) -> Value {
    let mut body = d.witnessed();
    if let (Some(base), Some(more)) = (body.as_object_mut(), extra.as_object()) {
        base.extend(more.clone());
    }
    body
}

/// The response refused with `status`, its text naming `why`.
fn refused(response: &(StatusCode, Value), status: StatusCode, why: &str) {
    assert_eq!(response.0, status, "{}", response.1);
    let text = response.1.to_string();
    assert!(text.contains(why), "expected {why:?} in {text}");
}

#[tokio::test]
async fn schedule_x_needs_an_authorised_prescriber_a_witness_and_the_duplicate() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("X"), true).await;
    d.ndps_receipt(drug, 50).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let order = d.order(Some(rx), drug, 10).await;

    let bare = d.dispense(order, json!({})).await;
    refused(
        &bare,
        StatusCode::BAD_REQUEST,
        "Schedule X dispense requires a witness",
    );
    refused(
        &bare,
        StatusCode::BAD_REQUEST,
        "duplicate prescription the pharmacy keeps",
    );
    assert_eq!(
        d.filed(order, GATE, "blocked").await,
        1,
        "the refusal is filed"
    );

    let short = witnessed_with(&d, json!({ "schedule_x_duplicate_ref": " SX-1 " }));
    let short = d.dispense(order, short).await;
    refused(&short, StatusCode::BAD_REQUEST, "at least 6 characters");

    sqlx::query("UPDATE doctor_profiles SET can_prescribe_schedule_x = false WHERE user_id = $1")
        .bind(d.doctor)
        .execute(&d.app.db)
        .await
        .expect("unauthorise");
    let full = witnessed_with(&d, json!({ "schedule_x_duplicate_ref": " SX-2026-0042 " }));
    let unauthorised = d.dispense(order, full.clone()).await;
    refused(
        &unauthorised,
        StatusCode::BAD_REQUEST,
        "lacks `can_prescribe_schedule_x`",
    );

    sqlx::query("UPDATE doctor_profiles SET can_prescribe_schedule_x = true WHERE user_id = $1")
        .bind(d.doctor)
        .execute(&d.app.db)
        .await
        .expect("authorise");
    let (status, body) = d.dispense(order, full).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (reference, witness): (Option<String>, Option<Uuid>) = sqlx::query_as(
        "SELECT o.schedule_x_duplicate_ref, n.witnessed_by \
           FROM pharmacy_orders o \
           JOIN pharmacy_ndps_register n ON n.catalog_item_id = $2 AND n.action = 'dispensed' \
          WHERE o.id = $1",
    )
    .bind(order)
    .bind(drug)
    .fetch_one(&d.app.db)
    .await
    .expect("dispensed");
    assert_eq!(reference.as_deref(), Some("SX-2026-0042"), "stored trimmed");
    assert_eq!(
        witness,
        Some(d.witness.user_id),
        "the register names the witness"
    );
}

#[tokio::test]
async fn the_ndps_witness_override_is_granted_by_name_even_to_a_hospital_admin() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("NDPS"), true).await;
    d.ndps_receipt(drug, 50).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let order = d.order(Some(rx), drug, 5).await;
    let reason = json!({ "ndps_override_reason": "Night shift, no second pharmacist on duty" });

    let pharmacist = d.dispense(order, reason.clone()).await;
    refused(&pharmacist, StatusCode::FORBIDDEN, "NDPS witness override");
    assert_eq!(d.filed(order, "NDPS_WITNESS_MISSING", "blocked").await, 1);

    let admin = staff(&d.app, &d.admin_csrf, ("hospital_admin", d.department), &[]).await;
    let bypass = dispense_as(&d.app, &admin, order, reason.clone()).await;
    refused(&bypass, StatusCode::FORBIDDEN, "NDPS witness override");

    // Granted to this admin by name: read from the record, not the token.
    sqlx::query(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', \
                 jsonb_build_array('pharmacy.ndps.witness_override'), 'denied', '[]'::jsonb) \
          WHERE id = $1",
    )
    .bind(admin.user_id)
    .execute(&d.app.db)
    .await
    .expect("grant");
    let (status, body) = dispense_as(&d.app, &admin, order, reason).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        d.filed(order, "NDPS_WITNESS_MISSING", "overridden").await,
        1
    );
}

#[tokio::test]
async fn a_morphine_counter_dispense_with_no_prescription_is_refused() {
    let d = dispense_world::desk().await;
    let morphine = d.drug(Some("NDPS"), true).await;
    d.ndps_receipt(morphine, 50).await;
    let order = d.order(None, morphine, 2).await;
    let response = d.dispense(order, d.witnessed()).await;
    refused(
        &response,
        StatusCode::BAD_REQUEST,
        "NDPS drug — no prescription for this patient",
    );
    assert_eq!(d.filed(order, GATE, "blocked").await, 1);
}

#[tokio::test]
async fn an_unknown_allergy_status_is_refused_until_the_pharmacist_acknowledges_it() {
    let d = dispense_world::desk().await;
    sqlx::query("UPDATE patients SET no_known_allergies = NULL WHERE id = $1")
        .bind(d.patient)
        .execute(&d.app.db)
        .await
        .expect("unknown");
    let drug = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let order = d.order(Some(rx), drug, 10).await;

    let asked = d.dispense(order, json!({})).await;
    refused(&asked, StatusCode::BAD_REQUEST, "allergy status is unknown");
    assert_eq!(d.filed(order, "ALLERGY_STATUS_UNKNOWN", "blocked").await, 1);

    let (status, body) = d
        .dispense(order, json!({ "allergy_status_acknowledged": true }))
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// A pack-and-collect store with one shelf batch of each drug.
async fn pack_store(d: &Desk, drugs: &[Uuid]) -> Uuid {
    let t = dispense_world::tag();
    let store: Uuid = sqlx::query_scalar(
        "INSERT INTO store_locations (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(d.tenant)
    .bind(format!("PC-{t}"))
    .bind(format!("Pack and collect {t}"))
    .fetch_one(&d.app.db)
    .await
    .expect("store");
    sqlx::query(
        "INSERT INTO pharmacy_store_assignments (tenant_id, store_location_id, fulfilment_mode) \
         VALUES ($1, $2, 'pack_and_collect')",
    )
    .bind(d.tenant)
    .bind(store)
    .execute(&d.app.db)
    .await
    .expect("store mode");
    for drug in drugs {
        sqlx::query(
            "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date, \
                                           quantity_received, quantity_on_hand, store_location_id) \
             VALUES ($1, $2, $3, CURRENT_DATE + 365, 50, 50, $4)",
        )
        .bind(d.tenant)
        .bind(drug)
        .bind(format!("B-{}", dispense_world::tag()))
        .bind(store)
        .execute(&d.app.db)
        .await
        .expect("batch");
    }
    store
}

/// The pharmacist claims an order for picking.
async fn claim(d: &Desk, order: Uuid, body: Value) -> (StatusCode, Value) {
    let resp = d
        .pharmacist
        .client
        .post(
            d.app
                .url(&format!("/api/pharmacy/fulfilment/{order}/claim")),
        )
        .header("x-csrf-token", &d.pharmacist.csrf)
        .json(&body)
        .send()
        .await
        .expect("claim");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn picking_runs_the_schedule_gate_and_the_allergy_question() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("H"), false).await;
    let store = pack_store(&d, &[drug]).await;
    let unprescribed = d.order(None, drug, 2).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let prescribed = d.order(Some(rx), drug, 2).await;
    sqlx::query("UPDATE pharmacy_orders SET store_location_id = $2 WHERE id = ANY($1)")
        .bind(vec![unprescribed, prescribed])
        .bind(store)
        .execute(&d.app.db)
        .await
        .expect("to the pack store");

    let gate = claim(&d, unprescribed, json!({})).await;
    refused(
        &gate,
        StatusCode::BAD_REQUEST,
        "Schedule H/H1/X gate failed",
    );
    assert_eq!(
        d.filed(unprescribed, GATE, "blocked").await,
        1,
        "filed, as at the counter"
    );

    sqlx::query("UPDATE patients SET no_known_allergies = NULL WHERE id = $1")
        .bind(d.patient)
        .execute(&d.app.db)
        .await
        .expect("unknown");
    let asked = claim(&d, prescribed, json!({})).await;
    refused(&asked, StatusCode::BAD_REQUEST, "allergy status is unknown");
    let (status, body) = claim(
        &d,
        prescribed,
        json!({ "allergy_status_acknowledged": true }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["status"], "picking");
}

#[tokio::test]
async fn the_ndps_register_never_goes_below_zero() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("NDPS"), true).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let order = d.order(Some(rx), drug, 5).await;
    // On the shelf (catalogue stock) but never received into the register.
    let response = d.dispense(order, d.witnessed()).await;
    refused(
        &response,
        StatusCode::CONFLICT,
        "Record the receipt in the register",
    );
    let entries: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_ndps_register WHERE catalog_item_id = $1",
    )
    .bind(drug)
    .fetch_one(&d.app.db)
    .await
    .expect("register");
    assert_eq!(entries, 0, "nothing posted");
}

#[tokio::test]
async fn wrong_witness_passwords_are_limited_and_a_locked_out_colleague_cannot_witness() {
    let d = dispense_world::desk().await;
    let drug = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(drug, Some(10), "BD")]).await;
    let order = d.order(Some(rx), drug, 2).await;
    let wrong = json!({ "witnessed_by": d.witness.user_id, "witness_password": "not-it" });
    for _ in 0..5 {
        let attempt = d.dispense(order, wrong.clone()).await;
        refused(
            &attempt,
            StatusCode::BAD_REQUEST,
            "not the witness's password",
        );
    }
    let limited = d.dispense(order, d.witnessed()).await;
    refused(
        &limited,
        StatusCode::TOO_MANY_REQUESTS,
        "Too many failed witness confirmations",
    );
    let locked_out: Option<bool> = sqlx::query_scalar(
        "SELECT locked_until IS NOT NULL AND locked_until > now() FROM users WHERE id = $1",
    )
    .bind(d.witness.user_id)
    .fetch_one(&d.app.db)
    .await
    .expect("witness");
    assert_eq!(
        locked_out,
        Some(false),
        "the witness's own sign-in is untouched"
    );

    // A colleague whose sign-in is locked: refused, from another dispenser.
    let other = staff(&d.app, &d.admin_csrf, ("pharmacist", d.department), &[]).await;
    sqlx::query("UPDATE users SET locked_until = now() + interval '10 minutes' WHERE id = $1")
        .bind(other.user_id)
        .execute(&d.app.db)
        .await
        .expect("lock");
    let body = json!({ "witnessed_by": other.user_id, "witness_password": other.password });
    let response = dispense_as(&d.app, &d.witness, order, body).await;
    refused(&response, StatusCode::BAD_REQUEST, "sign-in is locked");
}
