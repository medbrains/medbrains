//! The hospital OPD number against a real, migrated database: off changes
//! nothing; manual takes the desk's number and refuses one in use, naming the
//! UHID and date but never the name; two desks racing for one number get one
//! success; per patient the number is kept on the patient and given once; per
//! visit each visit gets its own; no prefix means plain numbers.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-server-services --test opd_number -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use chrono::{Duration, NaiveDate};
use medbrains_server_core::error::AppError;
use medbrains_server_services::opd_number::{self, Entry, Mode, Policy, Scope};
use sqlx::PgPool;
use uuid::Uuid;

async fn pool() -> PgPool {
    PgPool::connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL"))
        .await
        .expect("connect")
}

/// A hospital with the given policy (`None` for never set).
async fn hospital(db: &PgPool, policy: Option<Policy>) -> Uuid {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'OPD number test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("ON{code}"))
    .fetch_one(db)
    .await
    .unwrap();
    if let Some(policy) = policy {
        let mut tx = db.begin().await.unwrap();
        opd_number::write_policy(&mut tx, tenant, &policy)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }
    tenant
}

/// A patient in `tenant`, with a visit.
async fn patient_with_visit(db: &PgPool, tenant: Uuid, name: &str) -> (Uuid, Uuid) {
    let uhid = format!("UH-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, $3, 'Test', 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(uhid)
    .bind(name)
    .fetch_one(db)
    .await
    .unwrap();
    let visit: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(db)
    .await
    .unwrap();
    (patient, visit)
}

/// `assign` in its own committed transaction, as a request would run it.
async fn assign(
    db: &PgPool,
    tenant: Uuid,
    ids: (Uuid, Option<Uuid>),
    typed: Option<&str>,
) -> Result<Option<String>, AppError> {
    let entry = Entry {
        typed,
        ..Entry::default()
    };
    let mut tx = db.begin().await.unwrap();
    let assigned = opd_number::assign(&mut tx, tenant, ids, entry).await?;
    tx.commit().await.unwrap();
    Ok(assigned.map(|a| a.number))
}

fn policy(mode: Mode, scope: Scope, prefix: &str) -> Policy {
    Policy {
        mode,
        scope,
        prefix: prefix.into(),
        ..Policy::default()
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn off_or_never_set_writes_nothing() {
    let db = pool().await;
    for set in [None, Some(policy(Mode::Off, Scope::Patient, ""))] {
        let tenant = hospital(&db, set).await;
        let (patient, visit) = patient_with_visit(&db, tenant, "Off").await;
        assert_eq!(
            assign(&db, tenant, (patient, None), Some("5"))
                .await
                .unwrap(),
            None
        );
        assert_eq!(
            assign(&db, tenant, (patient, Some(visit)), Some("5"))
                .await
                .unwrap(),
            None
        );
        let numbers: (Option<String>, Option<String>) = sqlx::query_as(
            "SELECT p.opd_number, e.encounter_number FROM patients p \
             JOIN encounters e ON e.patient_id = p.id WHERE p.id = $1",
        )
        .bind(patient)
        .fetch_one(&db)
        .await
        .unwrap();
        assert_eq!(numbers, (None, None));
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn per_patient_manual_keeps_the_typed_number_and_refuses_a_duplicate() {
    let db = pool().await;
    let tenant = hospital(&db, Some(policy(Mode::Manual, Scope::Patient, ""))).await;
    let (first, first_visit) = patient_with_visit(&db, tenant, "Anita").await;
    let (second, _) = patient_with_visit(&db, tenant, "Bina").await;
    assert_eq!(
        assign(&db, tenant, (first, None), Some("0042"))
            .await
            .unwrap()
            .as_deref(),
        Some("42")
    );
    // A returning patient's visit keeps the number they have.
    assert_eq!(
        assign(&db, tenant, (first, Some(first_visit)), Some("43"))
            .await
            .unwrap(),
        None
    );
    let Err(AppError::Conflict(message)) = assign(&db, tenant, (second, None), Some("42")).await
    else {
        panic!("a number in use must be refused");
    };
    let uhid: String = sqlx::query_scalar("SELECT uhid FROM patients WHERE id = $1")
        .bind(first)
        .fetch_one(&db)
        .await
        .unwrap();
    assert!(message.contains(&uhid), "{message}");
    assert!(message.contains("Next free number: 43"), "{message}");
    assert!(
        !message.contains("Anita"),
        "the other patient's name leaks: {message}"
    );
    let mut tx = db.begin().await.unwrap();
    let suggestion = opd_number::suggest(&mut tx, tenant, &Policy::default())
        .await
        .unwrap();
    assert_eq!((suggestion.previous, suggestion.next), (Some(42), 43));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn per_visit_numbers_each_visit_and_a_prefix_is_one_series() {
    let db = pool().await;
    let tenant = hospital(&db, Some(policy(Mode::Auto, Scope::Visit, "OP-"))).await;
    let (patient, visit) = patient_with_visit(&db, tenant, "Visit").await;
    assert_eq!(
        assign(&db, tenant, (patient, None), None).await.unwrap(),
        None
    );
    assert_eq!(
        assign(&db, tenant, (patient, Some(visit)), Some("99"))
            .await
            .unwrap()
            .as_deref(),
        Some("OP-1")
    );
    let (_, again) = patient_with_visit(&db, tenant, "Visit").await;
    assert_eq!(
        assign(&db, tenant, (patient, Some(again)), None)
            .await
            .unwrap()
            .as_deref(),
        Some("OP-2")
    );
    // "2" without the prefix is the same number, and the database says so too.
    let dup = sqlx::query("UPDATE encounters SET encounter_number = '2' WHERE id = $1")
        .bind(visit)
        .execute(&db)
        .await;
    assert!(dup.is_err(), "the unique index must refuse 2 beside OP-2");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn two_desks_typing_the_same_number_get_one_success() {
    let db = pool().await;
    let tenant = hospital(&db, Some(policy(Mode::Manual, Scope::Patient, ""))).await;
    let (a, _) = patient_with_visit(&db, tenant, "Desk A").await;
    let (b, _) = patient_with_visit(&db, tenant, "Desk B").await;
    // Desk A has taken 7 and not yet saved; desk B types 7 at the same moment.
    let mut desk_a = db.begin().await.unwrap();
    let entry = Entry {
        typed: Some("7"),
        ..Entry::default()
    };
    assert!(
        opd_number::assign(&mut desk_a, tenant, (a, None), entry)
            .await
            .is_ok()
    );
    let desk_b = tokio::spawn({
        let db = db.clone();
        async move { assign(&db, tenant, (b, None), Some("7")).await }
    });
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    desk_a.commit().await.unwrap();
    let refused = desk_b.await.unwrap();
    assert!(matches!(refused, Err(AppError::Conflict(_))), "{refused:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_hospital_start_and_another_hospitals_numbers_are_respected() {
    let db = pool().await;
    let start = Policy {
        start: 500,
        ..policy(Mode::Auto, Scope::Patient, "")
    };
    let tenant = hospital(&db, Some(start)).await;
    let other = hospital(&db, Some(policy(Mode::Manual, Scope::Patient, ""))).await;
    let (theirs, _) = patient_with_visit(&db, other, "Other").await;
    assert!(
        assign(&db, other, (theirs, None), Some("900"))
            .await
            .is_ok()
    );
    let (ours, _) = patient_with_visit(&db, tenant, "Ours").await;
    assert_eq!(
        assign(&db, tenant, (ours, None), None)
            .await
            .unwrap()
            .as_deref(),
        Some("500")
    );
    // Another hospital using 900 does not move ours.
    let mut tx = db.begin().await.unwrap();
    let ours_next = opd_number::suggest(
        &mut tx,
        tenant,
        &Policy {
            start: 500,
            ..Policy::default()
        },
    )
    .await;
    assert_eq!(ours_next.unwrap().next, 501);
}

/// `assign` per patient with an OPD date, in its own committed transaction.
async fn dated(
    db: &PgPool,
    tenant: Uuid,
    patient: Uuid,
    (typed, opd_date, may_backdate): (&str, NaiveDate, bool),
) -> Result<Option<NaiveDate>, AppError> {
    let entry = Entry {
        typed: Some(typed),
        opd_date: Some(opd_date),
        may_backdate,
    };
    let mut tx = db.begin().await.unwrap();
    let assigned = opd_number::assign(&mut tx, tenant, (patient, None), entry).await?;
    tx.commit().await.unwrap();
    Ok(assigned.and_then(|a| a.opd_date))
}

/// The date the hospital's clock says it is (tenants default to UTC).
fn today() -> NaiveDate {
    chrono::Utc::now().date_naive()
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_old_record_keeps_its_paper_date_and_nothing_else_moves() {
    let db = pool().await;
    let backdating = Policy {
        allow_backdate: true,
        ..policy(Mode::Manual, Scope::Patient, "")
    };
    let tenant = hospital(&db, Some(backdating)).await;
    let (patient, _) = patient_with_visit(&db, tenant, "Old record").await;
    let before: (chrono::DateTime<chrono::Utc>, i64) = sqlx::query_as(
        "SELECT created_at, (SELECT count(*) FROM encounters WHERE patient_id = $1) FROM patients WHERE id = $1",
    )
    .bind(patient)
    .fetch_one(&db)
    .await
    .unwrap();
    let paper = today() - Duration::days(400);
    // A number below today's highest is normal for old records.
    assert!(
        assign(
            &db,
            tenant,
            (patient_with_visit(&db, tenant, "New").await.0, None),
            Some("900")
        )
        .await
        .is_ok()
    );
    assert_eq!(
        dated(&db, tenant, patient, ("12", paper, true))
            .await
            .unwrap(),
        Some(paper)
    );
    let after: (chrono::DateTime<chrono::Utc>, i64) = sqlx::query_as(
        "SELECT created_at, (SELECT count(*) FROM encounters WHERE patient_id = $1) FROM patients WHERE id = $1",
    )
    .bind(patient)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        before, after,
        "created_at and the visit count must not move"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_backdate_is_refused_without_permission_setting_or_for_the_future() {
    let db = pool().await;
    let on = Policy {
        allow_backdate: true,
        ..policy(Mode::Manual, Scope::Patient, "")
    };
    let tenant = hospital(&db, Some(on)).await;
    let off = hospital(&db, Some(policy(Mode::Manual, Scope::Patient, ""))).await;
    let past = today() - Duration::days(30);
    let (a, _) = patient_with_visit(&db, tenant, "No permission").await;
    assert!(matches!(
        dated(&db, tenant, a, ("1", past, false)).await,
        Err(AppError::Forbidden)
    ));
    let (b, _) = patient_with_visit(&db, off, "Setting off").await;
    assert!(matches!(
        dated(&db, off, b, ("1", past, true)).await,
        Err(AppError::BadRequest(_))
    ));
    let (c, _) = patient_with_visit(&db, tenant, "Future").await;
    let future = today() + Duration::days(2);
    assert!(matches!(
        dated(&db, tenant, c, ("2", future, true)).await,
        Err(AppError::BadRequest(_))
    ));
    // Refused means nothing was written.
    let numbered: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patients WHERE id = ANY($1) AND (opd_number IS NOT NULL OR opd_date IS NOT NULL)",
    )
    .bind(vec![a, b, c])
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(numbered, 0);
    // Today needs neither the setting nor the permission.
    assert_eq!(
        dated(&db, off, b, ("3", today(), false)).await.unwrap(),
        Some(today())
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn manual_never_numbers_an_existing_patient_on_its_own() {
    let db = pool().await;
    let tenant = hospital(&db, Some(policy(Mode::Manual, Scope::Patient, ""))).await;
    // Registered before the hospital turned the number on: no number yet.
    let (patient, visit) = patient_with_visit(&db, tenant, "Existing").await;
    assert_eq!(
        assign(&db, tenant, (patient, Some(visit)), None)
            .await
            .unwrap(),
        None
    );
    assert_eq!(
        assign(&db, tenant, (patient, None), Some("  "))
            .await
            .unwrap(),
        None
    );
    let mut tx = db.begin().await.unwrap();
    assert_eq!(
        opd_number::patient_number(&mut tx, tenant, patient)
            .await
            .unwrap(),
        None
    );
    drop(tx);
    // The desk types it at the visit: now it is kept.
    let typed = assign(&db, tenant, (patient, Some(visit)), Some("31"))
        .await
        .unwrap();
    assert_eq!(typed.as_deref(), Some("31"));
    // Auto, by contrast, gives the next one itself.
    let auto = hospital(&db, Some(policy(Mode::Auto, Scope::Patient, ""))).await;
    let (theirs, visit) = patient_with_visit(&db, auto, "Existing auto").await;
    assert_eq!(
        assign(&db, auto, (theirs, Some(visit)), None)
            .await
            .unwrap()
            .as_deref(),
        Some("1")
    );
}
