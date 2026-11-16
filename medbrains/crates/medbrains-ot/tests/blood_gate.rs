//! The theatre "blood arranged" gate against a real, migrated database.
//! Rows are written exactly as the blood bank's crossmatch handlers write them.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-ot --test blood_gate -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use chrono::{Duration, Utc};
use medbrains_ot::blood_gate::{NO_CROSSMATCH, blood_arranged_gap};
use sqlx::PgPool;
use uuid::Uuid;

struct Case {
    tenant: Uuid,
    patient: Uuid,
    user: Uuid,
    booking: Uuid,
}

/// Runs one insert and returns the id it made.
async fn one(db: &PgPool, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(db).await.expect(sql)
}

/// A tenant, a surgeon, a patient and a case booked two hours from now.
async fn fixture(db: &PgPool) -> Case {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Blood gate test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("BG{code}"))
    .fetch_one(db)
    .await
    .expect("tenant");
    let user = one(
        db,
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, 'bg_' || left($1::text, 8), 'bg' || left($1::text, 8) || '@t.test', \
           'Surgeon', 'doctor') RETURNING id",
        &[tenant],
    )
    .await;
    let patient = one(
        db,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'BG-' || left($1::text, 8), 'Asha', 'Rao', 'female', '9000000000') \
         RETURNING id",
        &[tenant],
    )
    .await;
    let room = one(
        db,
        "INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, 'OT 1', 'OT1') RETURNING id",
        &[tenant],
    )
    .await;
    let booking: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
           scheduled_date, scheduled_start, scheduled_end, procedure_name) \
         VALUES ($1, $2, $3, $4, current_date, now() + interval '2 hours', \
           now() + interval '4 hours', 'Hemicolectomy') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(room)
    .bind(user)
    .fetch_one(db)
    .await
    .expect("booking");
    Case {
        tenant,
        patient,
        user,
        booking,
    }
}

/// The gate's answer for the case, optionally as if moved to `start`.
async fn gap(db: &PgPool, c: &Case, start: Option<chrono::DateTime<Utc>>) -> Option<&'static str> {
    let mut tx = db.begin().await.expect("tx");
    blood_arranged_gap(&mut tx, c.tenant, c.booking, start)
        .await
        .expect("gate")
}

/// `create_crossmatch_request`: a request starts as `requested`.
async fn raise_crossmatch(db: &PgPool, c: &Case) -> Uuid {
    one(
        db,
        "INSERT INTO crossmatch_requests \
         (tenant_id, patient_id, requested_by, blood_group, component_type, \
          units_requested, clinical_indication) \
         VALUES ($1, $2, $3, 'o_positive'::blood_group, 'prbc'::blood_component_type, 2, \
          'Elective hemicolectomy') RETURNING id",
        &[c.tenant, c.patient, c.user],
    )
    .await
}

/// `update_crossmatch`: the bank's Compatible button, optionally tying a unit.
async fn mark_compatible(db: &PgPool, c: &Case, xm: Uuid, unit: Option<Uuid>) {
    sqlx::query(
        "UPDATE crossmatch_requests SET status = 'compatible'::crossmatch_status, \
           result = 'compatible', component_id = COALESCE($1, component_id), \
           tested_by = $2, tested_at = now(), updated_at = now() \
         WHERE id = $3 AND tenant_id = $4",
    )
    .bind(unit)
    .bind(c.user)
    .bind(xm)
    .bind(c.tenant)
    .execute(db)
    .await
    .expect("compatible");
}

/// A unit of O+ red cells in the given state.
async fn unit(db: &PgPool, c: &Case, status: &str) -> Uuid {
    let donor = one(
        db,
        "INSERT INTO blood_donors (tenant_id, donor_number, first_name, last_name, blood_group) \
         VALUES ($1, 'D-' || left(gen_random_uuid()::text, 8), 'Ravi', 'K', 'o_positive') \
         RETURNING id",
        &[c.tenant],
    )
    .await;
    let donation = one(
        db,
        "INSERT INTO blood_donations (tenant_id, donor_id, bag_number, volume_ml) \
         VALUES ($1, $2, 'B-' || left(gen_random_uuid()::text, 8), 450) RETURNING id",
        &[c.tenant, donor],
    )
    .await;
    sqlx::query_scalar(
        "INSERT INTO blood_components (tenant_id, donation_id, component_type, bag_number, \
           blood_group, volume_ml, status, expiry_at) \
         VALUES ($1, $2, 'prbc', 'C-' || left(gen_random_uuid()::text, 8), 'o_positive', 280, \
           $3::blood_bag_status, now() + interval '20 days') RETURNING id",
    )
    .bind(c.tenant)
    .bind(donation)
    .bind(status)
    .fetch_one(db)
    .await
    .expect("component")
}

/// A pool on `DATABASE_URL`.
async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPool::connect(&url).await.expect("connect")
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn refused_until_the_bank_finds_it_compatible() {
    let db = pool().await;
    let c = fixture(&db).await;
    assert_eq!(
        gap(&db, &c, None).await,
        Some(NO_CROSSMATCH),
        "nothing raised"
    );
    let xm = raise_crossmatch(&db, &c).await;
    assert_eq!(
        gap(&db, &c, None).await,
        Some(NO_CROSSMATCH),
        "requested only"
    );
    mark_compatible(&db, &c, xm, None).await;
    assert_eq!(gap(&db, &c, None).await, None, "compatible crossmatch");
    let in_four_days = Some(Utc::now() + Duration::days(4));
    assert_eq!(
        gap(&db, &c, in_four_days).await,
        Some(NO_CROSSMATCH),
        "lapses before the start"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_tied_unit_must_still_be_there() {
    let db = pool().await;
    let c = fixture(&db).await;
    let xm = raise_crossmatch(&db, &c).await;
    let gone = unit(&db, &c, "transfused").await;
    mark_compatible(&db, &c, xm, Some(gone)).await;
    assert_eq!(
        gap(&db, &c, None).await,
        Some(NO_CROSSMATCH),
        "unit already used"
    );
    let xm2 = raise_crossmatch(&db, &c).await;
    let held = unit(&db, &c, "crossmatched").await;
    mark_compatible(&db, &c, xm2, Some(held)).await;
    assert_eq!(gap(&db, &c, None).await, None, "unit held for the patient");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn another_patients_crossmatch_does_not_count() {
    let db = pool().await;
    let c = fixture(&db).await;
    let other = fixture(&db).await;
    let xm = raise_crossmatch(&db, &other).await;
    mark_compatible(&db, &other, xm, None).await;
    assert_eq!(gap(&db, &c, None).await, Some(NO_CROSSMATCH));
}
