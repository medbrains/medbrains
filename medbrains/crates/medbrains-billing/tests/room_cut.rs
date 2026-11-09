//! Room eligibility, the cut itself and the consent's strength, against a
//! real, migrated database (review of #5270): only room-linked charges are
//! in the base (no ICU bed-days, implants or tests); a hospital without
//! room-category pricing has no cut; a "could not check" row becomes a
//! finding; an unpriced bed leaves the row open with why; consent needs the
//! desk's permission, a witness who is someone else and the current
//! disclosure; a limit too small to store is a 400 and every change is audited.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test room_cut -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, Query, State};
use medbrains_billing::room_limit::{RoomRentLimitBody, set_room_rent_limit};
use medbrains_core::permissions;
use medbrains_ipd::room_eligibility::{
    Allocated, RoomEligibilityQuery, get_room_eligibility, record_room,
};
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
    Inpatient, admit, bed, bed_named, bill, holding, line, policy, policy_without_si, rows, staff,
};
use common::{fixture, pool, scoped, state};

const KIND: &str = "room_over_limit";

/// The desk's pre-check for `bed` during a transfer of `inp`.
async fn check(db: &PgPool, claims: &Claims, inp: &Inpatient, bed: Uuid) -> RoomCheck {
    let q = RoomEligibilityQuery {
        patient_id: inp.patient,
        bed_id: bed,
        admission_id: Some(inp.admission),
    };
    let Json(c) = get_room_eligibility(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(q),
    )
    .await
    .unwrap();
    c
}

/// The allocation as the admission and transfer handlers record it.
async fn allocate_as(
    db: &PgPool,
    claims: &Claims,
    inp: &Inpatient,
    bed: Uuid,
    consent: Option<&RoomConsentInput>,
) {
    let mut tx = scoped(db, inp.tenant).await;
    let a = Allocated {
        admission_id: inp.admission,
        patient_id: inp.patient,
        encounter_id: inp.encounter,
        bed_id: bed,
    };
    record_room(&mut tx, claims, &a, consent).await.unwrap();
    tx.commit().await.unwrap();
}

fn consent(witness: Uuid) -> RoomConsentInput {
    RoomConsentInput {
        consented_by_name: "Meena Rao".to_owned(),
        consenter_relation: "Wife".to_owned(),
        estimated_bill: None,
        witness_user_id: witness,
        disclosure_version: ROOM_DISCLOSURE_VERSION.to_owned(),
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn only_room_linked_charges_are_in_the_base() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    policy(&db, t, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;
    let (_, icu_type) = bed_named(&db, t, 15_000, "ICU").await;
    let inp = admit(&db, &claims, patient).await;
    let invoice = bill(&db, &inp).await;
    let mut tx = scoped(&db, t).await;
    let implant: Uuid = sqlx::query_scalar(
        "WITH c AS (INSERT INTO store_catalog (tenant_id, code, name) \
                    VALUES ($1, $2, 'Knee implant') RETURNING id) \
         INSERT INTO implant_registry (tenant_id, catalog_item_id, patient_id, implant_date) \
         SELECT $1, c.id, $3, current_date FROM c RETURNING id",
    )
    .bind(t)
    .bind(format!("IMP{}", &Uuid::new_v4().simple().to_string()[..6]))
    .bind(patient)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    line(
        &db,
        t,
        invoice,
        ("ipd", "Room rent — Deluxe (2026-11-01)", 8_000, None),
    )
    .await;
    line(&db, t, invoice, ("procedure", "Surgeon fee", 20_000, None)).await;
    line(
        &db,
        t,
        invoice,
        (
            "ipd",
            &format!("Room rent — {icu_type} (2026-11-02)"),
            15_000,
            None,
        ),
    )
    .await;
    line(
        &db,
        t,
        invoice,
        ("ot", "Knee implant", 90_000, Some(implant)),
    )
    .await;
    line(&db, t, invoice, ("lab", "CBC", 500, None)).await;
    line(&db, t, invoice, ("manual", "Misc", 700, None)).await;
    let c = check(&db, &claims, &inp, deluxe).await;
    assert_eq!(c.status, "above");
    // Room rent ₹8,000 + surgeon ₹20,000; not ICU bed-days, the implant, tests or misc.
    assert_eq!(c.associated_so_far, Some(Decimal::from(28_000)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_hospital_without_room_category_pricing_has_no_cut() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    policy(&db, t, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;
    let mut tx = scoped(&db, t).await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'billing', 'differential_billing', 'false')",
    )
    .bind(t)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let inp = admit(&db, &claims, patient).await;
    assert_eq!(
        check(&db, &claims, &inp, deluxe).await.status,
        "no_differential_billing"
    );
    allocate_as(&db, &claims, &inp, deluxe, None).await;
    assert!(rows(&db, t, KIND).await.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_could_not_check_row_becomes_a_finding_and_an_unpriced_bed_leaves_it_open() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    policy(&db, t, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;
    let unpriced = bed(&db, t, 0, "Plain").await;
    let inp = admit(&db, &claims, patient).await;
    let mut tx = scoped(&db, t).await;
    sqlx::query(
        "INSERT INTO charge_attention_items (tenant_id, kind, source_module, source_entity_id, \
           patient_id, encounter_id, reason, created_by) \
         VALUES ($1, 'room_over_limit', 'admission_room', $2, $3, $4, \
                 'room_eligibility_unknown', $5)",
    )
    .bind(t)
    .bind(inp.admission)
    .bind(patient)
    .bind(inp.encounter)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    allocate_as(&db, &claims, &inp, deluxe, None).await;
    let found = rows(&db, t, KIND).await;
    assert_eq!((found.len(), found[0].1.as_str()), (1, "room_over_limit"));

    allocate_as(&db, &claims, &inp, unpriced, None).await;
    let (status, last): (String, Option<String>) = sqlx::query_as(
        "SELECT status, evidence->>'last_check' FROM charge_attention_items WHERE id = $1",
    )
    .bind(found[0].0)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        (status.as_str(), last.as_deref()),
        ("open", Some("unpriced"))
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn consent_needs_the_desks_permission_a_witness_and_the_current_disclosure() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    policy(&db, t, patient, (Some(5_000), None)).await;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;
    let witness = staff(&db, t).await;
    let inp = admit(&db, &claims, patient).await;

    // A ward clerk who may admit but not record consent: the row stays open.
    let clerk = holding(&claims, &[permissions::ipd::admissions::CREATE]);
    allocate_as(&db, &clerk, &inp, deluxe, Some(&consent(witness))).await;
    assert_eq!(rows(&db, t, KIND).await[0].2, "open");

    let mut tx = scoped(&db, t).await;
    let alloc = |c| RoomAllocation {
        tenant_id: t,
        actor: claims.sub,
        admission_id: inp.admission,
        patient_id: patient,
        encounter_id: inp.encounter,
        bed_id: deluxe,
        consent: Some(c),
    };
    let self_witness = consent(claims.sub);
    let err = record_allocation(&mut tx, alloc(&self_witness))
        .await
        .unwrap_err();
    assert!(
        matches!(err, AppError::BadRequest(ref m) if m.ends_with("witnessRequired")),
        "{err:?}"
    );
    let old = RoomConsentInput {
        disclosure_version: "room-cut-2020-v0".to_owned(),
        ..consent(witness)
    };
    let err = record_allocation(&mut tx, alloc(&old)).await.unwrap_err();
    assert!(
        matches!(err, AppError::BadRequest(ref m) if m.ends_with("disclosureOutdated")),
        "{err:?}"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_percentage_without_a_sum_insured_is_unknown_and_a_paisa_above_is_above() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    let deluxe = bed(&db, t, 8_000, "Deluxe").await;
    policy_without_si(&db, t, patient).await;
    assert_eq!(
        check(&db, &claims, &inp, deluxe).await.status,
        "limit_unknown"
    );

    let (claims2, patient2) = fixture(&db).await;
    policy(&db, claims2.tenant_id, patient2, (Some(20_000), None)).await;
    let inp2 = admit(&db, &claims2, patient2).await;
    let near = bed(&db, claims2.tenant_id, 20_000, "Suite").await;
    sqlx::query("UPDATE bed_types SET daily_rate = 20000.01 WHERE tenant_id = $1")
        .bind(claims2.tenant_id)
        .execute(&db)
        .await
        .unwrap();
    let c = check(&db, &claims2, &inp2, near).await;
    assert_eq!(
        (c.status, c.payable_ratio),
        ("above", Some(Decimal::new(999_999, 6)))
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_limit_too_small_to_store_is_refused_and_a_change_is_audited() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let pol = policy(&db, claims.tenant_id, patient, (None, None)).await;
    let tiny = RoomRentLimitBody {
        room_rent_limit_per_day: None,
        room_rent_limit_percent: Some(Decimal::new(1, 3)),
    };
    let err = set_room_rent_limit(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(pol),
        Json(tiny),
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
    let actions: Vec<String> = sqlx::query_scalar(
        "SELECT action FROM audit_log WHERE tenant_id = $1 AND entity_id = $2 ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .bind(pol)
    .fetch_all(&db)
    .await
    .unwrap();
    assert!(
        actions.iter().any(|a| a == "insurance.room_rent_limit.set"),
        "{actions:?}"
    );
    assert!(
        actions.len() >= 2,
        "the row trigger audits the update too: {actions:?}"
    );
}
