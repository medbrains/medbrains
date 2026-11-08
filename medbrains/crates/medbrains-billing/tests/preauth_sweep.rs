//! The pre-auth used-up trigger's edges and the sweep behind it, against a
//! real, migrated database (review of #5270): a trigger that fails is
//! counted and the sweep still raises the row; a bill created with a total
//! fires the check; an expired pre-auth raises nothing; an enhancement keeps
//! the original estimate and is refused when not open; and the inbox's
//! "who may be unattributed" constraint admits all four detector reasons.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test preauth_sweep -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, State};
use medbrains_billing::preauth_sweep::sweep_for;
use medbrains_billing::revenue_alerts::{RequestEnhancementBody, request_enhancement};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

mod common;

use common::inpatient::{admit, approved_preauth, bill, policy, raise_bill, rows};
use common::{fixture, pool, scoped, state};

const KIND: &str = "preauth_used_up";

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_failed_trigger_is_counted_and_the_sweep_still_raises_the_row() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let invoice = bill(&db, &inp).await;

    // The bill grows past 80% while the check is made to fail: the bill saves.
    let mut tx = scoped(&db, inp.tenant).await;
    sqlx::query("SELECT set_config('medbrains.fault_inject', 'preauth_check', true)")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("UPDATE invoices SET total_amount = 90000 WHERE id = $1")
        .bind(invoice)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert!(
        rows(&db, inp.tenant, KIND).await.is_empty(),
        "the failed check raised nothing"
    );
    let failures: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM preauth_check_failures WHERE tenant_id = $1 AND swept_at IS NULL",
    )
    .bind(inp.tenant)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(failures, 1);

    let report = sweep_for(&db, inp.tenant).await.unwrap();
    assert_eq!(
        (report.checked, report.used_up, report.trigger_failures),
        (1, 1, 1)
    );
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].3, Some(Decimal::from(90_000)));
    // A second pass finds nothing new to report and raises nothing twice.
    let again = sweep_for(&db, inp.tenant).await.unwrap();
    assert_eq!(again.trigger_failures, 0);
    assert_eq!(rows(&db, inp.tenant, KIND).await.len(), 1);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_bill_created_with_a_total_fires_the_check_and_an_expired_preauth_does_not() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    let pa = approved_preauth(&db, &inp, pol, Some(10_000)).await;
    let mut tx = scoped(&db, inp.tenant).await;
    sqlx::query(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, \
           admission_id, status, total_amount) VALUES ($1, $2, $3, $4, $5, 'draft', 9000)",
    )
    .bind(inp.tenant)
    .bind(format!("INV-{}", Uuid::new_v4().simple()))
    .bind(patient)
    .bind(inp.encounter)
    .bind(inp.admission)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(
        rows(&db, inp.tenant, KIND).await.len(),
        1,
        "an inserted bill is checked"
    );

    let (claims2, patient2) = fixture(&db).await;
    let inp2 = admit(&db, &claims2, patient2).await;
    let pol2 = policy(&db, inp2.tenant, patient2, (None, None)).await;
    let pa2 = approved_preauth(&db, &inp2, pol2, Some(10_000)).await;
    sqlx::query(
        "UPDATE prior_auth_requests SET expires_at = now() - interval '1 day' WHERE id = $1",
    )
    .bind(pa2)
    .execute(&db)
    .await
    .unwrap();
    let invoice2 = bill(&db, &inp2).await;
    raise_bill(&db, inp2.tenant, invoice2, 9_500).await;
    assert!(
        rows(&db, inp2.tenant, KIND).await.is_empty(),
        "an expired approval is not used"
    );
    let _ = pa;
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_enhancement_keeps_the_estimate_and_is_refused_when_not_open() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    let pa = approved_preauth(&db, &inp, pol, Some(100_000)).await;
    sqlx::query("UPDATE prior_auth_requests SET estimated_cost = 120000 WHERE id = $1")
        .bind(pa)
        .execute(&db)
        .await
        .unwrap();
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 85_000).await;
    let row = rows(&db, inp.tenant, KIND).await[0].0;
    let ask = |n: i64| RequestEnhancementBody {
        additional_amount: Decimal::from(n),
        note: None,
    };

    // A pre-auth back with the payer is not approved: no enhancement on it.
    sqlx::query("UPDATE prior_auth_requests SET status = 'in_review' WHERE id = $1")
        .bind(pa)
        .execute(&db)
        .await
        .unwrap();
    let err = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(ask(1)),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err:?}");
    sqlx::query("UPDATE prior_auth_requests SET status = 'approved' WHERE id = $1")
        .bind(pa)
        .execute(&db)
        .await
        .unwrap();

    let Json(done) = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(ask(50_000)),
    )
    .await
    .unwrap();
    assert_eq!(done.status, "actioned");
    let (estimate, extra): (Decimal, Decimal) = sqlx::query_as(
        "SELECT estimated_cost, enhancement_amount FROM prior_auth_requests WHERE id = $1",
    )
    .bind(pa)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        (estimate, extra),
        (Decimal::from(120_000), Decimal::from(50_000))
    );

    // A second ask while the first waits on the payer is refused, on a new row.
    let mut tx = scoped(&db, inp.tenant).await;
    let second: Uuid = sqlx::query_scalar(
        "INSERT INTO charge_attention_items (tenant_id, kind, source_module, source_entity_id, \
           patient_id, encounter_id, reason, evidence) \
         VALUES ($1, 'preauth_used_up', 'prior_auth', $2, $3, $4, 'preauth_used_up', \
                 '{\"approved_amount\": 99}') RETURNING id",
    )
    .bind(inp.tenant)
    .bind(pa)
    .bind(patient)
    .bind(inp.encounter)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let err = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(second),
        Json(ask(1)),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn every_detector_reason_may_be_unattributed_and_a_failed_charge_may_not() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let insert = |kind: &'static str, reason: &'static str, code: Option<&'static str>| {
        let db = db.clone();
        async move {
            let mut tx = scoped(&db, t).await;
            let r = sqlx::query(
                "INSERT INTO charge_attention_items (tenant_id, kind, source_module, \
                   setting_module, source_entity_id, patient_id, charge_code, quantity, reason) \
                 VALUES ($1, $2, 'test', 'test', $3, $4, $5, CASE WHEN $5 IS NULL THEN NULL \
                         ELSE 1 END, $6)",
            )
            .bind(t)
            .bind(kind)
            .bind(Uuid::new_v4())
            .bind(patient)
            .bind(code)
            .bind(reason)
            .execute(&mut *tx)
            .await;
            r.map(|_| ())
        }
    };
    for (kind, reason, code) in [
        ("charge_not_posted", "unbilled_order", Some("CBC")),
        ("charge_not_posted", "unbilled_consumption", Some("IVSET")),
        ("preauth_used_up", "preauth_used_up", None),
        ("room_over_limit", "room_over_limit", None),
    ] {
        insert(kind, reason, code)
            .await
            .unwrap_or_else(|e| panic!("{reason}: {e}"));
    }
    let refused = insert("charge_not_posted", "charge_failed:database", Some("DIET")).await;
    assert!(refused.is_err(), "a failed charge names who raised it");
}
