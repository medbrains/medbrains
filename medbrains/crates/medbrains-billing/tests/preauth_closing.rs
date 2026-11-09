//! The fifth review of #5270, against a real, migrated database: how the
//! pre-auth and room rows close as the system. A "could not check" row
//! closes on the next good check and a settled stay takes every row with it;
//! paid interim bills do not settle a stay, a submitted claim does; a stay
//! discharged past the lookback is no longer swept; a deleted admission
//! closes its rows; and a pre-auth that expires spares its "could not
//! check" row.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test preauth_closing -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::str::FromStr;

use medbrains_billing::preauth_sweep::{VISITS_PER_PASS, sweep_for};
use medbrains_ipd::room_eligibility::{Allocated, record_room};
use medbrains_server_core::middleware::auth::Claims;
use sqlx::PgPool;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use uuid::Uuid;

mod common;

use common::inpatient::{Inpatient, admit, approved_preauth, bed, bill, policy, raise_bill, rows};
use common::{fixture, insert_patient, pool, scoped};

const PREAUTH: &str = "preauth_used_up";
const ROOM: &str = "room_over_limit";

/// A pool whose every connection makes the pre-auth check fail.
async fn faulty_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let opts = PgConnectOptions::from_str(&url)
        .unwrap()
        .options([("medbrains.fault_inject", "preauth_check")]);
    PgPoolOptions::new()
        .max_connections(2)
        .connect_with(opts)
        .await
        .unwrap()
}

/// The admission leaves hospital `days_ago` days ago.
async fn discharge(db: &PgPool, inp: &Inpatient, days_ago: i32) {
    sqlx::query(
        "UPDATE admissions SET status = 'discharged', \
                discharged_at = now() - make_interval(days => $2) WHERE id = $1",
    )
    .bind(inp.admission)
    .bind(days_ago)
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

/// Open rows on the visit's pre-auths.
async fn open_preauth_rows(db: &PgPool, inp: &Inpatient) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM charge_attention_items \
          WHERE encounter_id = $1 AND source_module = 'prior_auth' AND status = 'open'",
    )
    .bind(inp.encounter)
    .fetch_one(db)
    .await
    .unwrap()
}

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

/// An insured inpatient with ₹1,00,000 approved and a ₹50,000 bill (within).
async fn within_approval(db: &PgPool, claims: &Claims, patient: Uuid) -> (Inpatient, Uuid, Uuid) {
    let inp = admit(db, claims, patient).await;
    let pol = policy(db, inp.tenant, patient, (None, None)).await;
    let pa = approved_preauth(db, &inp, pol, Some(100_000)).await;
    let invoice = bill(db, &inp).await;
    raise_bill(db, inp.tenant, invoice, 50_000).await;
    (inp, pa, invoice)
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_failed_check_closes_on_the_next_good_one_and_settling_closes_the_rest() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let (inp, _, invoice) = within_approval(&db, &claims, patient).await;
    assert!(rows(&db, t, PREAUTH).await.is_empty());

    let report = sweep_for(&faulty_pool().await, t, (None, VISITS_PER_PASS))
        .await
        .unwrap();
    assert_eq!(report.unknown, 1);
    let found = rows(&db, t, PREAUTH).await;
    assert_eq!(
        (found[0].1.as_str(), found[0].2.as_str()),
        ("preauth_approval_unknown", "open")
    );

    // The next pass reads the approval: within it, and the fault row closes.
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    let how = closed_how(&db, found[0].0).await;
    assert_eq!(
        (how.0.as_str(), how.1.as_deref()),
        ("actioned", Some("check_ok"))
    );

    // A later used-up row, then the stay is over and settled: nothing stays open.
    raise_bill(&db, t, invoice, 90_000).await;
    assert_eq!(open_preauth_rows(&db, &inp).await, 1);
    discharge(&db, &inp, 0).await;
    settle(&db, &inp).await;
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!((report.checked, report.closed_stale), (0, 1));
    assert_eq!(open_preauth_rows(&db, &inp).await, 0);
    let used = rows(&db, t, PREAUTH).await[1].0;
    assert_eq!(closed_how(&db, used).await.1.as_deref(), Some("settled"));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_expired_preauth_spares_its_could_not_check_row() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let (_, pa, _) = within_approval(&db, &claims, patient).await;
    sweep_for(&faulty_pool().await, t, (None, VISITS_PER_PASS))
        .await
        .unwrap();
    let unknown = rows(&db, t, PREAUTH).await[0].0;
    sqlx::query(
        "UPDATE prior_auth_requests SET expires_at = now() - interval '1 hour' WHERE id = $1",
    )
    .bind(pa)
    .execute(&db)
    .await
    .unwrap();
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(closed_how(&db, unknown).await, ("open".to_owned(), None));
    let found = rows(&db, t, PREAUTH).await;
    assert_eq!(found[1].1, "preauth_missing_or_expired");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn paid_interim_bills_do_not_settle_a_discharged_stay() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (None, None)).await;
    let invoice = bill(&db, &inp).await;
    sqlx::query("UPDATE invoices SET is_interim = true WHERE id = $1")
        .bind(invoice)
        .execute(&db)
        .await
        .unwrap();
    raise_bill(&db, t, invoice, 20_000).await;
    settle(&db, &inp).await;
    discharge(&db, &inp, 0).await;

    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(
        (report.checked, report.closed_stale),
        (1, 0),
        "the final bill is still to come"
    );
    let found = rows(&db, t, PREAUTH).await;
    assert_eq!(found[0].2, "open");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_submitted_claim_settles_a_stay_with_a_bill_still_owed() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (None, None)).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, t, invoice, 30_000).await;
    discharge(&db, &inp, 0).await;
    assert_eq!(
        sweep_for(&db, t, (None, VISITS_PER_PASS))
            .await
            .unwrap()
            .checked,
        1
    );

    let mut tx = scoped(&db, t).await;
    sqlx::query(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, \
           status) VALUES ($1, $2, $3, 'Star Health', 'claim_submitted')",
    )
    .bind(t)
    .bind(invoice)
    .bind(patient)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!((report.checked, report.closed_stale), (0, 1));
    let row = rows(&db, t, PREAUTH).await[0].0;
    assert_eq!(closed_how(&db, row).await.1.as_deref(), Some("settled"));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_stay_discharged_past_the_lookback_is_not_swept() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let mut tx = scoped(&db, t).await;
    let other = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    for (p, days_ago) in [(patient, 100), (other, 10)] {
        let inp = admit(&db, &claims, p).await;
        policy(&db, t, p, (None, None)).await;
        let invoice = bill(&db, &inp).await;
        raise_bill(&db, t, invoice, 20_000).await;
        discharge(&db, &inp, days_ago).await;
    }
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(report.checked, 1, "only the stay discharged within 90 days");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_deleted_admission_closes_its_rows() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (Some(5_000), None)).await;
    allocate(&db, &claims, &inp, bed(&db, t, 8_000, "Deluxe").await).await;
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    let missing = rows(&db, t, PREAUTH).await[0].0;
    let room = rows(&db, t, ROOM).await[0].0;

    sqlx::query("UPDATE admissions SET deleted_at = now() WHERE id = $1")
        .bind(inp.admission)
        .execute(&db)
        .await
        .unwrap();
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(report.closed_stale, 2);
    for row in [missing, room] {
        let how = closed_how(&db, row).await;
        assert_eq!(
            (how.0.as_str(), how.1.as_deref()),
            ("actioned", Some("admission_deleted"))
        );
    }
}
