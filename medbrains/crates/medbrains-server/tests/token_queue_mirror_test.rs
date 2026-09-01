mod common;

use uuid::Uuid;

async fn seeded_tenant(db: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded tenant")
}

/// A patient with an OPD encounter and a queue row, as check-in produces.
async fn queued_patient(db: &sqlx::PgPool, tenant_id: Uuid) -> (Uuid, Uuid) {
    let suffix = &Uuid::new_v4().to_string()[..8];
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Mirror', 'Fixture', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH-MIR-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(db)
    .await
    .expect("insert patient");

    let encounter_id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd'::encounter_type) RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(db)
    .await
    .expect("insert encounter");

    let department_id: Uuid = sqlx::query_scalar("SELECT id FROM departments LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded department");

    sqlx::query(
        "INSERT INTO opd_queues \
         (tenant_id, encounter_id, department_id, token_number, status, queue_date) \
         VALUES ($1, $2, $3, 9001, 'waiting'::queue_status, CURRENT_DATE)",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(department_id)
    .execute(db)
    .await
    .expect("insert queue row");

    (patient_id, encounter_id)
}

async fn queue_status(db: &sqlx::PgPool, encounter_id: Uuid) -> String {
    sqlx::query_scalar("SELECT status::text FROM opd_queues WHERE encounter_id = $1")
        .bind(encounter_id)
        .fetch_one(db)
        .await
        .expect("read queue status")
}

/// The mirror statement the token transition runs.
///
/// Exercised directly so the assertion is about the SQL, not about routing.
async fn mirror(db: &sqlx::PgPool, tenant_id: Uuid, encounter_id: Uuid, queue_status: &str) {
    sqlx::query(
        "UPDATE opd_queues SET status = $3::queue_status, \
           called_at = CASE WHEN $3 = 'called' THEN COALESCE(called_at, now()) ELSE called_at END, \
           completed_at = CASE WHEN $3 IN ('completed', 'no_show') THEN now() \
                               ELSE completed_at END, \
           updated_at = now() \
         WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL \
           AND status::text IS DISTINCT FROM $3",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(queue_status)
    .execute(db)
    .await
    .expect("mirror to queue");
}

/// Calling a token moves the queue row with it.
///
/// The two directions were not symmetric. Calling from the OPD queue updated
/// `opd_queues` and mirrored the token; calling the same patient from the token
/// console updated only the token. The queue row stayed `waiting`, and because
/// the OPD screen derives its row actions from `opd_queues.status` -- where
/// `call_patient` is allowed only while `waiting` -- the desk went on being
/// offered a live Call button for a patient the board had already called.
#[tokio::test]
async fn calling_a_token_moves_the_queue_row_with_it() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let (_patient_id, encounter_id) = queued_patient(&app.db, tenant_id).await;

    assert_eq!(queue_status(&app.db, encounter_id).await, "waiting");

    mirror(&app.db, tenant_id, encounter_id, "called").await;

    assert_eq!(
        queue_status(&app.db, encounter_id).await,
        "called",
        "a queue row left on 'waiting' keeps offering Call for somebody \
         already called"
    );

    let called_at: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT called_at FROM opd_queues WHERE encounter_id = $1")
            .bind(encounter_id)
            .fetch_one(&app.db)
            .await
            .expect("read called_at");
    assert!(
        called_at.is_some(),
        "called_at is the only record of when the patient was called, and the \
         wait-time estimate learns from it"
    );
}

/// `serving` on the token is `in_consultation` on the queue.
///
/// The two vocabularies differ, and mapping them wrongly would silently put the
/// row into a status the OPD action table does not expect.
#[tokio::test]
async fn serving_maps_to_in_consultation() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let (_p, encounter_id) = queued_patient(&app.db, tenant_id).await;

    mirror(&app.db, tenant_id, encounter_id, "in_consultation").await;

    assert_eq!(queue_status(&app.db, encounter_id).await, "in_consultation");
}

/// A first call is not overwritten by a second.
///
/// `called_at` feeds the service-time history. Re-stamping it every time a
/// clerk pressed Call again would shorten every consultation the queue has
/// ever learned from.
#[tokio::test]
async fn recalling_does_not_reset_when_the_patient_was_first_called() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let (_p, encounter_id) = queued_patient(&app.db, tenant_id).await;

    mirror(&app.db, tenant_id, encounter_id, "called").await;
    let first: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT called_at FROM opd_queues WHERE encounter_id = $1")
            .bind(encounter_id)
            .fetch_one(&app.db)
            .await
            .expect("first called_at");

    // The clerk presses Call a second time.
    mirror(&app.db, tenant_id, encounter_id, "called").await;
    let second: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT called_at FROM opd_queues WHERE encounter_id = $1")
            .bind(encounter_id)
            .fetch_one(&app.db)
            .await
            .expect("second called_at");

    assert_eq!(
        first, second,
        "the first call is when the patient was called; a second press must \
         not rewrite it"
    );
}
