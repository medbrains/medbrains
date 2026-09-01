mod common;

use uuid::Uuid;

/// A camp participant sent into a consultation must appear on the board.
///
/// `find_or_create_camp_encounter` wrote an `opd_queues` row and a token
/// *number*, and stopped there. No board reads `opd_queues` — the
/// waiting-room displays, the front-office console and the doctor's worklist
/// all read `tokens`, and the call announcement fires from
/// `tokens::transition`. So a camp patient held a slip with a number that no
/// display could ever show, and was never called over the speaker.
///
/// OPD walk-in registration and appointment check-in both issue a token.
/// This path was the one left out, which is the worst place for it: a camp
/// is one afternoon, in one room, for people who travelled to get there.
#[tokio::test]
async fn a_camp_participant_routed_to_a_consultation_reaches_the_board() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    // Pick a tenant that actually has departments. `SELECT id FROM tenants
    // LIMIT 1` is unordered, and this database carries an isolation-probe
    // tenant with none — so the fixture failed on RowNotFound roughly whenever
    // the planner handed back that row, which reads as a broken camp path
    // rather than a broken fixture.
    let (tenant_id, department_id): (Uuid, Uuid) = sqlx::query_as(
        "SELECT d.tenant_id, d.id FROM departments d \
          WHERE d.deleted_at IS NULL AND d.is_active \
          ORDER BY d.created_at LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("a tenant with at least one active department");

    let suffix = &Uuid::new_v4().to_string()[..8];
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Camp', 'Participant', 'other'::gender, '9876500000') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH-CAMP-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    let camp_id: Uuid = sqlx::query_scalar(
        "INSERT INTO camps (tenant_id, camp_code, name, camp_type, scheduled_date, \
                            organizing_department_id) \
         VALUES ($1, $2, 'Token Board Camp', 'general_health'::camp_type, CURRENT_DATE, $3) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("CAMP-{suffix}"))
    .bind(department_id)
    .fetch_one(&app.db)
    .await
    .expect("insert camp");

    let registration_id: Uuid = sqlx::query_scalar(
        "INSERT INTO camp_registrations \
           (tenant_id, camp_id, registration_number, person_name, patient_id) \
         VALUES ($1, $2, $3, 'Camp Participant', $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(format!("REG-{suffix}"))
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("insert registration");

    let res = app
        .client
        .post(app.url(&format!(
            "/api/camp/registrations/{registration_id}/open-encounter"
        )))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "department_id": department_id }))
        .send()
        .await
        .expect("open encounter");
    assert!(
        res.status().is_success(),
        "open-encounter rejected: {:?}",
        res.status()
    );

    // The queue row the camp keeps for itself.
    let queued: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM opd_queues q \
           JOIN encounters e ON e.id = q.encounter_id \
          WHERE e.patient_id = $1 AND q.queue_date = CURRENT_DATE",
    )
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("count opd_queues");
    assert_eq!(queued, 1, "the camp's own queue row must still be written");

    // The row every board actually reads.
    let tokens: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tokens \
          WHERE tenant_id = $1 AND patient_id = $2 AND module = 'opd' \
            AND token_date = CURRENT_DATE",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("count tokens");
    assert_eq!(
        tokens, 1,
        "without a tokens row the participant is on no display and is never \
         announced — the whole defect this covers"
    );

    // And the board endpoint returns them, which is the thing the waiting
    // room is actually looking at.
    let board: Vec<serde_json::Value> = app
        .client
        .get(app.url(&format!(
            "/api/tokens/board?module=opd&scope=department&scope_id={department_id}"
        )))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("board")
        .json()
        .await
        .expect("board json");
    assert!(
        board
            .iter()
            .any(|row| row["patient_id"].as_str() == Some(&patient_id.to_string())),
        "the participant must appear on the department board"
    );
}
