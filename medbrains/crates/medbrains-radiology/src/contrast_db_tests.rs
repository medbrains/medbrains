//! Contrast screening against a real schema: which kidney result it reads.
#![allow(clippy::expect_used)]

use medbrains_db_migrations::testing::{add_patient, add_tenant, fresh_db};
use uuid::Uuid;

use super::{ContrastScreeningRequest, ContrastScreeningResult, screen_patient};

/// A verified result for `patient`, collected `days_ago`. Foreign keys
/// (order, test, user) dangle with triggers off: only the read rows matter.
async fn result(owner: &sqlx::PgPool, ids: (Uuid, Uuid), days_ago: i32, row: (&str, &str, &str)) {
    let (name, value, unit) = row;
    let mut conn = owner.acquire().await.expect("conn");
    sqlx::query("SET session_replication_role = replica")
        .execute(&mut *conn)
        .await
        .expect("triggers off");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
             status, collected_at, verified_at) \
         VALUES ($1, gen_random_uuid(), $2, gen_random_uuid(), gen_random_uuid(), \
             'verified', now() - make_interval(days => $3), now() - make_interval(days => $3)) \
         RETURNING id",
    )
    .bind(ids.0)
    .bind(ids.1)
    .bind(days_ago)
    .fetch_one(&mut *conn)
    .await
    .expect("order");
    sqlx::query(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, \
             numeric_value, created_at) \
         VALUES ($1, $2, $3, $4, $5, $4::numeric, now() - make_interval(days => $6))",
    )
    .bind(ids.0)
    .bind(order)
    .bind(name)
    .bind(value)
    .bind(unit)
    .bind(days_ago)
    .execute(&mut *conn)
    .await
    .expect("result");
}

/// The screening for a patient whose only lab results are `results`.
async fn screening_with(results: &[(i32, (&str, &str, &str))]) -> ContrastScreeningResult {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "CONTRAST").await.expect("tenant");
    let patient = add_patient(&owner, tenant, "UH-CONTRAST-1")
        .await
        .expect("patient");
    for (days_ago, row) in results {
        result(&owner, (tenant, patient), *days_ago, *row).await;
    }
    let body = ContrastScreeningRequest {
        patient_id: patient,
        prior_contrast_reaction: None,
        on_metformin: false,
    };
    let mut tx = owner.begin().await.expect("tx");
    screen_patient(&mut tx, tenant, &body)
        .await
        .expect("screen")
}

#[tokio::test]
async fn a_stale_egfr_is_not_checked_not_low() {
    let r = screening_with(&[(200, ("eGFR", "90", "mL/min/1.73m2"))]).await;
    assert_eq!(
        (r.cin_risk, r.clearance),
        ("not_checked", "egfr_required"),
        "a 200-day-old eGFR cleared the patient for contrast"
    );
}

#[tokio::test]
async fn a_creatinine_clearance_is_not_an_egfr() {
    let r = screening_with(&[(2, ("Creatinine clearance (GFR)", "90", "mL/min"))]).await;
    assert_eq!(
        r.cin_risk, "not_checked",
        "a clearance in mL/min was read as an eGFR"
    );
}

#[tokio::test]
async fn a_recent_low_egfr_holds_for_review() {
    let r = screening_with(&[(3, ("eGFR", "25", "mL/min/1.73 m²"))]).await;
    assert_eq!((r.cin_risk, r.clearance), ("high", "hold_review"));
}
