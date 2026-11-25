//! The duplicate check's candidates, against a migrated database with 50,000
//! patients: the indexed union finds exactly the patients the old single OR
//! found (no recall loss), and it reads a few rows of `patients`, not all.
//!
//!   `make test-db && cargo test -p medbrains-server-services --test patient_match_blocking`

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::collections::BTreeSet;

use chrono::NaiveDate;
use medbrains_db_migrations::testing::{APP_ROLE, add_tenant, fresh_db};
use medbrains_server_services::patient_match::{MatchQuery, MatchResult, fuzzy_matches, rank};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// The candidate query before this change, verbatim.
const OLD_CANDIDATES: &str = "SELECT p.id, p.uhid, p.first_name, p.last_name, p.date_of_birth, \
      p.phone, p.gender, 1.0::float8 AS score, p.pharmacy_customer FROM patients p \
      WHERE p.tenant_id = $1 AND p.is_merged = false AND p.is_active = true \
        AND p.deleted_at IS NULL \
        AND ( \
          ($2 <> '' AND similarity(p.first_name, $2) > 0.3) \
          OR ($3 <> '' AND similarity(p.last_name, $3) > 0.3) \
          OR ($2 <> '' AND similarity(p.last_name, $2) > 0.3) \
          OR ($3 <> '' AND similarity(p.first_name, $3) > 0.3) \
          OR p.date_of_birth = $4 \
          OR (length($5) = 10 AND right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10) = $5) \
        ) \
      ORDER BY (COALESCE(similarity(p.first_name || ' ' || p.last_name, $2 || ' ' || $3), 0) \
                + CASE WHEN p.date_of_birth = $4 THEN 1 ELSE 0 END) DESC \
      LIMIT 100";

/// A request's transaction: the app role, scoped to `tenant`.
async fn desk(app: &PgPool, tenant: Uuid) -> Transaction<'static, Postgres> {
    let mut tx = app.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    tx
}

/// 50,000 generated patients plus known duplicates: spelling variants, a
/// shared birth date, a mobile typed with +91 and spaces, a merged and an
/// inactive record (never candidates).
async fn seed(owner: &PgPool, tenant: Uuid) {
    sqlx::query(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         SELECT $1, 'G' || g, (ARRAY['Arun','Bala','Chitra','Deepa','Ezhil','Farah','Gopal','Hari'])[1 + g % 8] || g, \
                (ARRAY['Raman','Sundar','Thomas','Usha','Venkat','Wahid'])[1 + g % 6] || (g % 97), \
                'unknown', (8000000000 + g)::text, DATE '1950-01-01' + (g % 20000) \
           FROM generate_series(1, 50000) g",
    )
    .bind(tenant)
    .execute(owner)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth, is_merged, is_active) VALUES \
         ($1, 'D1', 'Vijay', 'Kumar', 'male', '9840012345', DATE '1990-01-05', false, true), \
         ($1, 'D2', 'Vijaya', 'Kumari', 'female', '+91 98400 12345', DATE '1990-01-05', false, true), \
         ($1, 'D3', 'Vijay', 'Kumar', 'male', '044-2222333', DATE '1961-03-09', false, true), \
         ($1, 'D4', 'Lakshmi', 'Narayanan', 'female', '9123456780', DATE '1975-07-21', false, true), \
         ($1, 'D5', 'Laxmi', 'Narayan', 'female', '91234 56780', NULL, false, true), \
         ($1, 'D6', 'Mohammed', 'Iqbal', 'male', '9000011111', DATE '1982-11-30', false, true), \
         ($1, 'D7', 'Mohamed', 'Ikbal', 'male', '9000011111', DATE '1982-11-30', true, true), \
         ($1, 'D8', 'Muhammad', 'Iqbal', 'male', '7000000000', NULL, false, false)",
    )
    .bind(tenant)
    .execute(owner)
    .await
    .unwrap();
}

/// What the desk types, one probe per kind of duplicate.
fn probes() -> Vec<MatchQuery> {
    let q = |f: &str, l: &str, dob: Option<NaiveDate>, phone: &str| MatchQuery {
        first_name: f.to_owned(),
        last_name: l.to_owned(),
        date_of_birth: dob,
        phone: phone.to_owned(),
        sex: None,
    };
    vec![
        q(
            "Vijai",
            "Kumar",
            NaiveDate::from_ymd_opt(1990, 1, 5),
            "98400 12345",
        ),
        q("Lakshmi", "Narayanan", None, ""),
        q("", "", None, "+91 91234 56780"),
        q(
            "Mohammad",
            "Iqbal",
            NaiveDate::from_ymd_opt(1982, 11, 30),
            "",
        ),
        q("Kumar", "Vijay", None, ""),
        q("", "", NaiveDate::from_ymd_opt(1990, 1, 5), ""),
    ]
}

#[tokio::test]
async fn the_indexed_union_shows_what_the_old_scan_showed_reading_few_rows() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner");
    let tenant = add_tenant(&owner, "MATCH").await.expect("tenant");
    seed(&owner, tenant).await;
    // Steady state, as autovacuum keeps a live table: a table never vacuumed
    // since a bulk load is read in full once more (seen on 17, cause not
    // pinned down; gone after the first VACUUM).
    sqlx::query("VACUUM ANALYZE patients")
        .execute(&owner)
        .await
        .unwrap();
    let app = db.connect(APP_ROLE).await.expect("app");

    let mut shown = 0;
    for q in probes() {
        let mut tx = desk(&app, tenant).await;
        let digits: String = q.phone.chars().filter(char::is_ascii_digit).collect();
        let phone10 = digits[digits.len().saturating_sub(10)..].to_owned();
        let old: Vec<MatchResult> = sqlx::query_as(OLD_CANDIDATES)
            .bind(tenant)
            .bind(q.first_name.trim())
            .bind(q.last_name.trim())
            .bind(q.date_of_birth)
            .bind(&phone10)
            .fetch_all(&mut *tx)
            .await
            .unwrap();
        assert!(
            !old.is_empty() && old.len() < 100,
            "fixture: {} candidates",
            old.len()
        );

        // Rows of `patients` read, by any scan, the planner left to choose:
        // the old OR had no index to use, so it read every patient (50,008);
        // the blocking reads each key's matches, then the shown rows.
        let read = "SELECT COALESCE(sum(seq_tup_read + COALESCE(idx_tup_fetch, 0)), 0)::int8 \
                    FROM pg_stat_xact_user_tables WHERE relname = 'patients'";
        let before: i64 = sqlx::query_scalar(read).fetch_one(&mut *tx).await.unwrap();
        let found = fuzzy_matches(&mut tx, tenant, &q).await.expect("matches");
        let after: i64 = sqlx::query_scalar(read).fetch_one(&mut *tx).await.unwrap();
        assert!(
            after - before < 2_000,
            "{} {}: read {} patient rows",
            q.first_name,
            q.last_name,
            after - before
        );

        // The same patients are shown, scored by the same model.
        let ids = |v: Vec<MatchResult>| v.into_iter().map(|m| m.id).collect::<BTreeSet<_>>();
        let expected = ids(rank(&q, old));
        shown += expected.len();
        assert_eq!(ids(found), expected, "{} {}", q.first_name, q.last_name);
    }
    assert!(shown >= 6, "fixture shows too few duplicates: {shown}");
}
