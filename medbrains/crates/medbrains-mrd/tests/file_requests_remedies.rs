//! MRD file requests: the remedies added after the second review. A file a
//! runner already picked up is not closed by cancelling its visit, is flagged
//! out overnight, and goes back to its shelf by hand; a visit whose file was
//! never requested can ask for it; the visit takes over its own pre-pulled
//! file, never one another appointment's errand already has.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-mrd --test file_requests_remedies -- --ignored --test-threads=1
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod support;

use axum::Extension;
use axum::Json;
use axum::extract::{Path, State};
use medbrains_core::permissions;
use medbrains_mrd::file_requests::jobs;
use medbrains_mrd::file_requests::pull_list;
use medbrains_mrd::file_requests::scan::{
    ScanRequest, ScanStep, return_file_to_shelf, scan_file_request,
};
use medbrains_mrd::file_requests::visit::{request_visit_file, visit_file_status};
use medbrains_server_core::error::AppError;
use support::{
    World, claims_with, insert_file, insert_patient, pool, requests_for, scoped, state, visit,
    world,
};
use uuid::Uuid;

/// The day-end pass reads every hospital; one test at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Scan the world's file for request `id` at `step`, as its runner.
async fn scan(db: &sqlx::PgPool, w: &World, id: Uuid, step: ScanStep) -> String {
    let Json(row) = scan_file_request(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(id),
        Json(ScanRequest {
            barcode: w.record_number.clone(),
            step,
        }),
    )
    .await
    .unwrap();
    row.status
}

/// Run one statement under the world's tenant.
async fn exec(db: &sqlx::PgPool, w: &World, sql: &str, id: Uuid) {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    sqlx::query(sql).bind(id).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
}

/// A request's status and closing reason, by id.
async fn state_of(db: &sqlx::PgPool, w: &World, id: Uuid) -> (String, Option<String>) {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let row = sqlx::query_as("SELECT status, closed_reason FROM mrd_file_requests WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    row
}

/// Open movements of the world's file: zero means it is on its shelf.
async fn open_movements(db: &sqlx::PgPool, w: &World) -> i64 {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let n = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mrd_record_movements \
          WHERE medical_record_id = $1 AND returned_at IS NULL AND deleted_at IS NULL",
    )
    .bind(w.record)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    n
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn cancelling_after_the_pick_keeps_the_file_picked_flags_it_and_it_goes_back_to_its_shelf() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let encounter = visit(&db, &w, w.patient, -1).await;
    let id = requests_for(&db, &w, encounter).await[0].0;
    assert_eq!(scan(&db, &w, id, ScanStep::Picked).await, "picked");
    let early = return_file_to_shelf(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(id),
    )
    .await;
    assert!(
        matches!(early, Err(AppError::Conflict(_))),
        "a visit still on is delivered, not shelved: {early:?}"
    );

    exec(
        &db,
        &w,
        "UPDATE encounters SET status = 'cancelled' WHERE id = $1",
        encounter,
    )
    .await;
    assert_eq!(state_of(&db, &w, id).await, ("picked".to_owned(), None));

    jobs::close_ended_days(&db).await.unwrap();
    assert_eq!(state_of(&db, &w, id).await, ("picked".to_owned(), None));
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let told: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE entity_id = $1 AND title = 'File out overnight'",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(
        told >= 1,
        "the supervisor is told the file is out overnight"
    );

    let viewer = claims_with(&w.claims, &[permissions::mrd::file_request::VIEW]);
    let refused = return_file_to_shelf(State(state(db.clone())), Extension(viewer), Path(id)).await;
    assert!(matches!(refused, Err(AppError::Forbidden)), "{refused:?}");
    // FULFIL alone, without access to this patient's record, is refused per record.
    let stranger = claims_with(&w.claims, &[permissions::mrd::file_request::FULFIL]);
    let hidden = return_file_to_shelf(State(state(db.clone())), Extension(stranger), Path(id)).await;
    assert!(matches!(hidden, Err(AppError::NotFound)), "{hidden:?}");
    assert_eq!(state_of(&db, &w, id).await, ("picked".to_owned(), None));

    assert_eq!(open_movements(&db, &w).await, 1, "the runner holds it");
    let Json(row) = return_file_to_shelf(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(id),
    )
    .await
    .unwrap();
    assert_eq!(row.status, "cancelled");
    assert_eq!(
        state_of(&db, &w, id).await,
        ("cancelled".to_owned(), Some("returned_to_shelf".to_owned()))
    );
    assert_eq!(open_movements(&db, &w).await, 0, "the movement is closed");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_visit_whose_file_was_never_requested_can_ask_for_it_once() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    // Registered before the file was shelved: the visit asked for nothing.
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let patient = insert_patient(&mut tx, w.claims.tenant_id).await;
    tx.commit().await.unwrap();
    let encounter = visit(&db, &w, patient, 0).await;
    assert_eq!(requests_for(&db, &w, encounter).await, Vec::new());
    let app = || State(state(db.clone()));

    let none = request_visit_file(app(), Extension(w.claims.clone()), Path(encounter)).await;
    assert!(
        matches!(none, Err(AppError::Conflict(_))),
        "no paper file: {none:?}"
    );

    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let number = format!("MRD-L{}", &Uuid::new_v4().simple().to_string()[..8]);
    insert_file(&mut tx, w.claims.tenant_id, patient, &number, "active").await;
    tx.commit().await.unwrap();
    let Json(chip) = visit_file_status(app(), Extension(w.claims.clone()), Path(encounter))
        .await
        .unwrap();
    assert!(
        chip.has_physical_file && chip.request.is_none(),
        "not requested"
    );

    let chip_only = claims_with(&w.claims, &[permissions::mrd::file_request::STATUS]);
    let refused = request_visit_file(app(), Extension(chip_only), Path(encounter)).await;
    assert!(matches!(refused, Err(AppError::Forbidden)), "{refused:?}");

    let Json(asked) = request_visit_file(app(), Extension(w.claims.clone()), Path(encounter))
        .await
        .unwrap();
    let first = asked.request.expect("requested");
    assert_eq!(first.status, "requested");
    let Json(again) = request_visit_file(app(), Extension(w.claims.clone()), Path(encounter))
        .await
        .unwrap();
    assert_eq!(again.request.map(|r| r.id), Some(first.id), "asked once");
    assert_eq!(requests_for(&db, &w, encounter).await.len(), 1);

    // Only a visit the trigger would ask for: not a teleconsultation, not a
    // visit already over.
    let tele = visit(&db, &w, patient, 0).await;
    exec(
        &db,
        &w,
        "UPDATE encounters SET visit_type = 'teleconsultation' WHERE id = $1",
        tele,
    )
    .await;
    let remote = request_visit_file(app(), Extension(w.claims.clone()), Path(tele)).await;
    assert!(matches!(remote, Err(AppError::Conflict(_))), "{remote:?}");
    exec(
        &db,
        &w,
        "UPDATE encounters SET status = 'completed' WHERE id = $1",
        encounter,
    )
    .await;
    let over = request_visit_file(app(), Extension(w.claims.clone()), Path(encounter)).await;
    assert!(matches!(over, Err(AppError::Conflict(_))), "{over:?}");

    exec(
        &db,
        &w,
        "UPDATE encounters SET status = 'cancelled' WHERE id = $1",
        encounter,
    )
    .await;
    let cancelled = request_visit_file(app(), Extension(w.claims.clone()), Path(encounter)).await;
    assert!(
        matches!(cancelled, Err(AppError::Conflict(_))),
        "a cancelled visit needs no file: {cancelled:?}"
    );
}

/// A doctor in the world's hospital.
async fn doctor(db: &sqlx::PgPool, w: &World) -> Uuid {
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let id = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, $4, 'doctor') RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(format!("mf{tag}"))
    .bind(format!("mf{tag}@mrd.test"))
    .bind(format!("Dr {tag}"))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// A booked appointment tomorrow for the world's patient with `doctor`.
async fn appointment(db: &sqlx::PgPool, w: &World, doctor: Uuid, slot: &str) -> Uuid {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let id = sqlx::query_scalar(
        "INSERT INTO appointments (tenant_id, patient_id, doctor_id, department_id, \
                                   appointment_date, slot_start, slot_end, created_by) \
         VALUES ($1, $2, $3, $4, CURRENT_DATE + 1, $5::time, $5::time + interval '15 min', $3) \
         RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(w.patient)
    .bind(doctor)
    .bind(w.department)
    .bind(slot)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// Check in `appt` and create its visit the way check-in does: the
/// appointment is `checked_in` and not yet linked when the visit is inserted.
async fn check_in(db: &sqlx::PgPool, w: &World, appt: Uuid, doctor: Uuid) -> Uuid {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    sqlx::query("UPDATE appointments SET status = 'checked_in' WHERE id = $1")
        .bind(appt)
        .execute(&mut *tx)
        .await
        .unwrap();
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id, \
                                 doctor_id, encounter_date, visit_type, created_by) \
         VALUES ($1, $2, 'opd', 'open', $3, $4, CURRENT_DATE + 1, 'booked', $4) RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(w.patient)
    .bind(w.department)
    .bind(doctor)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    sqlx::query("UPDATE appointments SET encounter_id = $2 WHERE id = $1")
        .bind(appt)
        .bind(encounter)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    encounter
}

/// The pre-pulled request for `appt`: `(id, status, encounter)`.
async fn pulled(db: &sqlx::PgPool, w: &World, appt: Uuid) -> (Uuid, String, Option<Uuid>) {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let row = sqlx::query_as(
        "SELECT id, status, encounter_id FROM mrd_file_requests \
          WHERE appointment_id = $1 AND status <> 'cancelled'",
    )
    .bind(appt)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    row
}

/// Write tomorrow's pull list for the world's hospital; returns the rows written.
async fn pull_tomorrow(db: &sqlx::PgPool, w: &World) -> u64 {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let date: chrono::NaiveDate = sqlx::query_scalar("SELECT CURRENT_DATE + 1")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    let n = pull_list::generate(&mut tx, w.claims.tenant_id, date, None)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    n
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_visit_takes_over_its_own_pull_list_row_never_another_appointments_delivered_one() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let (morning_doctor, noon_doctor) = (doctor(&db, &w).await, doctor(&db, &w).await);
    let morning = appointment(&db, &w, morning_doctor, "09:00").await;
    let noon = appointment(&db, &w, noon_doctor, "12:00").await;
    assert_eq!(pull_tomorrow(&db, &w).await, 2);

    // The noon patient checks in first: the noon row, not the earlier-due one.
    let noon_visit = check_in(&db, &w, noon, noon_doctor).await;
    assert_eq!(pulled(&db, &w, noon).await.2, Some(noon_visit));
    assert_eq!(pulled(&db, &w, morning).await.2, None);

    // The morning file is fetched and delivered before its visit exists.
    let morning_row = pulled(&db, &w, morning).await.0;
    assert_eq!(scan(&db, &w, morning_row, ScanStep::Picked).await, "picked");
    assert_eq!(
        scan(&db, &w, morning_row, ScanStep::Delivered).await,
        "delivered"
    );

    // A walk-in visit is not the morning appointment: it asks for its own.
    let walk_in = visit(&db, &w, w.patient, 1).await;
    let (_, status, taken) = pulled(&db, &w, morning).await;
    assert_eq!(
        (status.as_str(), taken),
        ("delivered", None),
        "another appointment's delivered file is never taken over"
    );
    let own = requests_for(&db, &w, walk_in).await;
    assert_eq!(own.len(), 1);
    assert_eq!(own[0].2, "visit", "the walk-in asked for its own file");

    // The morning visit takes over its own delivered file: arrived, asked once.
    let morning_visit = check_in(&db, &w, morning, morning_doctor).await;
    assert_eq!(
        pulled(&db, &w, morning).await,
        (morning_row, "delivered".to_owned(), Some(morning_visit))
    );
    assert_eq!(requests_for(&db, &w, morning_visit).await.len(), 1);
    let Json(chip) = visit_file_status(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(morning_visit),
    )
    .await
    .unwrap();
    assert_eq!(
        chip.request.map(|r| (r.id, r.status)),
        Some((morning_row, "delivered".to_owned())),
        "the chip reads arrived"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_picked_pull_list_file_goes_back_to_its_shelf_when_its_appointment_is_cancelled() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let booked = doctor(&db, &w).await;
    let appt = appointment(&db, &w, booked, "10:00").await;
    assert_eq!(pull_tomorrow(&db, &w).await, 1);
    let row = pulled(&db, &w, appt).await.0;
    assert_eq!(scan(&db, &w, row, ScanStep::Picked).await, "picked");

    exec(
        &db,
        &w,
        "UPDATE appointments SET status = 'cancelled' WHERE id = $1",
        appt,
    )
    .await;
    assert_eq!(state_of(&db, &w, row).await, ("picked".to_owned(), None));
    let Json(back) = return_file_to_shelf(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(row),
    )
    .await
    .unwrap();
    assert_eq!(back.status, "cancelled");
    assert_eq!(
        state_of(&db, &w, row).await,
        ("cancelled".to_owned(), Some("returned_to_shelf".to_owned()))
    );
    assert_eq!(open_movements(&db, &w).await, 0, "the movement is closed");
}
