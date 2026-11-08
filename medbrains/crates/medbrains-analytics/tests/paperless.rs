//! The paperless meter against a real, migrated database, one test per
//! scenario in the PR: documents made, signed and scanned are counted by
//! department; a department with no documents reads "none", never 0%; a
//! hospital never counted reads unknown; a re-run changes nothing; a caller
//! without the permission reads and recounts nothing; an outage is an error,
//! never an empty meter.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-analytics --test paperless -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_analytics::paperless::{ReportQuery, refresh, view};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

type Tx = sqlx::Transaction<'static, sqlx::Postgres>;

/// A pool on `DATABASE_URL`.
async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .expect("connect")
}

/// A transaction under `tenant`, scoped the way the request path scopes it.
async fn scoped(db: &PgPool, tenant: Uuid) -> Tx {
    let mut tx = db.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    tx
}

/// A hospital with its own user, a patient, and two clinical departments.
struct World {
    tenant: Uuid,
    user: Uuid,
    patient: Uuid,
    cardiology: Uuid,
    surgery: Uuid,
}

/// Insert one row and return its id.
async fn id(tx: &mut Tx, sql: &str, binds: &[Uuid], text: &str) -> Uuid {
    let mut q = sqlx::query_scalar(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.bind(text).fetch_one(&mut **tx).await.expect(sql)
}

/// A fresh hospital, so no other test's documents land in it.
async fn world(db: &PgPool) -> World {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Paperless test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("PL{code}"))
    .fetch_one(db)
    .await
    .expect("tenant");
    let mut tx = scoped(db, tenant).await;
    let user = id(
        &mut tx,
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $2 || '@paperless.test', 'Dr Meter', 'doctor') RETURNING id",
        &[tenant],
        &format!("pl{code}").to_lowercase(),
    )
    .await;
    let patient = id(
        &mut tx,
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Paper', 'Less', 'female', '9000000000') RETURNING id",
        &[tenant],
        &format!("PL-{code}"),
    )
    .await;
    let dept = "INSERT INTO departments (tenant_id, code, name, department_type) \
                VALUES ($1, $2, $2, 'clinical') RETURNING id";
    let cardiology = id(&mut tx, dept, &[tenant], &format!("CARD-{}", &code[..6])).await;
    let surgery = id(&mut tx, dept, &[tenant], &format!("SURG-{}", &code[..6])).await;
    tx.commit().await.unwrap();
    World {
        tenant,
        user,
        patient,
        cardiology,
        surgery,
    }
}

/// A user's claims holding `perms`, not a bypass role.
fn claims(w: &World, perms: &[&str]) -> Claims {
    Claims {
        sub: w.user,
        tenant_id: w.tenant,
        role: "quality_officer".to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

/// Both meter permissions.
fn manager(w: &World) -> Claims {
    claims(
        w,
        &[
            permissions::analytics::paperless::VIEW,
            permissions::analytics::paperless::REFRESH,
        ],
    )
}

/// Today's OPD visit in `dept`, two prescriptions on it (one signed), a
/// signed clinical note, and one scanned paper case sheet.
async fn documents(db: &PgPool, w: &World, dept: Uuid) {
    let mut tx = scoped(db, w.tenant).await;
    let visit = id(
        &mut tx,
        "INSERT INTO encounters (tenant_id, patient_id, department_id, encounter_type) \
         VALUES ($1, $2, $3, $4::text::encounter_type) RETURNING id",
        &[w.tenant, w.patient, dept],
        "opd",
    )
    .await;
    let rx = "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, notes) \
              VALUES ($1, $2, $3, $4) RETURNING id";
    let signed = id(&mut tx, rx, &[w.tenant, visit, w.user], "signed").await;
    id(&mut tx, rx, &[w.tenant, visit, w.user], "unsigned").await;
    id(
        &mut tx,
        "INSERT INTO signed_records (tenant_id, record_type, record_id, signer_user_id, \
            signer_role, payload_hash, signature_bytes, legal_class) \
         VALUES ($1, 'prescription', $2, $3, 'primary', '\\x00', '\\x00', $4) RETURNING id",
        &[w.tenant, signed, w.user],
        "clinical",
    )
    .await;
    let kind = id(
        &mut tx,
        "INSERT INTO note_types (tenant_id, code, name, category, sections) \
         VALUES ($1, $2, 'Meter note', 'physician', '[]') RETURNING id",
        &[w.tenant],
        &format!("meter_{}", Uuid::new_v4().simple()),
    )
    .await;
    id(
        &mut tx,
        "INSERT INTO clinical_notes (tenant_id, patient_id, encounter_id, note_type_id, \
            author_id, author_role, status, signed_at) \
         VALUES ($1, $2, $3, $4, $5, $6, 'signed', now()) RETURNING id",
        &[w.tenant, w.patient, visit, kind, w.user],
        "author",
    )
    .await;
    id(
        &mut tx,
        "INSERT INTO case_sheet_scans (tenant_id, patient_id, encounter_id, scan_image_url) \
         VALUES ($1, $2, $3, $4) RETURNING id",
        &[w.tenant, w.patient, visit],
        "s3://scans/sheet.jpg",
    )
    .await;
    tx.commit().await.unwrap();
}

/// The meter for the default range, as a manager.
async fn read(db: &PgPool, w: &World) -> medbrains_analytics::paperless::PaperlessReport {
    let q = ReportQuery {
        from: None,
        to: None,
        days: None,
    };
    view(db, &manager(w), &q).await.expect("view")
}

/// Given a visit in Cardiology with two prescriptions (one signed), a signed
/// note and a scanned case sheet, and Surgery with nothing, When the meter
/// recounts and is read, Then 3 documents were made, 2 signed and 1 paper
/// sheet scanned: 75% digital, 67% signed, 0% legally signed with the reason
/// shown; Cardiology carries them and Surgery reads no share at all.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn documents_signatures_and_paper_are_counted_by_department() {
    let db = pool().await;
    let w = world(&db).await;
    documents(&db, &w, w.cardiology).await;
    refresh(&db, &manager(&w), Some(7)).await.expect("refresh");
    let r = read(&db, &w).await;
    assert_eq!(
        (r.totals.created, r.totals.signed, r.totals.scanned),
        (3, 2, 1)
    );
    assert_eq!(r.digital_pct, Some(75.0));
    assert!((r.signed_pct.unwrap() - 200.0 / 3.0).abs() < 1e-9);
    assert_eq!(r.legal.pct, Some(0.0), "0% of a known count, not hidden");
    assert!(!r.legal.provider_connected && r.legal.note.contains("eSign"));
    let row = |d: Uuid| {
        r.departments
            .iter()
            .find(|x| x.department_id == Some(d))
            .expect("row")
    };
    assert_eq!(row(w.cardiology).counts.created, 3);
    assert_eq!(row(w.surgery).counts.created, 0);
    assert_eq!(
        row(w.surgery).signed_pct,
        None,
        "no documents is not 0% signed"
    );
    let rx = r
        .doc_types
        .iter()
        .find(|t| t.doc_type == "prescription")
        .expect("type");
    assert_eq!((rx.created, rx.signed), (2, 1));
    assert_eq!(r.measured_days, 7);
}

/// Given the meter has counted a week, When it recounts the same week, Then
/// the rows and totals are the same: the window is replaced, not added to.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_recount_changes_nothing() {
    let db = pool().await;
    let w = world(&db).await;
    documents(&db, &w, w.cardiology).await;
    let first = refresh(&db, &manager(&w), None).await.expect("first");
    let second = refresh(&db, &manager(&w), None).await.expect("second");
    assert_eq!(first.rows, second.rows);
    let r = read(&db, &w).await;
    assert_eq!(
        (r.totals.created, r.totals.signed, r.totals.scanned),
        (3, 2, 1)
    );
}

/// Given a hospital the meter has never counted, When it is read, Then every
/// share is unknown, every day reads "not measured", and the sentence says
/// so; once a week with no documents is counted, the shares are still
/// unknown but the days read as measured.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn no_data_is_unknown_never_zero() {
    let db = pool().await;
    let w = world(&db).await;
    let r = read(&db, &w).await;
    assert_eq!(
        (r.measured_days, r.digital_pct, r.signed_pct, r.legal.pct),
        (0, None, None, None)
    );
    assert!(r.series.iter().all(|d| !d.measured && d.counts.is_none()));
    assert!(r.summary.contains("not been counted"), "{}", r.summary);
    refresh(&db, &manager(&w), Some(7)).await.expect("refresh");
    let r = read(&db, &w).await;
    assert_eq!((r.measured_days, r.signed_pct), (7, None));
    assert!(
        r.summary.starts_with("No clinical documents"),
        "{}",
        r.summary
    );
}

/// Given a user without the meter's permissions, When they read or recount
/// it, Then both are refused and nothing is counted.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_caller_without_the_permission_reads_and_recounts_nothing() {
    let db = pool().await;
    let w = world(&db).await;
    let nobody = claims(&w, &[permissions::analytics::management::VIEW]);
    let q = ReportQuery {
        from: None,
        to: None,
        days: None,
    };
    assert!(matches!(
        view(&db, &nobody, &q).await,
        Err(AppError::Forbidden)
    ));
    let viewer = claims(&w, &[permissions::analytics::paperless::VIEW]);
    assert!(matches!(
        refresh(&db, &viewer, None).await,
        Err(AppError::Forbidden)
    ));
    assert_eq!(
        read(&db, &w).await.measured_days,
        0,
        "the refused recount ran nothing"
    );
}

/// Given the database is unreachable, When the meter is read, Then it is an
/// error, never a meter of zeros.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_outage_is_an_error_not_an_empty_meter() {
    let db = pool().await;
    let w = world(&db).await;
    db.close().await;
    let q = ReportQuery {
        from: None,
        to: None,
        days: None,
    };
    assert!(view(&db, &manager(&w), &q).await.is_err());
}

/// An admission to `dept` with an OT booking, and a sign-in checklist on it.
async fn ot_checklist(db: &PgPool, w: &World, dept: Uuid) {
    let mut tx = scoped(db, w.tenant).await;
    let visit = id(
        &mut tx,
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, $3::text::encounter_type) RETURNING id",
        &[w.tenant, w.patient],
        "ipd",
    )
    .await;
    let admission = id(
        &mut tx,
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
            department_id, admission_number) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        &[w.tenant, visit, w.patient, w.user, dept],
        &format!("ADM-{}", Uuid::new_v4().simple()),
    )
    .await;
    let room = id(
        &mut tx,
        "INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, 'OT 1', $2) RETURNING id",
        &[w.tenant],
        &format!("OT{}", &Uuid::new_v4().simple().to_string()[..6]),
    )
    .await;
    let booking = id(
        &mut tx,
        "INSERT INTO ot_bookings (tenant_id, patient_id, admission_id, ot_room_id, \
            primary_surgeon_id, scheduled_date, scheduled_start, scheduled_end, procedure_name) \
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, now(), now() + INTERVAL '1 hour', $6) \
         RETURNING id",
        &[w.tenant, w.patient, admission, room, w.user],
        "Appendicectomy",
    )
    .await;
    id(
        &mut tx,
        "INSERT INTO ot_surgical_safety_checklists (tenant_id, booking_id, phase) \
         VALUES ($1, $2, $3::text::checklist_phase) RETURNING id",
        &[w.tenant, booking],
        "sign_in",
    )
    .await;
    tx.commit().await.unwrap();
}

/// Given an OT safety checklist (a type #5259 made signable) on a booking for
/// a Surgery admission, When the meter recounts, Then it is counted under
/// Surgery, reached through the booking's admission; and every registered
/// type is listed and countable on this schema.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_new_signable_type_finds_its_department_through_its_parent() {
    let db = pool().await;
    let w = world(&db).await;
    ot_checklist(&db, &w, w.surgery).await;
    refresh(&db, &manager(&w), Some(7)).await.expect("refresh");
    let r = read(&db, &w).await;
    let ot = r
        .doc_types
        .iter()
        .find(|t| t.doc_type == "ot_safety_checklist")
        .expect("type");
    assert_eq!((ot.created, ot.signed), (1, 0));
    let surgery = r
        .departments
        .iter()
        .find(|d| d.department_id == Some(w.surgery))
        .expect("row");
    assert_eq!(
        surgery.counts.created, 1,
        "reached through ot_bookings, then admissions"
    );
    let registered = medbrains_documents::signable::SIGNABLE.len();
    assert!(registered >= 21, "registry holds {registered}");
    assert_eq!(
        r.doc_types.len(),
        registered + 1,
        "every signable type and clinical notes"
    );
    assert!(
        !r.not_counted.iter().any(|n| n.contains("no creation time")),
        "every registered table is countable: {:?}",
        r.not_counted
    );
}
