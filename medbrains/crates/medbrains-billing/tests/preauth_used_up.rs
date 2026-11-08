//! Pre-auth used up (revenue integrity RFC wave 1.3) against a real,
//! migrated database: the invoice trigger raises one row at 80% of the
//! approval, refreshes it as the bill grows, raises nothing for self-pay,
//! says "approval unknown" when the amount cannot be read, and the desk's
//! enhancement request closes it; a caller without the permission is refused.
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
use common::{fixture, pool, state};

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
        "SELECT request_stage, estimated_cost FROM prior_auth_requests WHERE id = $1",
    )
    .bind(pa)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        (stage.as_str(), asked),
        ("enhancement", Decimal::from(150_000))
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

    // The bill grows on the same approval: no new row.
    raise_bill(&db, inp.tenant, invoice, 99_000).await;
    assert_eq!(rows(&db, inp.tenant, KIND).await.len(), 1);

    // The payer grants the enhancement; at 80% of the new amount, a new row.
    sqlx::query("UPDATE prior_auth_requests SET approved_amount = 150000 WHERE id = $1")
        .bind(pa)
        .execute(&db)
        .await
        .unwrap();
    raise_bill(&db, inp.tenant, invoice, 125_000).await;
    let found = rows(&db, inp.tenant, KIND).await;
    assert_eq!(found.len(), 2, "{found:?}");
    assert_eq!(found[1].2, "open");
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
