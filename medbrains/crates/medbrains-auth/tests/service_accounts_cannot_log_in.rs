//! A service account must not be able to sign in by any route.
//!
//! A service account is the `users` row an API key acts as. It exists so that
//! the 99 `created_by` foreign keys resolve and the audit trail can say "Lab
//! Integration" instead of naming a clinician who was asleep. What it must
//! never be is a credential.
//!
//! ## Why this is a source scan and not a request test
//!
//! The thing that breaks this is not a bug in today's code — it is the login
//! path somebody adds in six months, written by copying an existing one that
//! predates the rule. A test that drives the current handlers would pass
//! happily while that new path sat unguarded next to it.
//!
//! So the assertion is over the *shape of the code*: every query that resolves
//! a user by a credential-like identifier carries the exclusion. A new login
//! path fails this test the day it is written, which is the only moment the
//! omission is cheap to fix.
//!
//! The companion `#[ignore = "needs-pg"]` test proves the database half —
//! that a service account cannot hold a password even if code forgets to ask.

// A failing assertion is the point of a test, so the crate's ban on panicking
// does not apply here. Same allowance the other integration tests take.
#![allow(clippy::expect_used, clippy::panic)]

use std::path::Path;

/// Sources that resolve a user for the purpose of authenticating them.
const LOGIN_SOURCES: [&str; 2] = [
    "src/lib.rs",                        // medbrains-auth
    "../medbrains-sso-login/src/lib.rs", // SSO, incl. the email-claim path
];

/// A lookup keyed on one of these is resolving a login identity, and must
/// exclude service accounts. Matching on the predicate rather than the whole
/// query so that reformatting does not break the test.
const CREDENTIAL_LOOKUPS: [&str; 2] = ["WHERE username = $1", "lower(email) = lower($1)"];

const GUARD: &str = "is_service_account = false";

/// Strip the line continuations Rust uses inside multi-line SQL string
/// literals, so a query split across lines reads as one string.
fn flatten(source: &str) -> String {
    source
        .replace("\\\n", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
fn every_login_lookup_excludes_service_accounts() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let mut checked = 0;

    for relative in LOGIN_SOURCES {
        let path = root.join(relative);
        let source = std::fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
        let flat = flatten(&source);

        for needle in CREDENTIAL_LOOKUPS {
            let mut from = 0;
            while let Some(at) = flat[from..].find(needle) {
                let start = from + at;
                // The guard sits within the same WHERE clause. A generous
                // window rather than an exact match, because the predicates
                // are ordered differently in different queries.
                let window = &flat[start..flat.len().min(start + 220)];
                assert!(
                    window.contains(GUARD),
                    "{relative}: a lookup on `{needle}` does not exclude service accounts.\n\
                     A service account is an API key's identity, not a login. Add \
                     `AND {GUARD}` to this query.\n\
                     Found: {window}",
                );
                checked += 1;
                from = start + needle.len();
            }
        }
    }

    // If a refactor moves these queries elsewhere, this test would otherwise
    // pass by finding nothing at all.
    assert!(
        checked >= 4,
        "expected at least 4 credential lookups, found {checked} — have the login \
         queries moved? This test is only meaningful if it can still see them.",
    );
}

/// The database half: even if a login path forgets to ask, a service account
/// has nothing to sign in *with*.
///
/// `cargo test -p medbrains-auth -- --ignored`
#[tokio::test]
#[ignore = "needs-pg"]
async fn a_service_account_cannot_hold_a_password() {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains".to_owned()
    });
    let Ok(pool) = sqlx::PgPool::connect(&url).await else {
        panic!("needs the docker-compose dev database");
    };

    let tenant: uuid::Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("dev database has no tenant to test against");

    // Each attempt gets its own transaction. A failed statement poisons the
    // one it ran in, so a second insert on the same transaction would fail
    // with "current transaction is aborted" — an error, and therefore an
    // assertion that passes without testing anything.
    let rejected = |columns: &'static str, values: &'static str| {
        let pool = pool.clone();
        async move {
            let mut tx = pool.begin().await.expect("begin");
            // Claim the tenant before writing. Without it, row level security
            // refuses the insert first and the test passes on the wrong
            // rejection — it would prove RLS works, which is not what it is
            // for. Harmless as a superuser, required as the app role.
            sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
                .bind(tenant.to_string())
                .execute(&mut *tx)
                .await
                .expect("scope the transaction to a tenant");

            let result = sqlx::query(&format!(
                "INSERT INTO users (tenant_id, {columns}) VALUES ($1, {values})"
            ))
            .bind(tenant)
            .execute(&mut *tx)
            .await;
            let error = result.err().map(|error| error.to_string());
            tx.rollback().await.expect("rollback");
            error
        }
    };

    let password = rejected(
        "username, email, full_name, role, is_service_account, password_hash",
        "'svc_test_pw', 'svc_pw@test.invalid', 'Test Integration', 'service_account', true, 'x'",
    )
    .await
    .expect("a service account was allowed to hold a password_hash — it is now a login");
    assert!(
        password.contains("users_service_accounts_hold_no_grants"),
        "rejected, but by the wrong rule — this test is meant to prove the password \
         constraint bites, not some other one. Got: {password}",
    );

    // The bypass roles are what keep a key from holding every permission
    // regardless of its own allowlist: `is_bypass_role` short-circuits every
    // check, so a service account carrying one would make its permission list
    // decorative.
    let bypass = rejected(
        "username, email, full_name, role, is_service_account",
        "'svc_test_sa', 'svc_sa@test.invalid', 'Test Integration', 'super_admin', true",
    )
    .await
    .expect("a service account took a bypass role — its API key now holds every permission");
    assert!(
        bypass.contains("users_service_accounts_hold_the_service_role"),
        "rejected, but by the wrong rule. Got: {bypass}",
    );
}
