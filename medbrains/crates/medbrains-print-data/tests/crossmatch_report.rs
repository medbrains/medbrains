//! The crossmatch report queries against a real, migrated database.
//! Rows are written exactly as the blood bank's crossmatch handlers write them.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-print-data --test crossmatch_report -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use chrono::FixedOffset;
use medbrains_core::print_data::CrossmatchReportPrintData;
use medbrains_print_data::crossmatch::{
    crossmatch_report_row, crossmatch_report_units, print_data,
};
use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// A tenant, a requesting doctor, a patient and their crossmatch request.
struct Fix {
    db: PgPool,
    tenant: Uuid,
    user: Uuid,
    xm: Uuid,
}

/// Runs one insert and returns the id it made.
async fn one(db: &PgPool, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(db).await.expect(sql)
}

/// A fresh tenant with one request raised as `create_crossmatch_request` writes it.
async fn fixture() -> Fix {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let db = PgPool::connect(&url).await.expect("connect");
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Crossmatch print test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("XP{code}"))
    .fetch_one(&db)
    .await
    .expect("tenant");
    let user = one(
        &db,
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, 'xp_' || left($1::text, 8), 'xp' || left($1::text, 8) || '@t.test', \
           'Dr Meera', 'doctor') RETURNING id",
        &[tenant],
    )
    .await;
    let patient = one(
        &db,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'XP-' || left($1::text, 8), 'Asha', 'Rao', 'female', '9000000000') \
         RETURNING id",
        &[tenant],
    )
    .await;
    let xm = one(
        &db,
        "INSERT INTO crossmatch_requests (tenant_id, patient_id, requested_by, blood_group, \
           component_type, units_requested, clinical_indication) \
         VALUES ($1, $2, $3, 'o_positive', 'prbc', 2, 'Hemicolectomy') RETURNING id",
        &[tenant, patient, user],
    )
    .await;
    Fix {
        db,
        tenant,
        user,
        xm,
    }
}

/// `update_crossmatch` marking it compatible, with or without a bag.
async fn mark_compatible(f: &Fix, unit: Option<Uuid>) {
    sqlx::query(
        "UPDATE crossmatch_requests SET status = 'compatible', result = 'compatible', \
           component_id = COALESCE($1, component_id), tested_by = $2, tested_at = now() \
         WHERE id = $3",
    )
    .bind(unit)
    .bind(f.user)
    .bind(f.xm)
    .execute(&f.db)
    .await
    .expect("compatible");
}

/// A crossmatched O+ bag numbered `BAG-XP1`.
async fn bag(f: &Fix) -> Uuid {
    let donor = one(
        &f.db,
        "INSERT INTO blood_donors (tenant_id, donor_number, first_name, last_name, blood_group) \
         VALUES ($1, 'D-' || left(gen_random_uuid()::text, 8), 'Ravi', 'K', 'o_positive') \
         RETURNING id",
        &[f.tenant],
    )
    .await;
    let donation = one(
        &f.db,
        "INSERT INTO blood_donations (tenant_id, donor_id, bag_number, volume_ml) \
         VALUES ($1, $2, 'B-' || left(gen_random_uuid()::text, 8), 450) RETURNING id",
        &[f.tenant, donor],
    )
    .await;
    one(
        &f.db,
        "INSERT INTO blood_components (tenant_id, donation_id, component_type, bag_number, \
           blood_group, volume_ml, status, expiry_at) \
         VALUES ($1, $2, 'prbc', 'BAG-XP1', 'o_positive', 280, 'crossmatched', \
           now() + interval '20 days') RETURNING id",
        &[f.tenant, donation],
    )
    .await
}

/// The report as the endpoint would send it, printed in IST.
async fn paper(f: &Fix) -> CrossmatchReportPrintData {
    let mut tx = f.db.begin().await.expect("tx");
    let row = crossmatch_report_row(&mut tx, f.tenant, f.xm)
        .await
        .expect("row");
    let units = crossmatch_report_units(&mut tx, f.tenant, f.xm)
        .await
        .expect("units");
    let ist = FixedOffset::east_opt(19_800).expect("offset");
    print_data(row, units, ist, None)
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn prints_the_request_and_its_outcome_without_a_unit() {
    let f = fixture().await;
    let raised = paper(&f).await;
    assert_eq!(raised.patient_name, "Asha Rao");
    assert_eq!(raised.blood_group, "o_positive");
    assert_eq!(raised.rh_type, "Positive");
    assert_eq!(raised.units_requested, 2);
    assert_eq!(raised.requesting_doctor.as_deref(), Some("Dr Meera"));
    assert_eq!(raised.status, "requested");
    assert!(raised.tested_at.is_none());
    // The web's Compatible button: an outcome, but no bag tied.
    mark_compatible(&f, None).await;
    let tested = paper(&f).await;
    assert_eq!(tested.status, "compatible");
    assert_eq!(tested.result.as_deref(), Some("compatible"));
    assert!(tested.tested_at.is_some(), "tested time printed");
    assert_eq!(tested.unit_allocation, "No unit allocated yet");
    assert!(tested.crossmatch_results.is_empty());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn prints_the_tied_unit() {
    let f = fixture().await;
    let unit = bag(&f).await;
    mark_compatible(&f, Some(unit)).await;
    let printed = paper(&f).await;
    assert_eq!(printed.unit_allocation, "Bag BAG-XP1");
    assert_eq!(printed.crossmatch_results.len(), 1);
    assert_eq!(
        printed.crossmatch_results[0].crossmatch_result,
        "compatible"
    );
    assert_eq!(printed.crossmatch_results[0].issue_status, "crossmatched");
    let mut tx = f.db.begin().await.expect("tx");
    let missing = crossmatch_report_row(&mut tx, f.tenant, Uuid::new_v4()).await;
    assert!(matches!(missing, Err(AppError::NotFound)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_ungrouped_sample_is_not_printed_as_rh_negative() {
    let f = fixture().await;
    for (group, rh) in [("unknown", "Unknown"), ("ab_negative", "Negative")] {
        sqlx::query("UPDATE crossmatch_requests SET blood_group = $1::blood_group WHERE id = $2")
            .bind(group)
            .bind(f.xm)
            .execute(&f.db)
            .await
            .expect("regroup");
        assert_eq!(paper(&f).await.rh_type, rh, "{group}");
    }
}
