//! One number (OPD-number policy mode `uhid`): the register number the desk
//! types is the UHID. Against a fresh migrated database, as the request role:
//! an old lower number is taken and leaves the series alone; a higher one
//! moves the series up; the next is the series' next; a number in use is
//! refused naming its UHID and date, never the name; two desks racing for one
//! number get one success; decoys never collide; and the mode needs a plain
//! series and leaves the OPD number off.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_db_migrations::testing::{APP_ROLE, TestDb, add_tenant, fresh_db};
use medbrains_server_core::error::AppError;
use medbrains_server_services::opd_number::{self, Entry, Mode, Policy, Scope};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// A hospital in one-number mode: a plain UHID series at `at`.
async fn one_number_hospital(db: &TestDb, code: &str, at: i64) -> (PgPool, PgPool, Uuid) {
    let owner = db.owner().await.expect("owner");
    let tenant = add_tenant(&owner, code).await.expect("tenant");
    sqlx::query(
        "UPDATE sequences SET prefix = '', pad_width = 0, current_val = $2 \
          WHERE tenant_id = $1 AND seq_type = 'UHID'",
    )
    .bind(tenant)
    .bind(at)
    .execute(&owner)
    .await
    .unwrap();
    let app = db.connect(APP_ROLE).await.expect("app");
    let mut tx = desk(&app, tenant).await;
    let policy = Policy {
        mode: Mode::Uhid,
        allow_backdate: true,
        ..Policy::default()
    };
    opd_number::write_policy(&mut tx, tenant, &policy)
        .await
        .expect("a plain series takes one-number mode");
    tx.commit().await.unwrap();
    (owner, app, tenant)
}

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

/// Register a patient with a typed UHID in its own committed transaction.
async fn register(app: &PgPool, tenant: Uuid, typed: &str) -> Result<String, AppError> {
    let mut tx = desk(app, tenant).await;
    let uhid = opd_number::take_typed_uhid(&mut tx, tenant, typed).await?;
    insert_patient(&mut tx, tenant, &uhid, "Anita").await;
    tx.commit().await.unwrap();
    Ok(uhid)
}

/// The patient row registration writes after taking the UHID.
async fn insert_patient(tx: &mut Transaction<'_, Postgres>, tenant: Uuid, uhid: &str, name: &str) {
    sqlx::query(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, opd_date) \
         VALUES ($1, $2, $3, 'Test', 'female', '9000000000', DATE '2019-03-04')",
    )
    .bind(tenant)
    .bind(uhid)
    .bind(name)
    .execute(&mut **tx)
    .await
    .unwrap();
}

/// The series' current value.
async fn current(owner: &PgPool, tenant: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT current_val FROM sequences WHERE tenant_id = $1 AND seq_type = 'UHID'",
    )
    .bind(tenant)
    .fetch_one(owner)
    .await
    .unwrap()
}

/// What the form shows beside the field: the series' previous and next.
async fn suggestion(app: &PgPool, tenant: Uuid) -> (Option<String>, String) {
    let mut tx = desk(app, tenant).await;
    opd_number::suggest_uhid(&mut tx, tenant).await.unwrap()
}

#[tokio::test]
async fn an_old_lower_number_is_taken_and_never_moves_the_series_back() {
    let db = fresh_db().await.expect("test database");
    let (owner, app, tenant) = one_number_hospital(&db, "RU1", 1043).await;
    assert_eq!(register(&app, tenant, "0017").await.unwrap(), "17");
    assert_eq!(current(&owner, tenant).await, 1043);
    assert_eq!(
        suggestion(&app, tenant).await,
        (Some("1043".into()), "1044".into())
    );
}

#[tokio::test]
async fn a_higher_number_moves_the_series_up_so_next_stays_ahead() {
    let db = fresh_db().await.expect("test database");
    let (owner, app, tenant) = one_number_hospital(&db, "RU2", 1043).await;
    assert_eq!(register(&app, tenant, "2000").await.unwrap(), "2000");
    assert_eq!(current(&owner, tenant).await, 2000);
    assert_eq!(suggestion(&app, tenant).await.1, "2001");
}

#[tokio::test]
async fn next_is_the_series_next_and_none_before_the_first() {
    let db = fresh_db().await.expect("test database");
    let (_, app, tenant) = one_number_hospital(&db, "RU3", 0).await;
    assert_eq!(suggestion(&app, tenant).await, (None, "1".into()));
}

#[tokio::test]
async fn a_number_in_use_is_refused_with_its_uhid_and_date_never_the_name() {
    let db = fresh_db().await.expect("test database");
    let (owner, app, tenant) = one_number_hospital(&db, "RU4", 1043).await;
    register(&app, tenant, "500").await.unwrap();
    let Err(AppError::Conflict(message)) = register(&app, tenant, "0500").await else {
        panic!("a number in use must be refused");
    };
    assert!(message.contains("UHID 500"), "{message}");
    assert!(message.contains("04 Mar 2019"), "{message}");
    assert!(message.contains("Next free number: 1044"), "{message}");
    assert!(!message.contains("Anita"), "the name leaks: {message}");
    assert_eq!(current(&owner, tenant).await, 1043);
    for bad in ["12a", "MB-1", "-5", "0"] {
        assert!(matches!(
            register(&app, tenant, bad).await,
            Err(AppError::BadRequest(_))
        ));
    }
}

#[tokio::test]
async fn two_desks_typing_the_same_number_get_one_success() {
    let db = fresh_db().await.expect("test database");
    let (_, app, tenant) = one_number_hospital(&db, "RU5", 10).await;
    // Desk A has taken 77 and not yet saved; desk B types 77 at that moment.
    let mut desk_a = desk(&app, tenant).await;
    let uhid = opd_number::take_typed_uhid(&mut desk_a, tenant, "77")
        .await
        .unwrap();
    insert_patient(&mut desk_a, tenant, &uhid, "Desk A").await;
    let desk_b = tokio::spawn({
        let app = app.clone();
        async move { register(&app, tenant, "77").await }
    });
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    desk_a.commit().await.unwrap();
    let refused = desk_b.await.unwrap();
    assert!(matches!(refused, Err(AppError::Conflict(_))), "{refused:?}");
}

#[tokio::test]
async fn a_typed_number_never_equals_a_decoy_and_decoys_leave_the_series_alone() {
    let db = fresh_db().await.expect("test database");
    let (owner, app, tenant) = one_number_hospital(&db, "RU6", 10).await;
    // A decoy as security-intel plants it: its own prefix, outside the series.
    sqlx::query(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'MB-123456', 'Decoy', 'Patient', 'female', '0000000000')",
    )
    .bind(tenant)
    .execute(&owner)
    .await
    .unwrap();
    assert!(matches!(
        register(&app, tenant, "MB-123456").await,
        Err(AppError::BadRequest(_))
    ));
    assert_eq!(register(&app, tenant, "123456").await.unwrap(), "123456");
    let decoy_dup = sqlx::query(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, '123456', 'Decoy', 'Patient', 'female', '0000000000')",
    )
    .bind(tenant)
    .execute(&owner)
    .await;
    assert!(
        decoy_dup.is_err(),
        "the unique index refuses a decoy on a typed UHID"
    );
}

#[tokio::test]
async fn one_number_mode_needs_a_plain_series_and_keeps_no_opd_number() {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner");
    let tenant = add_tenant(&owner, "RU7").await.expect("tenant");
    let app = db.connect(APP_ROLE).await.expect("app");
    let mut tx = desk(&app, tenant).await;
    let one = Policy {
        mode: Mode::Uhid,
        scope: Scope::Patient,
        ..Policy::default()
    };
    // The default series is prefixed (UHID-): refused, with what to change.
    assert!(matches!(
        opd_number::write_policy(&mut tx, tenant, &one).await,
        Err(AppError::BadRequest(_))
    ));
    drop(tx);
    let (_, app, tenant) = one_number_hospital(&db, "RU8", 5).await;
    let patient: Uuid = {
        let mut tx = desk(&app, tenant).await;
        let uhid = opd_number::take_typed_uhid(&mut tx, tenant, "3")
            .await
            .unwrap();
        insert_patient(&mut tx, tenant, &uhid, "Old").await;
        let id = sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id = $1 AND uhid = $2")
            .bind(tenant)
            .bind(&uhid)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        id
    };
    let mut tx = desk(&app, tenant).await;
    let entry = Entry {
        typed: Some("9"),
        ..Entry::default()
    };
    assert!(
        opd_number::assign(&mut tx, tenant, (patient, None), entry)
            .await
            .unwrap()
            .is_none(),
        "no OPD number in one-number mode"
    );
    assert!(
        !Mode::Uhid.keeps_opd_number(),
        "no OPD no. column or search"
    );
    assert!(!Mode::Off.keeps_opd_number());
    assert!(Mode::Manual.keeps_opd_number() && Mode::Auto.keeps_opd_number());
}
