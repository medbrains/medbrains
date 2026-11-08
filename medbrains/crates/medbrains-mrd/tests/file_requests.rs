//! MRD file requests against a real, migrated database: the scenarios of the
//! file-wait fix (walk-in, pre-pulled appointment, missing file, file out with
//! another clinic, second visit, cancellation, permission denied, outage).
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-mrd --test file_requests -- --ignored --test-threads=1
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod support;

use axum::Extension;
use axum::Json;
use axum::extract::{Path, Query, State};
use medbrains_core::permissions;
use medbrains_mrd::file_requests::reports::{
    BackscanQuery, DeliveryTimesQuery, delivery_times, list_backscan_order,
};
use medbrains_mrd::file_requests::scan::{
    ScanRequest, ScanStep, mark_file_not_found, scan_file_request,
};
use medbrains_mrd::file_requests::visit::visit_file_status;
use medbrains_mrd::file_requests::{ListFileRequestsQuery, jobs, list_file_requests, pull_list};
use medbrains_server_core::error::AppError;
use support::{
    claims_with, insert_file, insert_patient, pool, requests_for, scoped, state, visit, world,
};
use uuid::Uuid;

/// The escalation pass reads every hospital; one test at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Scan `barcode` at `step` as the world's runner.
async fn scan(
    w: &support::World,
    db: &sqlx::PgPool,
    id: Uuid,
    barcode: &str,
    step: ScanStep,
) -> Result<String, AppError> {
    let body = ScanRequest {
        barcode: barcode.to_owned(),
        step,
    };
    let Json(row) = scan_file_request(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(id),
        Json(body),
    )
    .await?;
    Ok(row.status)
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn walk_in_asks_for_the_file_and_the_runner_delivers_it() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let encounter = visit(&db, &w, w.patient, 0).await;

    let rows = requests_for(&db, &w, encounter).await;
    assert_eq!(rows.len(), 1, "one request per visit");
    let (id, status, source, due_minutes) = rows[0].clone();
    assert_eq!(
        (status.as_str(), source.as_str(), due_minutes),
        ("requested", "visit", 10)
    );

    let Json(queue) = list_file_requests(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Query(ListFileRequestsQuery { date: None }),
    )
    .await
    .unwrap();
    let row = queue.iter().find(|r| r.id == id).expect("in the queue");
    assert_eq!(
        row.location_label.as_deref(),
        Some("Records / Rack 3 / Shelf B / Bin 7")
    );
    assert_eq!(row.department_name.as_deref(), Some("Cardiology OPD"));

    let wrong = scan(&w, &db, id, "MRD-SOMEONE-ELSE", ScanStep::Picked).await;
    assert!(matches!(wrong, Err(AppError::Conflict(_))), "{wrong:?}");
    let early = scan(&w, &db, id, &w.record_number, ScanStep::Delivered).await;
    assert!(
        matches!(early, Err(AppError::Conflict(_))),
        "delivered before picked"
    );
    assert_eq!(
        scan(
            &w,
            &db,
            id,
            &w.record_number.to_lowercase(),
            ScanStep::Picked
        )
        .await
        .unwrap(),
        "picked"
    );
    assert_eq!(
        scan(&w, &db, id, &w.record_number, ScanStep::Delivered)
            .await
            .unwrap(),
        "delivered"
    );

    // Each scan is a record movement; only the clinic's is still open.
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let moves: Vec<(Option<Uuid>, Option<Uuid>, bool)> = sqlx::query_as(
        "SELECT issued_to_user_id, issued_to_department_id, returned_at IS NULL \
           FROM mrd_record_movements WHERE medical_record_id = $1 ORDER BY issued_at, created_at",
    )
    .bind(w.record)
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(
        moves,
        vec![
            (Some(w.claims.sub), None, false),
            (None, Some(w.department), true)
        ]
    );

    let Json(chip) = visit_file_status(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(encounter),
    )
    .await
    .unwrap();
    assert!(chip.has_physical_file);
    assert_eq!(chip.request.map(|r| r.status).as_deref(), Some("delivered"));

    let today = chrono::Utc::now().date_naive();
    let Json(times) = delivery_times(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Query(DeliveryTimesQuery {
            from: today - chrono::Duration::days(1),
            to: today + chrono::Duration::days(1),
        }),
    )
    .await
    .unwrap();
    for grouping in ["all", "department", "runner"] {
        let row = times
            .iter()
            .find(|t| t.grouping == grouping)
            .expect(grouping);
        assert_eq!(row.deliveries, 1, "{grouping}");
        assert!(row.median_minutes.is_some() && row.p90_minutes.is_some());
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn no_paper_file_means_no_request_and_no_chip() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let digital_only = insert_patient(&mut tx, w.claims.tenant_id).await;
    tx.commit().await.unwrap();
    let encounter = visit(&db, &w, digital_only, 0).await;
    assert_eq!(requests_for(&db, &w, encounter).await, Vec::new());
    let Json(chip) = visit_file_status(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(encounter),
    )
    .await
    .unwrap();
    assert!(!chip.has_physical_file && chip.request.is_none());
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_pull_list_pre_pulls_and_the_visit_takes_it_over() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let appointment: Uuid = sqlx::query_scalar(
        "INSERT INTO appointments (tenant_id, patient_id, doctor_id, department_id, appointment_date, \
                                   slot_start, slot_end, created_by) \
         VALUES ($1, $2, $3, $4, CURRENT_DATE + 1, '09:30', '09:45', $3) RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(w.patient)
    .bind(w.claims.sub)
    .bind(w.department)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let date: chrono::NaiveDate = sqlx::query_scalar("SELECT CURRENT_DATE + 1")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(
        pull_list::generate(&mut tx, w.claims.tenant_id, date, None)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        pull_list::generate(&mut tx, w.claims.tenant_id, date, None)
            .await
            .unwrap(),
        0,
        "idempotent"
    );
    tx.commit().await.unwrap();

    // Booked and never scanned: first in the back-scanning order, until scanned.
    let backscan = async || {
        let Json(rows) = list_backscan_order(
            State(state(db.clone())),
            Extension(w.claims.clone()),
            Query(BackscanQuery { days: Some(7) }),
        )
        .await
        .unwrap();
        rows.iter().any(|r| r.medical_record_id == w.record)
    };
    assert!(backscan().await);
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    sqlx::query(
        "INSERT INTO case_sheet_scans (tenant_id, patient_id, scan_image_url, status) \
         VALUES ($1, $2, 'scans/1.png', 'image_only')",
    )
    .bind(w.claims.tenant_id)
    .bind(w.patient)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(!backscan().await);

    let encounter = visit(&db, &w, w.patient, 1).await;
    let rows = requests_for(&db, &w, encounter).await;
    assert_eq!(rows.len(), 1, "the visit took over the pre-pulled request");
    assert_eq!(rows[0].2, "pull_list");

    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let linked: Option<Uuid> =
        sqlx::query_scalar("SELECT appointment_id FROM mrd_file_requests WHERE id = $1")
            .bind(rows[0].0)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(linked, Some(appointment));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_missing_file_is_requested_as_not_found_and_the_supervisor_is_told() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let patient = insert_patient(&mut tx, w.claims.tenant_id).await;
    insert_file(
        &mut tx,
        w.claims.tenant_id,
        patient,
        &format!("{}-M", w.record_number),
        "missing",
    )
    .await;
    tx.commit().await.unwrap();
    let encounter = visit(&db, &w, patient, 0).await;
    let rows = requests_for(&db, &w, encounter).await;
    assert_eq!(rows[0].1, "not_found");

    jobs::escalate_late(&db).await.unwrap();
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let (escalated, told): (bool, i64) = sqlx::query_as(
        "SELECT f.escalated_at IS NOT NULL, \
                (SELECT COUNT(*) FROM notifications n WHERE n.entity_id = f.id AND n.user_id = $2) \
           FROM mrd_file_requests f WHERE f.id = $1",
    )
    .bind(rows[0].0)
    .bind(w.claims.sub)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(escalated && told == 1, "escalated={escalated} told={told}");
    jobs::escalate_late(&db).await.unwrap();
    // Told once, not every pass.
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_runner_marks_a_file_not_found_and_can_still_find_it() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let encounter = visit(&db, &w, w.patient, 0).await;
    let id = requests_for(&db, &w, encounter).await[0].0;
    let Json(row) = mark_file_not_found(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Path(id),
    )
    .await
    .unwrap();
    assert_eq!(row.status, "not_found");
    assert_eq!(
        scan(&w, &db, id, &w.record_number, ScanStep::Picked)
            .await
            .unwrap(),
        "picked"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_file_out_with_another_clinic_shows_where_it_is_and_a_second_visit_asks_again() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    sqlx::query(
        "INSERT INTO mrd_record_movements (tenant_id, medical_record_id, issued_to_department_id) \
         VALUES ($1, $2, $3)",
    )
    .bind(w.claims.tenant_id)
    .bind(w.record)
    .bind(w.other_department)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    let first = visit(&db, &w, w.patient, 0).await;
    let second = visit(&db, &w, w.patient, 0).await;
    let a = requests_for(&db, &w, first).await;
    let b = requests_for(&db, &w, second).await;
    assert_eq!((a.len(), b.len()), (1, 1), "one request for each visit");
    assert_ne!(a[0].0, b[0].0);

    // Asking again for the same visit is the same request.
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let again: Option<Uuid> = sqlx::query_scalar("SELECT public.mrd_request_file_for_visit($1)")
        .bind(first)
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(again, Some(a[0].0));

    let Json(queue) = list_file_requests(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Query(ListFileRequestsQuery { date: None }),
    )
    .await
    .unwrap();
    let row = queue.iter().find(|r| r.id == a[0].0).unwrap();
    assert_eq!(row.holder_department.as_deref(), Some("Orthopaedics OPD"));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn cancelling_the_visit_closes_the_request_and_the_due_time_is_a_setting() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'mrd', 'file_request_due_minutes', '25'::jsonb)",
    )
    .bind(w.claims.tenant_id)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let encounter = visit(&db, &w, w.patient, 0).await;
    assert_eq!(requests_for(&db, &w, encounter).await[0].3, 25);

    let mut tx = scoped(&db, w.claims.tenant_id).await;
    sqlx::query("UPDATE encounters SET status = 'cancelled' WHERE id = $1")
        .bind(encounter)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(requests_for(&db, &w, encounter).await[0].1, "cancelled");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_permission_every_route_refuses() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let encounter = visit(&db, &w, w.patient, 0).await;
    let id = requests_for(&db, &w, encounter).await[0].0;
    let viewer = support::World {
        claims: claims_with(&w.claims, &[permissions::mrd::file_request::VIEW]),
        ..w
    };
    let refused = scan(&viewer, &db, id, &viewer.record_number, ScanStep::Picked).await;
    assert!(matches!(refused, Err(AppError::Forbidden)), "{refused:?}");
    let nothing = claims_with(&viewer.claims, &[]);
    let chip = visit_file_status(
        State(state(db.clone())),
        Extension(nothing.clone()),
        Path(encounter),
    )
    .await;
    assert!(matches!(chip, Err(AppError::Forbidden)), "{chip:?}");
    let list = list_file_requests(
        State(state(db.clone())),
        Extension(nothing),
        Query(ListFileRequestsQuery { date: None }),
    )
    .await;
    assert!(matches!(list, Err(AppError::Forbidden)), "{list:?}");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_outage_is_an_error_never_an_empty_queue() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    db.close().await;
    let list = list_file_requests(
        State(state(db.clone())),
        Extension(w.claims.clone()),
        Query(ListFileRequestsQuery { date: None }),
    )
    .await;
    assert!(list.is_err(), "a closed database must not read as no files");
}
