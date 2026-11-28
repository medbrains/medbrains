//! The Postgres backend's `bulk_check` against `check`, on a real database,
//! as the request role (row level security applies).
//!
//!   `make test-db && cargo test -p medbrains-authz --test pg_bulk_check`
//!
//! The fixture holds allowed, denied and unanswerable questions. Every
//! answer is written down by hand, both calls must give it, and a fault must
//! be an error from both, never a "no". Then it counts connections taken:
//! one bulk check of 300 items must use one, not 300.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::print_stderr
)]

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use medbrains_authz::backend_pg::PgAuthzBackend;
use medbrains_authz::{AuthzBackend, AuthzContext, Relation, Subject};
use medbrains_db_migrations::testing::{APP_ROLE, add_tenant, fresh_db};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

const V: Relation = Relation::Viewer;
const E: Relation = Relation::Editor;

/// A doctor in one department and one live access group (and one lapsed).
async fn doctor(owner: &PgPool, code: &str) -> AuthzContext {
    let tenant_id = add_tenant(owner, code).await.expect("tenant");
    let user_id: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $2 || '@authz.test', 'Test doctor', 'doctor') RETURNING id",
    )
    .bind(tenant_id)
    .bind(code.to_lowercase())
    .fetch_one(owner)
    .await
    .expect("user");
    AuthzContext {
        tenant_id,
        user_id,
        role: "doctor".to_owned(),
        department_ids: vec![Uuid::new_v4()],
        is_bypass: false,
    }
}

/// An access group of `ctx`'s hospital with the doctor as a member until
/// `until` (SQL, e.g. `NULL` or `now() - interval '1 day'`).
async fn group(owner: &PgPool, ctx: &AuthzContext, code: &str, until: &str) -> Uuid {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO access_groups (tenant_id, code, name) VALUES ($1, $2, $2) RETURNING id",
    )
    .bind(ctx.tenant_id)
    .bind(code)
    .fetch_one(owner)
    .await
    .expect("group");
    sqlx::query(&format!(
        "INSERT INTO access_group_members (group_id, user_id, tenant_id, expires_at) \
         VALUES ($1, $2, $3, {until})"
    ))
    .bind(id)
    .bind(ctx.user_id)
    .bind(ctx.tenant_id)
    .execute(owner)
    .await
    .expect("member");
    id
}

/// Grant `relation` on `<object_type>:<new id>` to `subject`, returning the id.
async fn grant(
    pg: &PgAuthzBackend,
    ctx: &AuthzContext,
    on: (&str, &str),
    subject: Subject,
) -> Uuid {
    let id = Uuid::new_v4();
    pg.grant_raw(ctx, on.0, id, on.1, subject, None, None)
        .await
        .expect("grant");
    id
}

/// Set `sql` (e.g. `caveat = '{}'`) on every tuple of `object_id`, as the owner.
async fn alter(owner: &PgPool, object_id: Uuid, sql: &str) {
    sqlx::query(&format!(
        "UPDATE relation_tuples SET {sql} WHERE object_id = $1"
    ))
    .bind(object_id)
    .execute(owner)
    .await
    .expect("alter tuple");
}

/// The hand-written fixture: (object type, relation, id, expected answer).
async fn fixture(
    owner: &PgPool,
    pg: &PgAuthzBackend,
    ctx: &AuthzContext,
) -> Vec<(&'static str, Relation, Uuid, bool)> {
    let me = || Subject::User(ctx.user_id);
    let (live, lapsed) = (
        group(owner, ctx, "LIVE", "NULL").await,
        group(owner, ctx, "LAPSED", "now() - interval '1 day'").await,
    );
    let viewer = ("patient", "viewer");
    let by_user = grant(pg, ctx, viewer, me()).await;
    let by_role = grant(pg, ctx, viewer, Subject::Role("doctor".to_owned())).await;
    let by_other_role = grant(pg, ctx, viewer, Subject::Role("nurse".to_owned())).await;
    let by_dept = grant(
        pg,
        ctx,
        ("patient", "dept_member"),
        Subject::Department(ctx.department_ids[0]),
    )
    .await;
    let by_group = grant(pg, ctx, viewer, Subject::Group(live)).await;
    let by_lapsed = grant(pg, ctx, viewer, Subject::Group(lapsed)).await;
    let by_owner = grant(pg, ctx, ("patient", "owner"), me()).await;
    let expired = grant(pg, ctx, viewer, me()).await;
    alter(owner, expired, "expires_at = now() - interval '1 day'").await;
    let revoked = grant(pg, ctx, viewer, me()).await;
    alter(owner, revoked, "status = 'revoked'").await;
    let caveated = grant(pg, ctx, viewer, me()).await;
    alter(owner, caveated, "caveat = '{}'").await;
    // The same user id, granted in another hospital: never counts here.
    let mut elsewhere = doctor(owner, "AZBELSE").await;
    elsewhere.user_id = ctx.user_id;
    let other_tenant = grant(pg, &elsewhere, viewer, me()).await;
    // lab_order -> patient arrow: view only, and only to a patient in reach.
    let pointer = |p: Uuid| Subject::TupleSet(format!("patient:{p}"));
    let order = grant(pg, ctx, ("lab_order", "patient"), pointer(by_user)).await;
    let orphan = grant(pg, ctx, ("lab_order", "patient"), pointer(Uuid::new_v4())).await;
    vec![
        ("patient", V, by_user, true),
        ("patient", E, by_user, false),
        ("patient", V, by_role, true),
        ("patient", V, by_other_role, false),
        ("patient", V, by_dept, true),
        ("patient", E, by_dept, false),
        ("patient", V, by_group, true),
        ("patient", V, by_lapsed, false),
        ("patient", V, by_owner, true),
        ("patient", E, by_owner, true),
        ("patient", V, expired, false),
        ("patient", V, revoked, false),
        ("patient", V, caveated, false),
        ("patient", V, other_tenant, false),
        ("patient", V, Uuid::new_v4(), false),
        ("lab_order", V, order, true),
        ("lab_order", E, order, false),
        ("lab_order", V, orphan, false),
    ]
}

#[tokio::test]
async fn bulk_and_single_checks_give_the_written_answers_and_faults_stay_faults() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let taken = Arc::new(AtomicUsize::new(0));
    let (on_connect, on_acquire) = (Arc::clone(&taken), Arc::clone(&taken));
    let app = PgPoolOptions::new()
        .after_connect(move |_, _| {
            on_connect.fetch_add(1, Ordering::SeqCst);
            Box::pin(async { Ok(()) })
        })
        .before_acquire(move |_, _| {
            on_acquire.fetch_add(1, Ordering::SeqCst);
            Box::pin(async { Ok(true) })
        })
        .connect(&db.url(APP_ROLE))
        .await
        .expect("counting app pool");
    let pg = PgAuthzBackend::new(app);
    let ctx = doctor(&owner, "AZBULK").await;
    let cases = fixture(&owner, &pg, &ctx).await;

    let items: Vec<(String, Relation, Uuid)> = cases
        .iter()
        .map(|(t, r, id, _)| ((*t).to_owned(), *r, *id))
        .collect();
    let bulk = pg.bulk_check(&ctx, &items).await.expect("bulk answers");
    assert_eq!(bulk.len(), items.len());
    for ((t, r, id, expected), key) in cases.iter().zip(&items) {
        let one = pg.check(&ctx, *r, t, *id).await.expect("single answers");
        assert_eq!(one, *expected, "check: {t} {r:?} {id}");
        assert_eq!(bulk[key], *expected, "bulk_check: {t} {r:?} {id}");
    }

    // Unknown: a type the registry does not know fails the whole call.
    let mut bad = items.clone();
    bad.push(("no_such_type".to_owned(), V, Uuid::new_v4()));
    pg.bulk_check(&ctx, &bad)
        .await
        .expect_err("unknown type in bulk");
    pg.check(&ctx, V, "no_such_type", Uuid::new_v4())
        .await
        .expect_err("unknown type");

    // Unknown: the database is gone. An error from both, never a "no".
    let gone = PgPoolOptions::new()
        .connect_lazy("postgres://nobody@127.0.0.1:1/none")
        .unwrap();
    gone.close().await;
    let broken = PgAuthzBackend::new(gone);
    broken
        .bulk_check(&ctx, &items)
        .await
        .expect_err("outage in bulk");
    broken
        .check(&ctx, V, "patient", cases[0].2)
        .await
        .expect_err("outage");

    // A bypass role is allowed everything without asking.
    let admin = AuthzContext {
        is_bypass: true,
        ..ctx.clone()
    };
    assert!(
        pg.bulk_check(&admin, &bad)
            .await
            .unwrap()
            .values()
            .all(|a| *a)
    );

    // 300 questions, one connection taken (the trait default took 300).
    let many: Vec<_> = (0..300)
        .map(|_| ("patient".to_owned(), V, Uuid::new_v4()))
        .collect();
    taken.store(0, Ordering::SeqCst);
    let started = std::time::Instant::now();
    let answers = pg.bulk_check(&ctx, &many).await.expect("answers");
    let (n, elapsed) = (taken.load(Ordering::SeqCst), started.elapsed());
    eprintln!("300 checks: {n} connection(s) taken in {elapsed:?}");
    assert!(answers.values().all(|a| !*a));
    assert_eq!(n, 1, "300 checks took {n} connections");
}
