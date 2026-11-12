//! The second review of #5270, against a real, migrated database: an
//! action's response hides amounts the caller may not see; a
//! no-longer-insured patient's admission row closes (a settled stay's, in
//! `preauth_settlement`); a "no usable pre-auth" row can be dismissed with a
//! reason, under its own permission, until a pre-auth is created after it; an
//! unreadable threshold is its own fault and the threshold has its own
//! endpoint; and a consent keeps the cut as it is now.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test preauth_review -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, State};
use medbrains_authz::{Relation, Subject};
use medbrains_billing::preauth_alert_settings::{
    UpdatePreauthAlertSettings, get_preauth_alert_settings, put_preauth_alert_settings,
};
use medbrains_billing::preauth_dismiss::{DismissPreauthBody, dismiss_preauth_alert};
use medbrains_billing::preauth_sweep::{VISITS_PER_PASS, sweep_for};
use medbrains_billing::revenue_alerts::{
    RequestEnhancementBody, record_room_consent, request_enhancement,
};
use medbrains_core::permissions;
use medbrains_ipd::room_eligibility::{Allocated, record_room};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::authz_context;
use medbrains_server_core::state::AppState;
use medbrains_server_services::room_eligibility::{ROOM_DISCLOSURE_VERSION, RoomConsentInput};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

mod common;

use common::inpatient::{
    Inpatient, admit, approved_preauth, bed, bill, bill_lines, holding, policy, raise_bill, rows,
    staff,
};
use common::{fixture, pool, scoped, state};

const PREAUTH: &str = "preauth_used_up";
const ROOM: &str = "room_over_limit";

/// A desk user who may act on both kinds, sees the patient, and whose field
/// access hides bill amounts; with the state that holds their grant.
async fn hidden_desk(db: &PgPool, claims: &Claims, patient: Uuid) -> (AppState, Claims) {
    let desk = holding(
        claims,
        &[
            permissions::insurance::enhancement::REQUEST,
            permissions::insurance::room_eligibility::RESOLVE,
            permissions::insurance::preauth_missing::DISMISS,
        ],
    );
    sqlx::query(
        "UPDATE users SET access_matrix = '{\"field_access\": {\"billing.amount\": \"hidden\"}}' \
          WHERE id = $1",
    )
    .bind(desk.sub)
    .execute(db)
    .await
    .unwrap();
    let st = state(db.clone());
    st.authz
        .write_tuple(
            &authz_context(&desk),
            "patient",
            patient,
            Relation::Viewer,
            Subject::User(desk.sub),
            None,
            Some("test: the desk's patient".to_owned()),
        )
        .await
        .unwrap();
    (st, desk)
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

fn consent(witness: Uuid) -> RoomConsentInput {
    RoomConsentInput {
        consented_by_name: "Meena Rao".to_owned(),
        consenter_relation: "Wife".to_owned(),
        estimated_bill: None,
        witness_user_id: witness,
        disclosure_version: ROOM_DISCLOSURE_VERSION.to_owned(),
    }
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

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_action_hides_the_amounts_its_caller_may_not_see() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (Some(5_000), None)).await;
    approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 85_000).await;
    let (st, desk) = hidden_desk(&db, &claims, patient).await;

    let row = rows(&db, inp.tenant, PREAUTH).await[0].0;
    let Json(done) = request_enhancement(
        State(st.clone()),
        Extension(desk.clone()),
        Path(row),
        Json(RequestEnhancementBody {
            additional_amount: Decimal::from(50_000),
            note: None,
        }),
    )
    .await
    .unwrap();
    assert_eq!(done.status, "actioned");
    assert_eq!(
        (done.amount, done.approved_amount, done.enhancement_amount),
        (None, None, None)
    );
    assert!(done.evidence.is_none());

    allocate(
        &db,
        &claims,
        &inp,
        bed(&db, inp.tenant, 8_000, "Deluxe").await,
    )
    .await;
    let room = rows(&db, inp.tenant, ROOM).await[0].0;
    let witness = staff(&db, inp.tenant).await;
    let Json(done) = record_room_consent(
        State(st),
        Extension(desk),
        Path(room),
        Json(consent(witness)),
    )
    .await
    .unwrap();
    assert_eq!(done.status, "actioned");
    assert_eq!(done.amount, None);
    assert!(done.evidence.is_none());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_patient_no_longer_insured_has_their_row_closed_by_the_system() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    admit(&db, &claims, patient).await;
    let pol = policy(&db, t, patient, (None, None)).await;
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    let row = rows(&db, t, PREAUTH).await[0].0;
    sqlx::query("UPDATE patient_insurance SET is_active = false WHERE id = $1")
        .bind(pol)
        .execute(&db)
        .await
        .unwrap();
    let report = sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(report.closed_stale, 1);
    let how = closed_how(&db, row).await;
    assert_eq!(
        (how.0.as_str(), how.1.as_deref()),
        ("actioned", Some("not_insured"))
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_desk_dismisses_a_no_usable_preauth_row_with_a_reason() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, t, patient, (None, None)).await;
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    let row = rows(&db, t, PREAUTH).await[0].0;
    let dismiss = |c: &Claims, id: Uuid, reason: &str, note: Option<&str>| {
        dismiss_preauth_alert(
            State(state(db.clone())),
            Extension(c.clone()),
            Path(id),
            Json(DismissPreauthBody {
                reason: reason.to_owned(),
                note: note.map(ToOwned::to_owned),
            }),
        )
    };

    // Asking for an enhancement is not leave to say none is needed.
    let requester = holding(
        &claims,
        &[
            permissions::insurance::enhancement::VIEW,
            permissions::insurance::enhancement::REQUEST,
        ],
    );
    let err = dismiss(&requester, row, "self_pay", None)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Forbidden), "{err:?}");
    let err = dismiss(&claims, row, "other", None).await.unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)), "{err:?}");

    let Json(done) = dismiss(&claims, row, "self_pay", None).await.unwrap();
    assert_eq!(done.status, "dismissed");
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 AND entity_id = $2 \
            AND action = 'insurance.preauth_missing.dismiss'",
    )
    .bind(t)
    .bind(row)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(audited, 1);

    // Not raised again for this stay, by the bill or the sweep.
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, t, invoice, 20_000).await;
    sweep_for(&db, t, (None, VISITS_PER_PASS)).await.unwrap();
    assert_eq!(rows(&db, t, PREAUTH).await.len(), 1);

    // A pre-auth asked for after the dismissal makes it out of date: the
    // next check raises the stay again, now as "not approved".
    sqlx::query(
        "INSERT INTO prior_auth_requests (tenant_id, pa_number, patient_id, \
           patient_insurance_id, service_type, encounter_id, status) \
         VALUES ($1, $2, $3, $5, 'surgery', $4, 'submitted')",
    )
    .bind(t)
    .bind(format!("PA-{}", Uuid::new_v4().simple()))
    .bind(inp.patient)
    .bind(inp.encounter)
    .bind(pol)
    .execute(&db)
    .await
    .unwrap();
    raise_bill(&db, t, invoice, 25_000).await;
    let again = rows(&db, t, PREAUTH).await;
    assert_eq!((again.len(), again[1].2.as_str()), (2, "open"));
    let cause: Option<String> =
        sqlx::query_scalar("SELECT evidence->>'cause' FROM charge_attention_items WHERE id = $1")
            .bind(again[1].0)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(cause.as_deref(), Some("not_approved"));

    // A desk whose amounts are hidden dismisses without seeing them.
    let (st, desk) = hidden_desk(&db, &claims, patient).await;
    let Json(done) = dismiss_preauth_alert(
        State(st),
        Extension(desk),
        Path(again[1].0),
        Json(DismissPreauthBody {
            reason: "not_covered".to_owned(),
            note: None,
        }),
    )
    .await
    .unwrap();
    assert_eq!((done.status.as_str(), done.amount), ("dismissed", None));
    assert!(done.evidence.is_none());

    // An approval nearly used up is answered by an enhancement, not dismissed.
    let (claims2, patient2) = fixture(&db).await;
    let inp2 = admit(&db, &claims2, patient2).await;
    let pol2 = policy(&db, inp2.tenant, patient2, (None, None)).await;
    approved_preauth(&db, &inp2, pol2, Some(10_000)).await;
    let invoice2 = bill(&db, &inp2).await;
    raise_bill(&db, inp2.tenant, invoice2, 9_000).await;
    let used = rows(&db, inp2.tenant, PREAUTH).await[0].0;
    let err = dismiss(&claims2, used, "self_pay", None).await.unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_unreadable_threshold_is_its_own_fault_and_the_endpoint_refuses_one() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let put = |c: &Claims, pct: i64| {
        put_preauth_alert_settings(
            State(state(db.clone())),
            Extension(c.clone()),
            Json(UpdatePreauthAlertSettings {
                threshold_percent: pct,
            }),
        )
    };
    for bad in [0, 101] {
        let err = put(&claims, bad).await.unwrap_err();
        assert!(matches!(err, AppError::BadRequest(_)), "{bad}: {err:?}");
    }
    let clerk = holding(&claims, &[permissions::insurance::enhancement::REQUEST]);
    assert!(matches!(
        put(&clerk, 90).await.unwrap_err(),
        AppError::Forbidden
    ));
    let Json(saved) = put(&claims, 90).await.unwrap();
    assert_eq!(
        (saved.threshold_percent, saved.invalid),
        (Some(90.0), false)
    );

    // A value written round the endpoint is shown as unreadable, not as 80,
    // and the rows it touches still warn, can still be enhanced, and say so.
    sqlx::query(
        "UPDATE tenant_settings SET value = '\"80%\"' \
          WHERE tenant_id = $1 AND category = 'preauth_alerts'",
    )
    .bind(t)
    .execute(&db)
    .await
    .unwrap();
    let Json(read) =
        get_preauth_alert_settings(State(state(db.clone())), Extension(claims.clone()))
            .await
            .unwrap();
    assert_eq!((read.threshold_percent, read.invalid), (None, true));
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, t, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, t, invoice, 85_000).await;
    let found = rows(&db, t, PREAUTH).await;
    assert_eq!(found[0].1, "preauth_used_up");
    let Json(done) = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(found[0].0),
        Json(RequestEnhancementBody {
            additional_amount: Decimal::from(10_000),
            note: None,
        }),
    )
    .await
    .unwrap();
    let evidence = done.evidence.unwrap();
    assert_eq!(evidence["threshold_invalid"], serde_json::json!(true));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_consent_keeps_the_cut_on_the_bill_as_it_is_now() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let t = claims.tenant_id;
    let inp = admit(&db, &claims, patient).await;
    policy(&db, t, patient, (Some(5_000), None)).await;
    allocate(&db, &claims, &inp, bed(&db, t, 8_000, "Deluxe").await).await;
    let row = rows(&db, t, ROOM).await[0].0;
    // Raised at allocation with nothing billed; ₹1,00,000 room-linked since.
    let invoice = bill(&db, &inp).await;
    bill_lines(&db, t, invoice, 100_000, 30_000).await;
    let witness = staff(&db, t).await;
    let Json(_) = record_room_consent(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(consent(witness)),
    )
    .await
    .unwrap();
    let (bill_seen, cut): (Option<Decimal>, Option<Decimal>) = sqlx::query_as(
        "SELECT estimated_bill, estimated_deduction FROM room_upgrade_consents \
          WHERE tenant_id = $1 AND admission_id = $2",
    )
    .bind(t)
    .bind(inp.admission)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        (bill_seen, cut),
        (Some(Decimal::from(100_000)), Some(Decimal::from(37_500)))
    );
}
