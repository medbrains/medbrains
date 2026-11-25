//! Minutes written into the NABH registers are rounded to the nearest
//! minute, not cut down: CPR that ran 10 min 50 s is 11 minutes, not 10.
//!
//!   DATABASE_URL=… cargo test -p medbrains-nabh --test register_minutes -- --ignored

#![allow(clippy::expect_used, clippy::unwrap_used)]

use medbrains_nabh::{mirror_code_blue_ended, mirror_code_blue_started};
use sqlx::PgPool;
use uuid::Uuid;

/// Insert a row and return its id.
async fn id(db: &PgPool, sql: &str, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(sql)
        .bind(tenant)
        .fetch_one(db)
        .await
        .expect(sql)
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn cpr_duration_is_rounded_to_the_nearest_minute() {
    let db = PgPool::connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL"))
        .await
        .unwrap();
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'NABH minutes test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("NM{code}"))
    .fetch_one(&db)
    .await
    .unwrap();
    let user = id(
        &db,
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, 'n' || substr(md5(random()::text), 1, 12), gen_random_uuid()::text || '@nabh.test', \
                 'Nurse', 'nurse') RETURNING id",
        tenant,
    )
    .await;
    let patient = id(
        &db,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, gen_random_uuid()::text, 'Test', 'Patient', 'female', '9000000000') \
         RETURNING id",
        tenant,
    )
    .await;
    let mut cases = Vec::new();
    for (seconds, minutes) in [(650, 11), (629, 10), (630, 11), (59, 1), (29, 0)] {
        let event: Uuid = sqlx::query_scalar(
            "INSERT INTO code_blue_events (tenant_id, patient_id, location, started_at, ended_at) \
             VALUES ($1, $2, 'Ward 3', now() - make_interval(secs => $3), now()) RETURNING id",
        )
        .bind(tenant)
        .bind(patient)
        .bind(f64::from(seconds))
        .fetch_one(&db)
        .await
        .unwrap();
        let mut tx = db.begin().await.unwrap();
        mirror_code_blue_started(&mut tx, tenant, user, event)
            .await
            .unwrap();
        mirror_code_blue_ended(&mut tx, tenant, event)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let got: Option<i32> = sqlx::query_scalar(
            "SELECT cpr_duration_minutes FROM nabh_code_blue_activations \
              WHERE tenant_id = $1 AND source_record_id = $2",
        )
        .bind(tenant)
        .bind(event)
        .fetch_one(&db)
        .await
        .unwrap();
        cases.push((seconds, got, Some(minutes)));
    }
    let wrong: Vec<_> = cases.iter().filter(|(_, got, want)| got != want).collect();
    assert!(wrong.is_empty(), "(seconds, got, want): {wrong:?}");
}
