//! MRD file requests: the scenarios added after independent review. A
//! psychiatric diagnosis stays restricted on the summary card (MHCA 2017
//! s.23); the summary needs clinical permissions, not the chip's; one
//! hospital cannot take a whole escalation pass; yesterday's errands close at
//! day end; teleconsultations ask for no file.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-mrd --test file_requests_review -- --ignored --test-threads=1
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

mod support;

use axum::Extension;
use axum::Json;
use axum::extract::{Path, State};
use medbrains_core::permissions;
use medbrains_mrd::file_requests::jobs::{self, PER_TENANT_LIMIT};
use medbrains_mrd::file_requests::summary::visit_digital_summary;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::authorization::authz_context;
use support::{World, claims_with, pool, requests_for, scoped, state, visit, world};
use uuid::Uuid;

/// The escalation pass reads every hospital; one test at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A user of `role` in the world's hospital.
async fn user(db: &sqlx::PgPool, w: &World, role: &str) -> Uuid {
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let id = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, $4, $5::user_role) RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(format!("mf{tag}"))
    .bind(format!("mf{tag}@mrd.test"))
    .bind(format!("Staff {tag}"))
    .bind(role)
    .fetch_one(&mut *tx)
    .await
    .expect("user");
    tx.commit().await.unwrap();
    id
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_psychiatric_diagnosis_reads_restricted_on_a_general_doctors_summary() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let psychiatrist = user(&db, &w, "doctor").await;
    let general = user(&db, &w, "doctor").await;
    let earlier = visit(&db, &w, w.patient, -30).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    sqlx::query(
        "INSERT INTO diagnoses (tenant_id, encounter_id, icd_code, icd_system, description, \
                                is_primary, recorded_by) \
         VALUES ($1, $2, 'F20.0', 'icd10', 'Paranoid schizophrenia', true, $3), \
                ($1, $2, 'E11', 'icd10', 'Type 2 diabetes', false, $3)",
    )
    .bind(w.claims.tenant_id)
    .bind(earlier)
    .bind(psychiatrist)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let today = visit(&db, &w, w.patient, 0).await;

    // The general doctor attends today's visit.
    let app = state(db.clone());
    app.authz
        .write_tuple(
            &authz_context(&w.claims),
            "encounter",
            today,
            medbrains_authz::Relation::AttendingPhysician,
            medbrains_authz::Subject::User(general),
            None,
            None,
        )
        .await
        .unwrap();
    let doctor = medbrains_server_core::middleware::auth::Claims {
        sub: general,
        role: "doctor".to_owned(),
        permissions: vec![
            permissions::opd::diagnoses::LIST.to_owned(),
            permissions::patients::VIEW.to_owned(),
        ],
        ..w.claims.clone()
    };
    let Json(summary) = visit_digital_summary(State(app), Extension(doctor), Path(today))
        .await
        .unwrap();
    let shown: Vec<(&str, Option<&str>)> = summary
        .diagnoses
        .items
        .iter()
        .map(|d| (d.description.as_str(), d.icd_code.as_deref()))
        .collect();
    assert!(shown.contains(&("Restricted entry", None)), "{shown:?}");
    assert!(
        shown.contains(&("Type 2 diabetes", Some("E11"))),
        "{shown:?}"
    );
    assert!(
        !shown.iter().any(|(d, _)| d.contains("schizophrenia")),
        "{shown:?}"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_records_room_sees_the_chip_but_not_the_clinical_summary() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let encounter = visit(&db, &w, w.patient, 0).await;
    let officer = claims_with(
        &w.claims,
        &[
            permissions::mrd::file_request::STATUS,
            permissions::patients::VIEW,
        ],
    );
    let refused = visit_digital_summary(
        State(state(db.clone())),
        Extension(officer),
        Path(encounter),
    )
    .await;
    assert!(matches!(refused, Err(AppError::Forbidden)), "{refused:?}");
}

/// How many of the hospital's requests are escalated.
async fn escalated(db: &sqlx::PgPool, w: &World) -> i64 {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let n = sqlx::query_scalar(
        "SELECT COUNT(*) FROM mrd_file_requests WHERE tenant_id = $1 AND escalated_at IS NOT NULL",
    )
    .bind(w.claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    n
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn one_hospital_cannot_take_a_whole_escalation_pass() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let flood = world(&db).await;
    let other = world(&db).await;
    for _ in 0..(PER_TENANT_LIMIT + 5) {
        visit(&db, &flood, flood.patient, 0).await;
    }
    visit(&db, &other, other.patient, 0).await;
    for w in [&flood, &other] {
        let mut tx = scoped(&db, w.claims.tenant_id).await;
        sqlx::query(
            "UPDATE mrd_file_requests SET due_at = now() - interval '1 hour' WHERE tenant_id = $1",
        )
        .bind(w.claims.tenant_id)
        .execute(&mut *tx)
        .await
        .unwrap();
        tx.commit().await.unwrap();
    }

    // Older late requests elsewhere in the database may come first; keep
    // passing until nothing is left to tell, watching each pass's share.
    let mut before = 0;
    for _ in 0..50 {
        let told = jobs::escalate_late(&db).await.unwrap();
        let now = escalated(&db, &flood).await;
        assert!(
            now - before <= PER_TENANT_LIMIT,
            "one pass escalated {} for one hospital",
            now - before
        );
        before = now;
        if told == 0 {
            break;
        }
    }
    assert_eq!(before, PER_TENANT_LIMIT + 5);
    assert_eq!(
        escalated(&db, &other).await,
        1,
        "the other hospital was told too"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn yesterdays_open_errands_close_at_day_end_and_todays_stay() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let yesterday = visit(&db, &w, w.patient, -1).await;
    let today = visit(&db, &w, w.patient, 0).await;
    jobs::close_ended_days(&db).await.unwrap();
    assert_eq!(requests_for(&db, &w, yesterday).await[0].1, "cancelled");
    assert_eq!(requests_for(&db, &w, today).await[0].1, "requested");
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let reason: Option<String> =
        sqlx::query_scalar("SELECT closed_reason FROM mrd_file_requests WHERE encounter_id = $1")
            .bind(yesterday)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(reason.as_deref(), Some("day_ended"));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_teleconsultation_asks_for_no_paper_file() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let w = world(&db).await;
    let mut tx = scoped(&db, w.claims.tenant_id).await;
    let tele: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, visit_type, notes) \
         VALUES ($1, $2, 'opd', 'teleconsultation', 'Telemedicine consultation') RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(w.patient)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(requests_for(&db, &w, tele).await, Vec::new());
}
