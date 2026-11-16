//! A person's starred screens are theirs alone: another person in the same
//! hospital, or anyone in another hospital, sees none of them. Runs as the app
//! role (`medbrains_app`, under RLS) against `DASHBOARD_TEST_DATABASE_URL`
//! (else `DATABASE_URL`); skipped locally when neither is set, failing in CI.

#![allow(clippy::panic)]

use medbrains_dashboard::launcher::{MAX_FAVOURITES, list_favourites, write_favourite};
use uuid::Uuid;

/// What a list holds when it shows nobody's stars.
const NONE: [&str; 0] = [];

/// Opens a transaction as the app role with `tenant` as the session's hospital.
async fn as_app(db: &sqlx::PgPool, tenant: Uuid) -> sqlx::Transaction<'static, sqlx::Postgres> {
    let mut tx = db.begin().await.unwrap_or_else(|e| panic!("{e}"));
    sqlx::raw_sql(&format!(
        "SET LOCAL ROLE medbrains_app; SELECT set_config('app.tenant_id', '{tenant}', true);"
    ))
    .execute(&mut *tx)
    .await
    .unwrap_or_else(|e| panic!("{e}"));
    tx
}

/// Plants two hospitals: hospital `t1` with users `a` and `b`, hospital `t2` with user `c`.
async fn plant(db: &sqlx::PgPool, (t1, t2): (Uuid, Uuid), (a, b, c): (Uuid, Uuid, Uuid)) {
    let code = t1.simple().to_string()[..8].to_uppercase();
    let users = [(a, t1), (b, t1), (c, t2)]
        .map(|(user, tenant)| {
            let s = &user.simple().to_string()[..12];
            format!("('{user}', '{tenant}', 'u{s}', 'u{s}@example.test', 'Test user', 'doctor')")
        })
        .join(", ");
    let sql = format!(
        "INSERT INTO tenants (id, code, name, hospital_type) VALUES \
         ('{t1}', 'FA{code}', 'Favourites one', 'community_health'), \
         ('{t2}', 'FB{code}', 'Favourites two', 'community_health'); \
         INSERT INTO users (id, tenant_id, username, email, full_name, role) VALUES {users};"
    );
    sqlx::raw_sql(&sql)
        .execute(db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
}

#[tokio::test]
async fn another_persons_favourites_are_invisible() {
    let url = std::env::var("DASHBOARD_TEST_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok();
    let Some(url) = url else {
        assert!(std::env::var_os("CI").is_none(), "CI must set DATABASE_URL");
        return;
    };
    let db = sqlx::PgPool::connect(&url)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    medbrains_db_migrations::run(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    let (t1, t2) = (Uuid::new_v4(), Uuid::new_v4());
    let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    plant(&db, (t1, t2), (a, b, c)).await;

    let mut tx = as_app(&db, t1).await;
    let mine = write_favourite(&mut tx, (t1, a), "/pharmacy", true).await;
    assert_eq!(mine.unwrap_or_else(|e| panic!("{e}")), vec!["/pharmacy"]);
    let theirs = list_favourites(&mut tx, t1, b).await;
    assert_eq!(theirs.unwrap_or_else(|e| panic!("{e}")), NONE);
    tx.commit().await.unwrap_or_else(|e| panic!("{e}"));

    // Another hospital's session cannot read user a's star, even by naming a and t1.
    let mut tx = as_app(&db, t2).await;
    let leaked = list_favourites(&mut tx, t1, a).await;
    assert_eq!(leaked.unwrap_or_else(|e| panic!("{e}")), NONE);
    let other = list_favourites(&mut tx, t2, c).await;
    assert_eq!(other.unwrap_or_else(|e| panic!("{e}")), NONE);
    drop(tx);

    // The 51st star is not written: the list stays at the cap without it.
    let mut tx = as_app(&db, t1).await;
    for n in 0..60 {
        let path = format!("/cap-{n}");
        let list = write_favourite(&mut tx, (t1, b), &path, true).await;
        let list = list.unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(list.contains(&path), n < MAX_FAVOURITES, "star {n}");
    }
    // Counted without the read's LIMIT, so a 51st row could not hide behind it.
    let stored: i64 =
        sqlx::query_scalar("SELECT count(*) FROM user_favourite_screens WHERE user_id = $1")
            .bind(b)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(stored, MAX_FAVOURITES);
    drop(tx);

    // Unstarring removes it.
    let mut tx = as_app(&db, t1).await;
    let after = write_favourite(&mut tx, (t1, a), "/pharmacy", false).await;
    assert_eq!(after.unwrap_or_else(|e| panic!("{e}")), NONE);
}
