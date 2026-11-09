//! Pre-auth used up (revenue integrity RFC wave 1.3) against a real,
//! migrated database: the invoice trigger raises one row at the hospital's
//! threshold of the approval (80% unless set), refreshes it as the bill
//! grows, warns again at 100% after an enhancement was asked, raises nothing
//! for self-pay, says "approval unknown" when the amount cannot be read (and
//! refuses an enhancement on it), and the desk's enhancement request closes
//! it; a caller without the permission is refused.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test preauth_used_up -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use axum::Extension;
use axum::Json;
use axum::extract::{Path, Query, State};
use medbrains_billing::charge_attention::{ListChargeAttentionQuery, list_charge_attention};
use medbrains_billing::revenue_alerts::{
    ListRevenueAlertsQuery, RequestEnhancementBody, list_revenue_alerts, request_enhancement,
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

mod common;

use common::inpatient::{admit, approved_preauth, bill, holding, policy, raise_bill, rows};
use common::{fixture, pool, scoped, state};

const KIND: &str = "preauth_used_up";

fn list_query() -> Query<ListRevenueAlertsQuery> {
    Query(ListRevenueAlertsQuery {
        kind: KIND.to_owned(),
        status: None,
    })
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_bill_reaching_80_percent_raises_one_row_that_follows_the_bill() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let invoice = bill(&db, &inp).await;

    raise_bill(&db, inp.tenant, invoice, 50_000).await;
    assert!(
        rows(&db, inp.tenant, KIND).await.is_empty(),
        "50% raises nothing"
    );

    raise_bill(&db, inp.tenant, invoice, 80_000).await;
    raise_bill(&db, inp.tenant, invoice, 90_000).await;
    raise_bill(&db, inp.tenant, invoice, 95_000).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(
        found.len(),
        1,
        "one row however often the bill grows: {found:?}"
    );
    assert_eq!(found[0].1, "preauth_used_up");
    assert_eq!(
        found[0].3,
        Some(Decimal::from(95_000)),
        "the row follows the bill"
    );

    let Json(listed) = list_revenue_alerts(
        State(state(db.clone())),
        Extension(claims.clone()),
        list_query(),
    )
    .await
    .unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].payer.as_deref(), Some("Star Health"));
    let approved = listed[0].evidence.as_ref().unwrap()["approved_amount"].as_f64();
    assert_eq!(approved, Some(100_000.0));

    // The charge queue keeps to charges: this row is not on it.
    let Json(charges) = list_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Query(ListChargeAttentionQuery {
            status: None,
            kind: None,
            page: None,
            limit: None,
        }),
    )
    .await
    .unwrap();
    assert_eq!(charges.meta.total, 0);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_self_pay_inpatient_raises_nothing() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 500_000).await;
    assert!(rows(&db, inp.tenant, KIND).await.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_unreadable_approval_is_a_fault_row_not_within_limit() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, None).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 1_000).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].1, "preauth_approval_unknown");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn requesting_an_enhancement_closes_the_row_until_the_approval_changes() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    let pa = approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 85_000).await;
    let row = rows(&db, inp.tenant, KIND).await[0].0;

    let body = RequestEnhancementBody {
        additional_amount: Decimal::from(50_000),
        note: Some("Extended stay, ICU two days".to_owned()),
    };
    let Json(done) = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(body),
    )
    .await
    .unwrap();
    assert_eq!(done.status, "actioned");
    let (stage, asked): (String, Decimal) = sqlx::query_as(
        "SELECT request_stage, enhancement_amount FROM prior_auth_requests WHERE id = $1",
    )
    .bind(pa)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        (stage.as_str(), asked),
        ("enhancement", Decimal::from(50_000))
    );

    // Asking again on the closed row is a conflict, not a second request.
    let again = RequestEnhancementBody {
        additional_amount: Decimal::ONE,
        note: None,
    };
    let err = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(again),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err:?}");

    // The bill grows on the same approval, still short of it: no new row.
    raise_bill(&db, inp.tenant, invoice, 99_000).await;
    assert_eq!(rows(&db, inp.tenant, KIND).await.len(), 1);

    // The payer has not granted it (or denied it) and the bill passes the
    // approval: the desk is warned again, at the second band.
    raise_bill(&db, inp.tenant, invoice, 101_000).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 2, "{found:?}");
    assert_eq!(
        (found[1].1.as_str(), found[1].2.as_str()),
        ("preauth_used_up", "open")
    );
    let band: Option<f64> = sqlx::query_scalar(
        "SELECT (evidence->>'band')::float8 FROM charge_attention_items WHERE id = $1",
    )
    .bind(found[1].0)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(band, Some(100.0));

    // The payer grants the enhancement: the open row follows the new approval.
    sqlx::query("UPDATE prior_auth_requests SET approved_amount = 150000 WHERE id = $1")
        .bind(pa)
        .execute(&db)
        .await
        .unwrap();
    raise_bill(&db, inp.tenant, invoice, 125_000).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 2, "{found:?}");
    let approved: Option<f64> = sqlx::query_scalar(
        "SELECT (evidence->>'approved_amount')::float8 FROM charge_attention_items WHERE id = $1",
    )
    .bind(found[1].0)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(approved, Some(150_000.0));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_hospital_sets_the_share_of_the_approval_that_warns() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, Some(100_000)).await;
    let mut tx = scoped(&db, inp.tenant).await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'billing', 'preauth_alert_threshold_percent', '90')",
    )
    .bind(inp.tenant)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 85_000).await;
    assert!(
        rows(&db, inp.tenant, KIND).await.is_empty(),
        "85% is under 90%"
    );
    raise_bill(&db, inp.tenant, invoice, 90_000).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 1);
    let pct: Option<f64> = sqlx::query_scalar(
        "SELECT (evidence->>'threshold_percent')::float8 FROM charge_attention_items WHERE id = $1",
    )
    .bind(found[0].0)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(pct, Some(90.0), "the row says which share warned");

    // A threshold out of range is a fault the trigger records, never a guess.
    sqlx::query(
        "UPDATE tenant_settings SET value = '0' WHERE tenant_id = $1 \
            AND key = 'preauth_alert_threshold_percent'",
    )
    .bind(inp.tenant)
    .execute(&db)
    .await
    .unwrap();
    raise_bill(&db, inp.tenant, invoice, 95_000).await;
    let failures: i64 =
        sqlx::query_scalar("SELECT count(*) FROM preauth_check_failures WHERE tenant_id = $1")
            .bind(inp.tenant)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(failures, 1);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn no_enhancement_on_a_row_whose_approval_is_unknown() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let inp = admit(&db, &claims, patient).await;
    let pol = policy(&db, inp.tenant, patient, (None, None)).await;
    approved_preauth(&db, &inp, pol, None).await;
    let invoice = bill(&db, &inp).await;
    raise_bill(&db, inp.tenant, invoice, 1_000).await;
    let row = rows(&db, inp.tenant, KIND).await[0].0;
    let err = request_enhancement(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(row),
        Json(RequestEnhancementBody {
            additional_amount: Decimal::ONE,
            note: None,
        }),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_permission_the_desk_cannot_see_or_request() {
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let clerk = holding(&claims, &[permissions::billing::charge_attention::VIEW]);
    let err = list_revenue_alerts(
        State(state(db.clone())),
        Extension(clerk.clone()),
        list_query(),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Forbidden), "{err:?}");

    let viewer = holding(&claims, &[permissions::insurance::enhancement::VIEW]);
    let body = RequestEnhancementBody {
        additional_amount: Decimal::ONE,
        note: None,
    };
    let err = request_enhancement(
        State(state(db.clone())),
        Extension(viewer),
        Path(Uuid::new_v4()),
        Json(body),
    )
    .await
    .unwrap_err();
    assert!(matches!(err, AppError::Forbidden), "{err:?}");
    let _ = patient;
}
