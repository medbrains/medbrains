//! The fifth review of #5270, against a real, migrated database: the desk's
//! list keeps a room row at its stored amount when its ratio is not a plain
//! decimal, lists oldest first for a caller who may not see amounts, and
//! counts every row it matched; and the inbox admits each system resolution
//! only on the source that can have it.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test preauth_list_guards -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Query, State};
use medbrains_authz::{Relation, Subject};
use medbrains_billing::revenue_alerts::{
    ListRevenueAlertsQuery, RevenueAlert, list_revenue_alerts,
};
use medbrains_core::permissions;
use medbrains_ipd::room_eligibility::{Allocated, record_room};
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::authz_context;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

mod common;

use common::inpatient::{
    Inpatient, admit, approved_preauth, bed, bill, holding, line, policy, raise_bill, rows,
};
use common::{fixture, insert_patient, pool, scoped, state};

const PREAUTH: &str = "preauth_used_up";
const ROOM: &str = "room_over_limit";

/// The kind's open rows as `claims` sees them, and the total matched.
async fn list(st: &AppState, claims: &Claims, kind: &str) -> (Vec<RevenueAlert>, i64) {
    let Json(listed) = list_revenue_alerts(
        State(st.clone()),
        Extension(claims.clone()),
        Query(ListRevenueAlertsQuery {
            kind: kind.to_owned(),
            status: None,
        }),
    )
    .await
    .unwrap();
    (listed.data, listed.meta.total)
}

/// An insured inpatient with ₹1,00,000 approved and a bill of `total`.
async fn billed(db: &PgPool, claims: &Claims, patient: Uuid, total: i64) -> Inpatient {
    let inp = admit(db, claims, patient).await;
    let pol = policy(db, inp.tenant, patient, (None, None)).await;
    approved_preauth(db, &inp, pol, Some(100_000)).await;
    let invoice = bill(db, &inp).await;
    raise_bill(db, inp.tenant, invoice, total).await;
    inp
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_ratio_that_is_not_a_plain_decimal_keeps_the_stored_amount() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (Some(5_000), None)).await;
    let mut tx = scoped(&db, t).await;
    let a = Allocated {
        admission_id: inp.admission,
        patient_id: patient,
        encounter_id: inp.encounter,
        bed_id: bed(&db, t, 8_000, "Deluxe").await,
    };
    record_room(&mut tx, &claims, &a, None).await.unwrap();
    tx.commit().await.unwrap();
    let invoice = bill(&db, &inp).await;
    line(&db, t, invoice, ("ipd", "Room", 10_000, None)).await;
    let st = state(db.clone());
    assert_eq!(
        list(&st, &claims, ROOM).await.0[0].amount,
        Some(Decimal::from(3_750))
    );

    sqlx::query(
        "UPDATE charge_attention_items \
            SET amount = 1234, evidence = evidence || '{\"payable_ratio\": \"6.25e-1\"}' \
          WHERE id = $1",
    )
    .bind(rows(&db, t, ROOM).await[0].0)
    .execute(&db)
    .await
    .unwrap();
    assert_eq!(
        list(&st, &claims, ROOM).await.0[0].amount,
        Some(Decimal::from(1_234))
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn hidden_amounts_list_oldest_first_and_every_list_counts_its_rows() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let mut tx = scoped(&db, t).await;
    let other = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    billed(&db, &claims, patient, 85_000).await;
    billed(&db, &claims, other, 95_000).await;
    let st = state(db.clone());
    let (seen, total) = list(&st, &claims, PREAUTH).await;
    let order: Vec<_> = seen.iter().map(|r| r.patient_id).collect();
    assert_eq!((order, total), (vec![other, patient], 2), "largest first");

    let desk = holding(&claims, &[permissions::insurance::enhancement::VIEW]);
    sqlx::query(
        "UPDATE users SET access_matrix = '{\"field_access\": {\"billing.amount\": \"hidden\"}}' \
          WHERE id = $1",
    )
    .bind(desk.sub)
    .execute(&db)
    .await
    .unwrap();
    for p in [patient, other] {
        st.authz
            .write_tuple(
                &authz_context(&desk),
                "patient",
                p,
                Relation::Viewer,
                Subject::User(desk.sub),
                None,
                Some("test: the desk's patient".to_owned()),
            )
            .await
            .unwrap();
    }
    let (seen, _) = list(&st, &desk, PREAUTH).await;
    let order: Vec<_> = seen.iter().map(|r| (r.patient_id, r.amount)).collect();
    assert_eq!(
        order,
        vec![(patient, None), (other, None)],
        "oldest first, no amounts"
    );
}

/// Insert a row the system closed with `resolution`; whether the inbox took it.
async fn system_closed(
    db: &PgPool,
    (tenant, patient): (Uuid, Uuid),
    (source, reason, resolution): (&str, &str, &str),
) -> Result<(), String> {
    let mut tx = scoped(db, tenant).await;
    let done = sqlx::query(
        "INSERT INTO charge_attention_items (tenant_id, kind, source_module, source_entity_id, \
           patient_id, reason, status, resolved_at, evidence) \
         VALUES ($1, 'preauth_used_up', $3, gen_random_uuid(), $2, $4, 'actioned', now(), \
                 jsonb_build_object('resolution', $5::text))",
    )
    .bind(tenant)
    .bind(patient)
    .bind(source)
    .bind(reason)
    .bind(resolution)
    .execute(&mut *tx)
    .await;
    tx.rollback().await.unwrap();
    done.map(|_| ()).map_err(|e| e.to_string())
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn each_system_resolution_is_admitted_only_on_its_source() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let who = (claims.tenant_id, patient);
    for ok in [
        ("prior_auth", "preauth_approval_unknown", "check_ok"),
        ("prior_auth", "preauth_approval_unknown", "settled"),
        ("prior_auth", "preauth_used_up", "settled"),
        ("admission_room", "room_over_limit", "settled"),
    ] {
        system_closed(&db, who, ok)
            .await
            .unwrap_or_else(|e| panic!("{ok:?}: {e}"));
    }
    for refused in [
        ("lab_order", "preauth_used_up", "settled"),
        ("prior_auth", "preauth_used_up", "check_ok"),
        ("admission_room", "room_over_limit", "check_ok"),
        ("admission_room", "room_over_limit", "preauth_found"),
        ("prior_auth", "preauth_used_up", "admission_deleted"),
    ] {
        let err = system_closed(&db, who, refused).await.unwrap_err();
        assert!(
            err.contains("charge_attention_resolved_has_who"),
            "{refused:?}: {err}"
        );
    }
}
