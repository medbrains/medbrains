//! OPD auto-close against a real, migrated database: a visit the doctor
//! started more than the hospital's minutes ago closes like the doctor's own
//! "complete" (queue row, visit, token), marked as closed automatically and
//! audited as the system; anything newer, anything still waiting, a hospital
//! with the setting off and another hospital's visits are left alone; notes
//! stay drafts; a second pass closes nothing.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-opd --test auto_close -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use medbrains_opd::auto_close::close_due_for_tenant;
use sqlx::PgPool;
use uuid::Uuid;

struct Hospital {
    tenant: Uuid,
    doctor: Uuid,
    patient: Uuid,
    department: Uuid,
}

struct Visit {
    queue: Uuid,
    encounter: Uuid,
    note: Uuid,
}

async fn pool() -> PgPool {
    PgPool::connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL"))
        .await
        .expect("connect")
}

/// A hospital with a doctor, a patient and a department; `minutes` is its
/// auto-close setting, `None` for never set.
async fn hospital(db: &PgPool, minutes: Option<i32>) -> Hospital {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Auto-close test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("AC{code}"))
    .fetch_one(db)
    .await
    .unwrap();
    let doctor: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, 'Dr Test', 'doctor') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("ac{}", code.to_lowercase()))
    .bind(format!("ac{}@autoclose.test", code.to_lowercase()))
    .fetch_one(db)
    .await
    .unwrap();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Test', 'Patient', 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("AC-{code}"))
    .fetch_one(db)
    .await
    .unwrap();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, 'GM', 'General Medicine', 'clinical') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(db)
    .await
    .unwrap();
    if let Some(minutes) = minutes {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, 'opd', 'auto_close_after_minutes', $2)",
        )
        .bind(tenant)
        .bind(serde_json::json!(minutes))
        .execute(db)
        .await
        .unwrap();
    }
    Hospital {
        tenant,
        doctor,
        patient,
        department,
    }
}

/// A visit with its queue row at `status`, called in `called_mins_ago` (None:
/// never called, last moved two hours ago), a token on the board and a draft
/// note.
async fn visit(db: &PgPool, h: &Hospital, status: &str, called_mins_ago: Option<i32>) -> Visit {
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id, \
                                 doctor_id) \
         VALUES ($1, $2, 'opd', 'in_progress', $3, $4) RETURNING id",
    )
    .bind(h.tenant)
    .bind(h.patient)
    .bind(h.department)
    .bind(h.doctor)
    .fetch_one(db)
    .await
    .unwrap();
    let queue: Uuid = sqlx::query_scalar(
        "INSERT INTO opd_queues (tenant_id, encounter_id, department_id, doctor_id, \
                                 token_number, status, called_at, updated_at) \
         VALUES ($1, $2, $3, $4, 1, $5::queue_status, \
                 now() - make_interval(mins => $6), now() - interval '2 hours') \
         RETURNING id",
    )
    .bind(h.tenant)
    .bind(encounter)
    .bind(h.department)
    .bind(h.doctor)
    .bind(status)
    .bind(called_mins_ago)
    .fetch_one(db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO tokens (tenant_id, module, number, seq, status, entity_type, entity_id) \
         VALUES ($1, 'opd', 'T-001', 1, 'serving', 'encounter', $2)",
    )
    .bind(h.tenant)
    .bind(encounter)
    .execute(db)
    .await
    .unwrap();
    let note: Uuid = sqlx::query_scalar(
        "INSERT INTO clinical_notes (tenant_id, patient_id, encounter_id, note_type_id, \
                                     author_id, author_role) \
         SELECT $1, $2, $3, id, $4, 'doctor' FROM note_types WHERE tenant_id = $1 LIMIT 1 \
         RETURNING id",
    )
    .bind(h.tenant)
    .bind(h.patient)
    .bind(encounter)
    .bind(h.doctor)
    .fetch_one(db)
    .await
    .unwrap();
    Visit {
        queue,
        encounter,
        note,
    }
}

/// The queue row's status, the visit's status and close reason, the token's
/// status, and the note's status and signature time.
async fn state_of(
    db: &PgPool,
    v: &Visit,
) -> (String, String, Option<String>, String, String, bool) {
    sqlx::query_as(
        "SELECT q.status::text, e.status::text, e.close_reason, t.status, n.status, \
                n.signed_at IS NOT NULL \
           FROM opd_queues q JOIN encounters e ON e.id = q.encounter_id \
           JOIN tokens t ON t.entity_id = e.id AND t.entity_type = 'encounter' \
           JOIN clinical_notes n ON n.id = $2 \
          WHERE q.id = $1",
    )
    .bind(v.queue)
    .bind(v.note)
    .fetch_one(db)
    .await
    .unwrap()
}

fn open(status: &str) -> (String, String, Option<String>, String, String, bool) {
    (
        status.to_owned(),
        "in_progress".to_owned(),
        None,
        "serving".to_owned(),
        "draft".to_owned(),
        false,
    )
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_started_visit_past_the_window_closes_like_the_doctor_closed_it() {
    let db = pool().await;
    let h = hospital(&db, Some(60)).await;
    let due = visit(&db, &h, "in_consultation", Some(61)).await;
    let called_due = visit(&db, &h, "called", Some(61)).await;
    let recent = visit(&db, &h, "in_consultation", Some(59)).await;
    let waiting = visit(&db, &h, "waiting", None).await;
    let other = hospital(&db, Some(60)).await;
    let other_due = visit(&db, &other, "in_consultation", Some(120)).await;
    let off = hospital(&db, None).await;
    let off_due = visit(&db, &off, "in_consultation", Some(120)).await;
    let zero = hospital(&db, Some(0)).await;
    let zero_due = visit(&db, &zero, "in_consultation", Some(120)).await;

    let closed = close_due_for_tenant(&db, h.tenant).await.unwrap();
    let mut ids: Vec<Uuid> = closed.iter().map(|c| c.queue.id).collect();
    ids.sort();
    let mut want = vec![due.queue, called_due.queue];
    want.sort();
    assert_eq!(
        ids, want,
        "only the two started visits past 60 minutes close"
    );
    assert!(
        closed.iter().all(|c| c.actor == h.doctor),
        "made in the doctor's name"
    );

    let done = (
        "completed".to_owned(),
        "completed".to_owned(),
        Some("auto_inactivity".to_owned()),
        "completed".to_owned(),
        "draft".to_owned(),
        false,
    );
    assert_eq!(
        state_of(&db, &due).await,
        done,
        "closed, token off the board, note a draft"
    );
    assert_eq!(state_of(&db, &called_due).await, done);
    assert_eq!(state_of(&db, &recent).await, open("in_consultation"));
    assert_eq!(state_of(&db, &waiting).await, open("waiting"));
    assert_eq!(
        state_of(&db, &other_due).await,
        open("in_consultation"),
        "other hospital"
    );

    let audit: (Option<Uuid>, serde_json::Value) = sqlx::query_as(
        "SELECT user_id, new_values FROM audit_log \
         WHERE tenant_id = $1 AND action = 'opd.visit.auto_closed' AND entity_id = $2",
    )
    .bind(h.tenant)
    .bind(due.encounter)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(audit.0, None, "the system, not a person");
    assert_eq!(audit.1["auto_close_after_minutes"], 60);
    assert_eq!(audit.1["queue_id"], due.queue.to_string());

    assert!(
        close_due_for_tenant(&db, h.tenant)
            .await
            .unwrap()
            .is_empty(),
        "nothing twice"
    );
    let audits: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 AND action = 'opd.visit.auto_closed'",
    )
    .bind(h.tenant)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(audits, 2);

    for (tenant, v) in [(off.tenant, &off_due), (zero.tenant, &zero_due)] {
        assert!(
            close_due_for_tenant(&db, tenant).await.unwrap().is_empty(),
            "setting off"
        );
        assert_eq!(state_of(&db, v).await, open("in_consultation"));
    }
}
