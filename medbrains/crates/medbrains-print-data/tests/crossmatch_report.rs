//! The crossmatch report queries against a real, migrated database.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-print-data --test crossmatch_report -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_print_data::crossmatch::{crossmatch_report_row, crossmatch_report_units};
use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// Runs one insert and returns the id it made.
async fn one(db: &PgPool, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(db).await.expect(sql)
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn prints_the_request_the_bank_raised_and_its_unit() {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let db = PgPool::connect(&url).await.expect("connect");
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Crossmatch print test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("XP{code}"))
    .fetch_one(&db)
    .await
    .expect("tenant");
    let u = one(
        &db,
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, 'xp_' || left($1::text, 8), 'xp' || left($1::text, 8) || '@t.test', \
           'Dr Meera', 'doctor') RETURNING id",
        &[t],
    )
    .await;
    let p = one(
        &db,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'XP-' || left($1::text, 8), 'Asha', 'Rao', 'female', '9000000000') \
         RETURNING id",
        &[t],
    )
    .await;
    // What `create_crossmatch_request` writes.
    let xm = one(
        &db,
        "INSERT INTO crossmatch_requests (tenant_id, patient_id, requested_by, blood_group, \
           component_type, units_requested, clinical_indication) \
         VALUES ($1, $2, $3, 'o_positive', 'prbc', 2, 'Hemicolectomy') RETURNING id",
        &[t, p, u],
    )
    .await;

    let mut tx = db.begin().await.expect("tx");
    let row = crossmatch_report_row(&mut tx, t, xm).await.expect("row");
    assert_eq!(row.patient_name, "Asha Rao");
    assert_eq!(row.blood_group, "o_positive");
    assert_eq!(row.rh_type, "Positive");
    assert_eq!(row.units_requested, 2);
    assert_eq!(row.requesting_doctor.as_deref(), Some("Dr Meera"));
    let units = crossmatch_report_units(&mut tx, t, xm)
        .await
        .expect("units");
    assert!(units.is_empty(), "no unit until the bank ties one");
    drop(tx);

    let donor = one(
        &db,
        "INSERT INTO blood_donors (tenant_id, donor_number, first_name, last_name, blood_group) \
         VALUES ($1, 'D-' || left(gen_random_uuid()::text, 8), 'Ravi', 'K', 'o_positive') \
         RETURNING id",
        &[t],
    )
    .await;
    let donation = one(
        &db,
        "INSERT INTO blood_donations (tenant_id, donor_id, bag_number, volume_ml) \
         VALUES ($1, $2, 'B-' || left(gen_random_uuid()::text, 8), 450) RETURNING id",
        &[t, donor],
    )
    .await;
    let unit = one(
        &db,
        "INSERT INTO blood_components (tenant_id, donation_id, component_type, bag_number, \
           blood_group, volume_ml, status, expiry_at) \
         VALUES ($1, $2, 'prbc', 'BAG-XP1', 'o_positive', 280, 'crossmatched', \
           now() + interval '20 days') RETURNING id",
        &[t, donation],
    )
    .await;
    // What `update_crossmatch` writes when the bank marks it compatible.
    sqlx::query(
        "UPDATE crossmatch_requests SET status = 'compatible', result = 'compatible', \
           component_id = $1, tested_by = $2, tested_at = now() WHERE id = $3",
    )
    .bind(unit)
    .bind(u)
    .bind(xm)
    .execute(&db)
    .await
    .expect("compatible");

    let mut tx = db.begin().await.expect("tx");
    let units = crossmatch_report_units(&mut tx, t, xm)
        .await
        .expect("units");
    assert_eq!(units.len(), 1);
    assert_eq!(units[0].bag_number, "BAG-XP1");
    assert_eq!(units[0].crossmatch_result, "compatible");
    assert_eq!(units[0].issue_status, "crossmatched");
    let missing = crossmatch_report_row(&mut tx, t, Uuid::new_v4()).await;
    assert!(matches!(missing, Err(AppError::NotFound)));
}
