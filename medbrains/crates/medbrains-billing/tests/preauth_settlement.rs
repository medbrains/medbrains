//! The fourth review of #5270, against a real, migrated database: discharge
//! is not the end of a stay's bill, so the checks run until it is settled
//! and only then close its rows; and the desk's room list ranks by the cut
//! now and rounds half a paisa as the consent does.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test preauth_settlement -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, Query, State};
use medbrains_billing::preauth_sweep::{VISITS_PER_PASS, sweep_for};
use medbrains_billing::revenue_alerts::{
    ListRevenueAlertsQuery, RequestEnhancementBody, RevenueAlert, list_revenue_alerts,
    record_room_consent, request_enhancement,
};
use medbrains_ipd::room_eligibility::{Allocated, record_room};
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_services::room_eligibility::{ROOM_DISCLOSURE_VERSION, RoomConsentInput};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

mod common;

use common::inpatient::{
    Inpatient, admit, approved_preauth, bed, bill, line, policy, raise_bill, rows, staff,
};
use common::{fixture, insert_patient, pool, scoped, state};

const PREAUTH: &str = "preauth_used_up";
const ROOM: &str = "room_over_limit";

/// Allocate `bed` to the admission as the IPD handlers do, with no consent.
async fn allocate(db: &PgPool, claims: &Claims, inp: &Inpatient, bed: Uuid) {
    let mut tx = scoped(db, inp.tenant).await;
    let a = Allocated {
        admission_id: inp.admission,
        patient_id: inp.patient,
        encounter_id: inp.encounter,
        bed_id: bed,
    };
    record_room(&mut tx, claims, &a, None).await.unwrap();
    tx.commit().await.unwrap();
}

/// The admission leaves hospital.
async fn discharge(db: &PgPool, inp: &Inpatient) {
    sqlx::query("UPDATE admissions SET status = 'discharged', discharged_at = now() WHERE id = $1")
        .bind(inp.admission)
        .execute(db)
        .await
        .unwrap();
}

/// Every bill on the visit is paid.
async fn settle(db: &PgPool, inp: &Inpatient) {
    sqlx::query("UPDATE invoices SET status = 'paid' WHERE encounter_id = $1")
        .bind(inp.encounter)
        .execute(db)
        .await
        .unwrap();
}

/// The row's status and the `resolution` the system closed it with.
async fn closed_how(db: &PgPool, row: Uuid) -> (String, Option<String>) {
    sqlx::query_as(
        "SELECT status, evidence->>'resolution' FROM charge_attention_items WHERE id = $1",
    )
    .bind(row)
    .fetch_one(db)
    .await
    .unwrap()
}

/// The hospital's open room rows as the desk's list shows them.
async fn room_list(db: &PgPool, claims: &Claims) -> Vec<RevenueAlert> {
    let Json(listed) = list_revenue_alerts(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(ListRevenueAlertsQuery {
            kind: ROOM.to_owned(),
            status: None,
        }),
    )
    .await
    .unwrap();
    listed
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_discharged_stay_is_checked_until_its_bill_is_settled() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (Some(5_000), None)).await;
    allocate(&db, &claims, &inp, bed(&db, t, 8_000, "Deluxe").await).await;
    assert_eq!(sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap().missing, 1);
    let missing = rows(&db, t, PREAUTH).await[0].0;
    let room = rows(&db, t, ROOM).await[0].0;

    // The final bill comes after discharge: the open row follows it, and
    // discharge alone closes nothing.
    discharge(&db, &inp).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, t, invoice, 40_000).await;
    let found = rows(&db, t, PREAUTH).await;
    assert_eq!((found.len(), found[0].3), (1, Some(Decimal::from(40_000))));
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!((report.checked, report.closed_stale), (1, 0));

    settle(&db, &inp).await;
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!((report.checked, report.closed_stale), (0, 2));
    for row in [missing, room] {
        let how = closed_how(&db, row).await;
        assert_eq!((how.0.as_str(), how.1.as_deref()), ("actioned", Some("settled")));
    }

    // A stay discharged and settled before any check is never raised.
    let mut tx = scoped(&db, t).await;
    let other = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    let gone = admit(&db, &claims, other).await;
    policy(&db, t, other, (None, None)).await;
    let invoice = bill(&db, &gone).await;
    settle(&db, &gone).await;
    discharge(&db, &gone).await;
    raise_bill(&db, t, invoice, 10_000).await;
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(rows(&db, t, PREAUTH).await.len(), 1, "only the first patient's row");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_room_charge_at_discharge_past_the_approval_raises_the_full_band() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, t, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, t, invoice, 85_000).await;
    // The desk asked for more at the threshold; the payer has not answered.
    let first = rows(&db, t, PREAUTH).await[0].0;
    let Json(_) = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(first),
        Json(RequestEnhancementBody {
            additional_amount: Decimal::from(30_000),
            note: None,
        }),
    )
    .await
    .unwrap();

    discharge(&db, &inp).await;
    // The last days' room rent is posted at discharge.
    raise_bill(&db, t, invoice, 104_000).await;
    let found = rows(&db, t, PREAUTH).await;
    assert_eq!(found.len(), 2);
    assert_eq!((found[1].1.as_str(), found[1].2.as_str()), ("preauth_used_up", "open"));
    let band: Option<String> =
        sqlx::query_scalar("SELECT evidence->>'band' FROM charge_attention_items WHERE id = $1")
            .bind(found[1].0)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(band.as_deref(), Some("100"));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_row_stored_at_nothing_with_a_large_cut_now_outranks_a_larger_stored_row() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;

    // First: ₹50,000 stored (a stale figure), ₹10,000 room-linked now: ₹3,750.
    policy(&db, t, patient, (Some(5_000), None)).await;
    let early = admit(&db, &claims, patient).await;
    allocate(&db, &claims, &early, deluxe).await;
    sqlx::query(
        "UPDATE charge_attention_items SET amount = 50000 \
          WHERE encounter_id = $1 AND kind = 'room_over_limit'",
    )
    .bind(early.encounter)
    .execute(&db)
    .await
    .unwrap();
    let invoice = bill(&db, &early).await;
    line(&db, t, invoice, ("ipd", "Room", 10_000, None)).await;

    // Second, later: stored at ₹0, ₹1,00,000 room-linked since: ₹37,500.
    let mut tx = scoped(&db, t).await;
    let other = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    policy(&db, t, other, (Some(5_000), None)).await;
    let late = admit(&db, &claims, other).await;
    allocate(&db, &claims, &late, deluxe).await;
    let invoice = bill(&db, &late).await;
    line(&db, t, invoice, ("ipd", "Room", 100_000, None)).await;

    let cuts: Vec<_> = room_list(&db, &claims)
        .await
        .iter()
        .map(|r| (r.patient_id, r.amount))
        .collect();
    assert_eq!(
        cuts,
        vec![
            (other, Some(Decimal::from(37_500))),
            (patient, Some(Decimal::from(3_750))),
        ],
        "ranked by the cut now, not the stored figure or the age"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn half_a_paisa_rounds_the_same_on_the_list_and_the_consent() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (Some(5_000), None)).await;
    allocate(&db, &claims, &inp, bed(&db, t, 8_000, "Deluxe").await).await;
    // ₹101.40 room-linked × (1 − 0.625) = ₹38.025: half away from zero is
    // ₹38.03, where rounding half to even would give ₹38.02.
    let invoice = bill(&db, &inp).await;
    let mut tx = scoped(&db, t).await;
    sqlx::query(
        "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, source, \
           quantity, unit_price, total_price) \
         VALUES ($1, $2, 'ROOM', 'Room', 'ipd', 1, 101.40, 101.40)",
    )
    .bind(t)
    .bind(invoice)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let expected = Some(Decimal::new(3_803, 2));
    assert_eq!(room_list(&db, &claims).await[0].amount, expected);

    let row = rows(&db, t, ROOM).await[0].0;
    let witness = staff(&db, t).await;
    let Json(_) = record_room_consent(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(RoomConsentInput {
            consented_by_name: "Meena Rao".to_owned(),
            consenter_relation: "Wife".to_owned(),
            estimated_bill: None,
            witness_user_id: witness,
            disclosure_version: ROOM_DISCLOSURE_VERSION.to_owned(),
        }),
    )
    .await
    .unwrap();
    let kept: Option<Decimal> = sqlx::query_scalar(
        "SELECT estimated_deduction FROM room_upgrade_consents WHERE admission_id = $1",
    )
    .bind(inp.admission)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(kept, expected);
}
