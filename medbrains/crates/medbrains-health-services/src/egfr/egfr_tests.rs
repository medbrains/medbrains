//! Which result counts as the patient's eGFR: the pure selection rules, then
//! the full read against a migrated database (settings, admission, labs).
#![allow(clippy::unwrap_used, clippy::expect_used)]

use chrono::{Duration, Utc};
use medbrains_db_migrations::testing::{add_patient, add_tenant, fresh_db};
use uuid::Uuid;

use super::{EgfrCandidate, EgfrLookup, latest_egfr, patient_latest_egfr};

/// A candidate `days_ago` old.
fn cand(name: &str, unit: Option<&str>, loinc: Option<&str>, days_ago: i64) -> EgfrCandidate {
    EgfrCandidate {
        value: 42.0,
        unit: unit.map(str::to_owned),
        parameter_name: name.to_owned(),
        test_loinc: loinc.map(str::to_owned),
        measured_at: Utc::now() - Duration::days(days_ago),
    }
}

#[test]
fn selection_table() {
    let cases = [
        (cand("eGFR", Some("mL/min/1.73m2"), None, 5), true),
        (cand("eGFR", Some("mL/min/1.73 m²"), None, 5), true),
        (
            cand("Result", Some("mL/min/1.73m2"), Some("98979-8"), 5),
            true,
        ),
        (cand("eGFR", Some("mL/min/1.73m2"), None, 29), true),
        (cand("eGFR", Some("mL/min/1.73m2"), None, 31), false),
        (cand("eGFR", Some("mL/min"), None, 5), false),
        (cand("eGFR", None, None, 5), false),
        (
            cand("Creatinine clearance (GFR)", Some("mL/min/1.73m2"), None, 5),
            false,
        ),
        (
            cand("Result", Some("mL/min/1.73m2"), Some("33558-8"), 5),
            false,
        ),
    ];
    for (c, want) in &cases {
        assert_eq!(
            latest_egfr(std::slice::from_ref(c), Utc::now(), 30).is_some(),
            *want,
            "{c:?}"
        );
    }
}

#[test]
fn the_newest_qualifying_result_wins() {
    let mut older = cand("eGFR", Some("mL/min/1.73m2"), None, 30);
    older.value = 70.0;
    let newer = cand("eGFR", Some("mL/min/1.73m2"), None, 2);
    let got = latest_egfr(&[older, newer], Utc::now(), 30);
    assert!(got.is_some_and(|r| (r.value - 42.0).abs() < f64::EPSILON));
}

/// The inpatient window (default 7 days) refuses what the outpatient one takes.
#[test]
fn the_window_is_the_one_passed() {
    let ten_days = cand("eGFR", Some("mL/min/1.73m2"), None, 10);
    let one = std::slice::from_ref(&ten_days);
    assert!(latest_egfr(one, Utc::now(), 7).is_none());
    assert!(latest_egfr(one, Utc::now(), 30).is_some());
}

/// Run `sql` with triggers off, so foreign keys the eGFR read does not
/// follow (encounter, test, user) may dangle.
async fn insert_loose(
    owner: &sqlx::PgPool,
    sql: sqlx::query::Query<'_, sqlx::Postgres, sqlx::postgres::PgArguments>,
) {
    let mut conn = owner.acquire().await.expect("conn");
    sqlx::query("SET session_replication_role = replica")
        .execute(&mut *conn)
        .await
        .expect("triggers off");
    sql.execute(&mut *conn).await.expect("insert");
}

/// A verified result for `patient`, collected `days_ago`.
async fn result(owner: &sqlx::PgPool, ids: (Uuid, Uuid), days_ago: i32, row: (&str, &str, &str)) {
    let (name, value, unit) = row;
    let insert = sqlx::query(
        "WITH o AS (INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, \
             ordered_by, status, collected_at, verified_at) \
           VALUES ($1, gen_random_uuid(), $2, gen_random_uuid(), gen_random_uuid(), 'verified', \
             now() - make_interval(days => $3), now() - make_interval(days => $3)) RETURNING id) \
         INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, \
             numeric_value, created_at) \
         SELECT $1, o.id, $4, $5, $6, $5::numeric, now() - make_interval(days => $3) FROM o",
    )
    .bind(ids.0)
    .bind(ids.1)
    .bind(days_ago)
    .bind(name)
    .bind(value)
    .bind(unit);
    insert_loose(owner, insert).await;
}

/// The lookup for a new patient with these results, admitted or not.
async fn lookup_with(results: &[(i32, (&str, &str, &str))], admitted: bool) -> EgfrLookup {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "EGFR").await.expect("tenant");
    let patient = add_patient(&owner, tenant, "UH-EGFR-1")
        .await
        .expect("patient");
    for (days_ago, row) in results {
        result(&owner, (tenant, patient), *days_ago, *row).await;
    }
    if admitted {
        let admit = sqlx::query(
            "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                 admission_number) \
             VALUES ($1, gen_random_uuid(), $2, gen_random_uuid(), 'IP-EGFR-1')",
        )
        .bind(tenant)
        .bind(patient);
        insert_loose(&owner, admit).await;
    }
    let mut conn = owner.acquire().await.expect("conn");
    patient_latest_egfr(&mut conn, tenant, patient)
        .await
        .expect("egfr")
}

#[tokio::test]
async fn a_stale_egfr_does_not_dose() {
    let got = lookup_with(&[(200, ("eGFR", "25", "mL/min/1.73m2"))], false).await;
    assert!(got.reading.is_none(), "a 200-day-old eGFR was used");
}

#[tokio::test]
async fn an_egfr_in_another_unit_does_not_dose() {
    let got = lookup_with(&[(3, ("eGFR (Cockcroft-Gault)", "40", "mL/min"))], false).await;
    assert!(
        got.reading.is_none(),
        "a clearance in mL/min was read as an eGFR per 1.73 m²"
    );
}

#[tokio::test]
async fn a_recent_egfr_doses() {
    let got = lookup_with(&[(10, ("eGFR", "42", "mL/min/1.73 m²"))], false).await;
    assert_eq!((got.inpatient, got.window_days), (false, 30));
    assert!(got.reading.is_some());
}

/// A 10-day-old eGFR counts for an outpatient (30-day window) but not an
/// inpatient (7-day window, the migration's default).
#[tokio::test]
async fn an_inpatient_needs_an_egfr_from_this_week() {
    let got = lookup_with(&[(10, ("eGFR", "42", "mL/min/1.73 m²"))], true).await;
    assert_eq!((got.inpatient, got.window_days), (true, 7));
    assert!(
        got.reading.is_none(),
        "a 10-day-old eGFR dosed an inpatient"
    );
}

/// Twenty-five newer rows that cannot qualify (clearances, mL/min) must not
/// push a 5-day-old eGFR out of the read's LIMIT.
#[tokio::test]
async fn non_qualifying_rows_do_not_crowd_out_an_egfr() {
    let mut rows = vec![(5, ("eGFR", "42", "mL/min/1.73 m²"))];
    for _ in 0..13 {
        rows.push((1, ("Creatinine clearance (GFR)", "40", "mL/min/1.73m2")));
        rows.push((1, ("eGFR (Cockcroft-Gault)", "40", "mL/min")));
    }
    let got = lookup_with(&rows, false).await;
    assert!(got.reading.is_some(), "a real eGFR was crowded out");
}
