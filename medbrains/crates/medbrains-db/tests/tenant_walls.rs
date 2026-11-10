//! One hospital cannot reach another's rows through the tables that route files
//! query with raw SQL (OS-BUILD-PLAN X13).
//!
//!   cargo test -p medbrains-db --test tenant_walls -- --ignored
//!
//! Many of those queries say only `WHERE id = $1`, so the database policy is the
//! only wall between hospitals. This runs the attack as the request role.

#![allow(clippy::expect_used, clippy::print_stderr)]

use medbrains_db::pool::set_tenant_context;
use uuid::Uuid;

/// Every tenant-owned table the X13 route files read or write.
const TABLES: &[&str] = &[
    "abdm_care_contexts",
    "abdm_consent_artefacts",
    "abdm_consent_requests",
    "abdm_gateway_callbacks",
    "abdm_hfr_registrations",
    "abdm_profile_shares",
    "abdm_received_records",
    "abha_verifications",
    "ambulance_trips",
    "ambulances",
    "appointments",
    "blood_components",
    "charge_master",
    "departments",
    "doctor_profiles",
    "doctor_schedule_exceptions",
    "doctor_schedules",
    "encounters",
    "facilities",
    "lab_home_collections",
    "lab_test_catalog",
    "patient_abha_links",
    "patient_identifiers",
    "patients",
    "payment_gateway_transactions",
    "rate_plan_items",
    "rate_plans",
    "stations",
    "tele_consultations",
    "tenant_settings",
    "tokens",
    "uhi_subscriptions",
    "uhi_transactions",
    "users",
];

/// Connects to the dev database as `role`, or `None` if it is not there.
async fn as_role(role: &str) -> Option<sqlx::PgPool> {
    sqlx::PgPool::connect(&format!(
        "postgres://{role}:medbrains_dev@localhost:5435/medbrains"
    ))
    .await
    .ok()
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn every_table_has_row_level_security_and_a_policy() {
    // Holds on an empty database, so it still means something without a second
    // hospital's rows to attack.
    let Some(owner) = as_role("medbrains").await else {
        eprintln!("dev database unavailable — skipping");
        return;
    };
    for table in TABLES {
        let (enabled, policies): (bool, i64) = sqlx::query_as(
            "SELECT c.relrowsecurity,
                    (SELECT count(*) FROM pg_policies p
                      WHERE p.schemaname = 'public' AND p.tablename = c.relname)
               FROM pg_class c
              WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace",
        )
        .bind(table)
        .fetch_one(&owner)
        .await
        .expect("the table exists");
        assert!(enabled, "{table} has row level security off");
        assert!(policies > 0, "{table} has no policy, so it is shut or open");
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_request_role_cannot_read_or_change_another_hospitals_rows() {
    let (Some(owner), Some(app)) = (as_role("medbrains").await, as_role("medbrains_app").await)
    else {
        eprintln!("both roles are needed for this test — skipping");
        return;
    };
    let tenant: Uuid = sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        .fetch_one(&owner)
        .await
        .expect("a tenant");

    let mut attacked = 0_i64;
    for table in TABLES {
        // `table` is from the constant above, never from input.
        let others = format!("SELECT count(*) FROM {table} WHERE tenant_id <> $1");
        let there: i64 = sqlx::query_scalar(&others)
            .bind(tenant)
            .fetch_one(&owner)
            .await
            .expect("count as owner");
        attacked += there;

        let mut tx = app.begin().await.expect("begin");
        set_tenant_context(&mut tx, &tenant).await.expect("tenant");
        let seen: i64 = sqlx::query_scalar(&others)
            .bind(tenant)
            .fetch_one(&mut *tx)
            .await
            .expect("count as the request role");
        let changed = sqlx::query(&format!(
            "UPDATE {table} SET tenant_id = tenant_id WHERE tenant_id <> $1"
        ))
        .bind(tenant)
        .execute(&mut *tx)
        .await
        .expect("update as the request role")
        .rows_affected();
        tx.rollback().await.expect("rollback");

        assert_eq!(seen, 0, "{table}: read {seen} of another hospital's rows");
        assert_eq!(
            changed, 0,
            "{table}: changed {changed} of another hospital's rows"
        );
    }
    if attacked == 0 {
        eprintln!("no other hospital's rows in this database — the attack proved nothing");
    }
}
