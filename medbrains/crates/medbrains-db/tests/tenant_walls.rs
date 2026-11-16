//! One hospital cannot reach another's rows through the tables that route files
//! query with raw SQL (OS-BUILD-PLAN X13).
//!
//!   `make test-db && cargo test -p medbrains-db --test tenant_walls`
//!
//! Many of those queries say only `WHERE id = $1`, so the database policy is the
//! only wall between hospitals. This runs the attack as the request role, on a
//! fresh copy of the migrated schema holding two hospitals, with a victim row in
//! every table attacked.

#![allow(clippy::expect_used, clippy::panic)]

use medbrains_db::pool::set_tenant_context;
use medbrains_db_migrations::testing::{APP_ROLE, add_tenant, fresh_db};
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

/// What a tenant-isolation policy must refer to: the session's hospital, or
/// the hospitals it may see. A permissive policy that names neither (or is
/// just `true`) opens the table to everyone, whatever the other policies say.
const TENANT_CONTEXT: &[&str] = &["app.tenant_id", "app_visible_tenants", "app_current_tenant"];

/// A placeholder for each column a victim row must fill: `tenant_id` gets the
/// victim, every other NOT NULL column without a default a value of its type.
/// Foreign keys are off while seeding (see [`seed_victim_row`]), so a random
/// uuid stands in for a parent row.
const PLACEHOLDERS: &str = r"
    SELECT quote_ident(a.attname),
           CASE
             WHEN a.attname = 'tenant_id' THEN quote_literal($2::text)
             WHEN t.typtype = 'e' THEN quote_literal((SELECT enumlabel FROM pg_enum
                  WHERE enumtypid = t.oid ORDER BY enumsortorder LIMIT 1))
             WHEN a.attndims > 0 OR t.typcategory = 'A' THEN '''{}'''
             WHEN t.typname = 'uuid' THEN 'gen_random_uuid()'
             WHEN t.typcategory = 'N' THEN '1'
             WHEN t.typcategory = 'B' THEN 'false'
             WHEN t.typcategory = 'D' THEN 'now()'
             WHEN t.typname IN ('json', 'jsonb') THEN '''{}'''
             WHEN t.typname = 'inet' THEN '''127.0.0.1'''
             ELSE '''x'''
           END || '::' || format_type(a.atttypid, a.atttypmod)
      FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
     WHERE a.attrelid = ('public.' || $1)::regclass AND a.attnum > 0
       AND NOT a.attisdropped AND a.attgenerated = ''
       AND (a.attname = 'tenant_id' OR (a.attnotnull AND NOT a.atthasdef))
     ORDER BY a.attnum";

/// Values a placeholder would break a CHECK constraint with.
const OVERRIDES: &[(&str, &str, &str)] = &[
    ("abdm_care_contexts", "hi_types", "ARRAY['Prescription']"),
    ("abdm_care_contexts", "source_kind", "'prescription'"),
    ("abdm_consent_artefacts", "status", "'GRANTED'"),
    ("abdm_consent_requests", "hi_types", "ARRAY['Prescription']"),
    ("abdm_consent_requests", "purpose_code", "'CAREMGT'"),
    ("abdm_consent_requests", "requested_at", "now()"),
    (
        "abdm_consent_requests",
        "data_erase_at",
        "now() + interval '1 day'",
    ),
    ("abdm_hfr_registrations", "status", "'queued'"),
    ("abdm_received_records", "purged_at", "now()"),
    ("abha_verifications", "environment", "'sandbox'"),
    ("abha_verifications", "method", "'mobile'"),
    ("abha_verifications", "otp_system", "'abdm'"),
    ("abha_verifications", "stage", "'otp_sent'"),
    ("departments", "code", "'VICTIM'"),
    ("departments", "name", "'Victim'"),
    ("doctor_schedules", "start_time", "'08:00'"),
    ("doctor_schedules", "end_time", "'09:00'"),
    ("facilities", "code", "'VICTIM'"),
    ("facilities", "name", "'Victim'"),
    ("uhi_transactions", "service", "'lab_tests'"),
    ("users", "email", "'victim@example.org'"),
    ("users", "full_name", "'Victim'"),
    ("users", "username", "'victim'"),
];

/// One row in `table` belonging to `victim`, inserted as the owner.
///
/// `session_replication_role = replica` (transaction-local) switches off the
/// foreign-key and other triggers, so the row needs no parent rows: what is
/// under test is the policy on this table, not the schema around it.
async fn seed_victim_row(owner: &sqlx::PgPool, table: &str, victim: Uuid) {
    let mut cols: Vec<(String, String)> = sqlx::query_as(PLACEHOLDERS)
        .bind(table)
        .bind(victim.to_string())
        .fetch_all(owner)
        .await
        .expect("read the columns");
    for (_, col, value) in OVERRIDES.iter().filter(|(t, ..)| *t == table) {
        cols.retain(|(c, _)| c != col);
        cols.push(((*col).to_owned(), (*value).to_owned()));
    }
    let names: Vec<&str> = cols.iter().map(|(c, _)| c.as_str()).collect();
    let values: Vec<&str> = cols.iter().map(|(_, v)| v.as_str()).collect();
    let mut tx = owner.begin().await.expect("begin");
    sqlx::raw_sql("SET LOCAL session_replication_role = replica")
        .execute(&mut *tx)
        .await
        .expect("foreign keys off");
    // `table` and the column names come from the constants above and the catalog.
    sqlx::raw_sql(&format!(
        "INSERT INTO {table} ({}) VALUES ({})",
        names.join(", "),
        values.join(", ")
    ))
    .execute(&mut *tx)
    .await
    .unwrap_or_else(|e| panic!("{table}: could not seed a victim row: {e}"));
    tx.commit().await.expect("commit");
}

#[tokio::test]
async fn every_table_has_row_level_security_and_a_policy() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
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
async fn every_permissive_policy_is_bound_to_the_tenant() {
    // Permissive policies are ORed: one that does not name the tenant makes
    // the others irrelevant. Restrictive ones only narrow, so they may not.
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let policies: Vec<(String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT tablename::text, policyname::text, qual, with_check FROM pg_policies
          WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
            AND tablename = ANY($1)",
    )
    .bind(TABLES)
    .fetch_all(&owner)
    .await
    .expect("read the policies");
    assert!(!policies.is_empty(), "no permissive policies read");
    for (table, policy, qual, check) in policies {
        for clause in [qual, check].into_iter().flatten() {
            assert!(
                clause.trim() != "true" && TENANT_CONTEXT.iter().any(|c| clause.contains(c)),
                "{table}: policy {policy} is not bound to the tenant: {clause}"
            );
        }
    }
}

#[tokio::test]
async fn the_request_role_cannot_read_or_change_another_hospitals_rows() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let app = db.connect(APP_ROLE).await.expect("request role");
    // A victim row in every attacked table, so no table passes for being empty.
    let tenant = add_tenant(&owner, "ATTACKER").await.expect("tenant");
    let victim = add_tenant(&owner, "VICTIM").await.expect("tenant");
    for table in TABLES {
        seed_victim_row(&owner, table, victim).await;
    }

    for table in TABLES {
        // `table` is from the constant above, never from input.
        let others = format!("SELECT count(*) FROM {table} WHERE tenant_id <> $1");
        let there: i64 = sqlx::query_scalar(&others)
            .bind(tenant)
            .fetch_one(&owner)
            .await
            .expect("count as owner");
        assert!(
            there > 0,
            "{table}: no victim rows, the attack proved nothing"
        );

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
}
