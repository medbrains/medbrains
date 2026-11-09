//! Room eligibility (revenue integrity RFC wave 1.4) against a real,
//! migrated database: a room above the policy limit is flagged before the
//! allocation with the proportionate cut, the allocation leaves a row that
//! consent closes (at admission or later from the desk), a room within the
//! limit, an ICU bed or a cash patient raises nothing, moving into an
//! eligible room closes the row, and callers without the permission are
//! refused.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test room_eligibility -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, Query, State};
use medbrains_billing::revenue_alerts::{
    ListRevenueAlertsQuery, list_revenue_alerts, record_room_consent,
};
use medbrains_billing::room_limit::{RoomRentLimitBody, set_room_rent_limit};
use medbrains_core::permissions;
use medbrains_ipd::room_eligibility::{RoomEligibilityQuery, get_room_eligibility};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_services::room_eligibility::{
    ROOM_DISCLOSURE_VERSION, RoomAllocation, RoomCheck, RoomConsentInput, record_allocation,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

mod common;

use common::inpatient::{
    Inpatient, admit, bed, bill, bill_lines, holding, line, policy, rows, staff,
};
use common::{fixture, insert_patient, pool, scoped, state};

const KIND: &str = "room_over_limit";

/// The desk's pre-check for `bed`, as the admission form calls it.
async fn check(
    db: &PgPool,
    claims: &Claims,
    patient: Uuid,
    bed: Uuid,
) -> Result<RoomCheck, AppError> {
    let q = RoomEligibilityQuery {
        patient_id: patient,
        bed_id: bed,
        admission_id: None,
    };
    get_room_eligibility(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(q),
    )
    .await
    .map(|Json(c)| c)
}

/// Allocate `bed` to the inpatient the way admission and transfer do.
async fn allocate(
    db: &PgPool,
    claims: &Claims,
    inp: &Inpatient,
    bed: Uuid,
    consent: Option<&RoomConsentInput>,
) -> RoomCheck {
    let mut tx = scoped(db, inp.tenant).await;
    let alloc = RoomAllocation {
        tenant_id: inp.tenant,
        actor: claims.sub,
        admission_id: inp.admission,
        patient_id: inp.patient,
        encounter_id: inp.encounter,
        bed_id: bed,
        consent,
    };
    let check = record_allocation(&mut tx, alloc).await.unwrap();
    tx.commit().await.unwrap();
    check
}

/// The patient's wife agreeing on a ₹1,00,000 bill, seen by `witness`.
fn wife(witness: Uuid) -> RoomConsentInput {
    RoomConsentInput {
        consented_by_name: "Meena Rao".to_owned(),
        consenter_relation: "Wife".to_owned(),
        estimated_bill: Some(Decimal::from(100_000)),
        witness_user_id: witness,
        disclosure_version: ROOM_DISCLOSURE_VERSION.to_owned(),
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_room_above_the_limit_is_flagged_with_the_proportionate_cut() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    policy(&db, claims.tenant_id, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, claims.tenant_id, 8_000, "Deluxe").await;
    let c = check(&db, &claims, patient, deluxe).await.unwrap();
    assert_eq!(c.status, "above");
    assert_eq!(c.payable_ratio, Some(Decimal::new(625_000, 6)));

    // Allocated without consent: an open row for the insurance desk.
    let inp = admit(&db, &claims, patient).await;
    let invoice = bill(&db, &inp).await;
    bill_lines(&db, inp.tenant, invoice, 40_000, 60_000).await;
    allocate(&db, &claims, &inp, deluxe, None).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].2, "open");
    // Only the ₹40,000 room-linked part is cut, by 37.5%; the drugs are not.
    assert_eq!(found[0].3, Some(Decimal::from(15_000)));

    // The family agrees later, from the desk: consent kept, row closed.
    let Json(done) = record_room_consent(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(found[0].0),
        Json(wife(staff(&db, claims.tenant_id).await)),
    )
    .await
    .unwrap();
    assert_eq!(done.status, "actioned");
    let (who, cut): (String, Decimal) = sqlx::query_as(
        "SELECT consented_by_name, estimated_deduction FROM room_upgrade_consents \
          WHERE admission_id = $1",
    )
    .bind(inp.admission)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!((who.as_str(), cut), ("Meena Rao", Decimal::from(15_000)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn consent_at_admission_closes_the_row_with_the_shown_deduction() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    // 1% of a ₹5,00,000 sum insured: ₹5,000 a day.
    policy(&db, claims.tenant_id, patient, (None, Some(1))).await;
    let deluxe = bed(&db, claims.tenant_id, 8_000, "Deluxe").await;
    let inp = admit(&db, &claims, patient).await;
    let witness = staff(&db, claims.tenant_id).await;
    allocate(&db, &claims, &inp, deluxe, Some(&wife(witness))).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].2, "actioned");
    assert_eq!(
        found[0].3,
        Some(Decimal::from(37_500)),
        "37.5% of the ₹1,00,000 shown"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn within_the_limit_an_icu_bed_or_a_cash_patient_raises_nothing() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let general = bed(&db, claims.tenant_id, 4_000, "General").await;
    let icu = bed(&db, claims.tenant_id, 15_000, "ICU").await;
    assert_eq!(
        check(&db, &claims, patient, general).await.unwrap().status,
        "not_insured"
    );

    policy(&db, claims.tenant_id, patient, (Some(5_000), None)).await;
    assert_eq!(
        check(&db, &claims, patient, general).await.unwrap().status,
        "within"
    );
    assert_eq!(
        check(&db, &claims, patient, icu).await.unwrap().status,
        "icu"
    );
    let inp = admit(&db, &claims, patient).await;
    allocate(&db, &claims, &inp, general, None).await;
    allocate(&db, &claims, &inp, icu, None).await;
    assert!(rows(&db, inp.tenant, KIND).await.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn moving_into_an_eligible_room_closes_the_open_row() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    policy(&db, claims.tenant_id, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, claims.tenant_id, 8_000, "Deluxe").await;
    let general = bed(&db, claims.tenant_id, 4_000, "General").await;
    let inp = admit(&db, &claims, patient).await;
    allocate(&db, &claims, &inp, deluxe, None).await;
    allocate(&db, &claims, &inp, deluxe, None).await;
    assert_eq!(
        rows(&db, inp.tenant, KIND).await.len(),
        1,
        "one row per admission"
    );
    allocate(&db, &claims, &inp, general, None).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].2, "actioned");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_consent_without_who_agreed_is_refused() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    policy(&db, claims.tenant_id, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, claims.tenant_id, 8_000, "Deluxe").await;
    let inp = admit(&db, &claims, patient).await;
    let blank = RoomConsentInput {
        consented_by_name: " ".to_owned(),
        ..wife(staff(&db, claims.tenant_id).await)
    };
    let mut tx = scoped(&db, inp.tenant).await;
    let alloc = RoomAllocation {
        tenant_id: inp.tenant,
        actor: claims.sub,
        admission_id: inp.admission,
        patient_id: inp.patient,
        encounter_id: inp.encounter,
        bed_id: deluxe,
        consent: Some(&blank),
    };
    let err = record_allocation(&mut tx, alloc).await.unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)), "{err:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_permission_the_check_and_the_consent_are_refused() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let deluxe = bed(&db, claims.tenant_id, 8_000, "Deluxe").await;
    let nurse = holding(&claims, &[permissions::ipd::admissions::LIST]);
    let err = check(&db, &nurse, patient, deluxe).await.unwrap_err();
    assert!(matches!(err, AppError::Forbidden), "{err:?}");

    let viewer = holding(&claims, &[permissions::insurance::room_eligibility::VIEW]);
    let err = record_room_consent(
        State(state(db.clone())),
        Extension(viewer),
        Path(Uuid::new_v4()),
        Json(wife(staff(&db, claims.tenant_id).await)),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Forbidden), "{err:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_desk_records_a_missing_limit_and_the_room_is_then_checked() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let pol = policy(&db, claims.tenant_id, patient, (None, None)).await;
    let deluxe = bed(&db, claims.tenant_id, 8_000, "Deluxe").await;
    assert_eq!(
        check(&db, &claims, patient, deluxe).await.unwrap().status,
        "no_limit"
    );

    let out_of_range = RoomRentLimitBody {
        room_rent_limit_per_day: None,
        room_rent_limit_percent: Some(Decimal::from(101)),
    };
    let err = set_room_rent_limit(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(pol),
        Json(out_of_range),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)), "{err:?}");

    let body = RoomRentLimitBody {
        room_rent_limit_per_day: Some(Decimal::from(5_000)),
        room_rent_limit_percent: None,
    };
    let Json(saved) = set_room_rent_limit(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(pol),
        Json(body),
    )
    .await
    .unwrap();
    assert_eq!(saved.room_rent_limit_per_day, Some(Decimal::from(5_000)));
    assert_eq!(
        check(&db, &claims, patient, deluxe).await.unwrap().status,
        "above"
    );

    let viewer = holding(&claims, &[permissions::insurance::room_eligibility::VIEW]);
    let body = RoomRentLimitBody {
        room_rent_limit_per_day: None,
        room_rent_limit_percent: None,
    };
    let err = set_room_rent_limit(
        State(state(db.clone())),
        Extension(viewer),
        Path(pol),
        Json(body),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Forbidden), "{err:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_expected_cut_follows_the_bill_when_the_list_is_read() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    policy(&db, t, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;

    // Admitted first, at ₹0: the cut stored at allocation is nothing.
    let first = admit(&db, &claims, patient).await;
    allocate(&db, &claims, &first, deluxe, None).await;
    assert_eq!(rows(&db, t, KIND).await[0].3, Some(Decimal::ZERO));

    // Admitted second with ₹10,000 already billed: ₹3,750 stored.
    let mut tx = scoped(&db, t).await;
    let other = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    policy(&db, t, other, (Some(5_000), None)).await;
    let second = admit(&db, &claims, other).await;
    let early = bill(&db, &second).await;
    line(&db, t, early, ("ipd", "Room", 10_000, None)).await;
    allocate(&db, &claims, &second, deluxe, None).await;

    // The first stay's bill grows to ₹40,000 of room-linked charges.
    let invoice = bill(&db, &first).await;
    bill_lines(&db, t, invoice, 40_000, 60_000).await;

    let Json(listed) = list_revenue_alerts(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(ListRevenueAlertsQuery {
            kind: KIND.to_owned(),
            status: None,
        }),
    )
    .await
    .unwrap();
    let cuts: Vec<_> = listed.iter().map(|r| (r.patient_id, r.amount)).collect();
    assert_eq!(
        cuts,
        vec![
            (patient, Some(Decimal::from(15_000))),
            (other, Some(Decimal::new(3_750, 0))),
        ],
        "the cut is worked out from the bill now, and the largest comes first"
    );
}
