//! Theatre clashes against a real schema.
#![allow(clippy::expect_used)]

use chrono::{DateTime, Utc};
use medbrains_db_migrations::testing::{add_patient, add_tenant, fresh_db};
use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

use super::clash::{Slot, refuse_clash};

/// A tenant with two theatres, two surgeons and an anaesthetist, and one
/// booked case: Dr Asha Varma in Theatre 2 on 1 Dec, 10:00 to 12:30 UTC.
struct World {
    owner: PgPool,
    tenant: Uuid,
    theatre_1: Uuid,
    theatre_2: Uuid,
    varma: Uuid,
    rao: Uuid,
    anaesthetist: Uuid,
    _db: medbrains_db_migrations::testing::TestDb,
}

/// An instant on December 2026, "DD HH:MM" in UTC.
fn at(day_time: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-12-{day_time}:00Z"))
        .expect("time")
        .with_timezone(&Utc)
}

/// Insert one row with triggers off, so dangling references are allowed.
async fn insert(owner: &PgPool, sql: &str, ids: &[Uuid]) -> Uuid {
    let mut conn = owner.acquire().await.expect("conn");
    sqlx::query("SET session_replication_role = replica")
        .execute(&mut *conn)
        .await
        .expect("triggers off");
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for id in ids {
        q = q.bind(*id);
    }
    q.fetch_one(&mut *conn).await.expect(sql)
}

/// A user named `name` in `tenant`.
async fn user(owner: &PgPool, tenant: Uuid, name: &str) -> Uuid {
    let sql = format!(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, 'u' || left(md5(random()::text), 12), md5(random()::text) || '@example.test', '{name}', \
                 'doctor') RETURNING id"
    );
    insert(owner, &sql, &[tenant]).await
}

/// A theatre named `name` in `tenant`.
async fn room(owner: &PgPool, tenant: Uuid, name: &str) -> Uuid {
    let sql = format!(
        "INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, '{name}', '{name}') RETURNING id"
    );
    insert(owner, &sql, &[tenant]).await
}

/// The world above, freshly migrated.
async fn world() -> World {
    let db = fresh_db().await.expect("test database");
    let owner = db.owner().await.expect("owner pool");
    let tenant = add_tenant(&owner, "OTCLASH").await.expect("tenant");
    // Messages give times in the hospital's zone; UTC keeps them readable here.
    sqlx::query("UPDATE tenants SET timezone = 'UTC' WHERE id = $1")
        .bind(tenant)
        .execute(&owner)
        .await
        .expect("timezone");
    let patient = add_patient(&owner, tenant, "UH-OT-1")
        .await
        .expect("patient");
    let theatre_1 = room(&owner, tenant, "Theatre 1").await;
    let theatre_2 = room(&owner, tenant, "Theatre 2").await;
    let varma = user(&owner, tenant, "Dr Asha Varma").await;
    let rao = user(&owner, tenant, "Dr Kiran Rao").await;
    let anaesthetist = user(&owner, tenant, "Dr Meera Iyer").await;
    insert(
        &owner,
        "INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
             anesthetist_id, scheduled_date, scheduled_start, scheduled_end, procedure_name) \
         VALUES ($1, $2, $3, $4, $5, '2026-12-01', '2026-12-01T10:00Z', '2026-12-01T12:30Z', \
                 'Laparoscopic cholecystectomy') RETURNING id",
        &[tenant, patient, theatre_2, varma, anaesthetist],
    )
    .await;
    World {
        owner,
        tenant,
        theatre_1,
        theatre_2,
        varma,
        rao,
        anaesthetist,
        _db: db,
    }
}

/// Check a slot in `room` with `people` from `start` to `end`.
async fn check(
    w: &World,
    room: Uuid,
    people: Vec<Uuid>,
    span: (&str, &str),
) -> Result<(), AppError> {
    let slot = Slot {
        room,
        start: at(span.0),
        end: at(span.1),
        people,
        exclude: None,
    };
    let mut tx = w.owner.begin().await.expect("tx");
    refuse_clash(&mut tx, w.tenant, &slot).await
}

/// The refusal message, or a note that the slot was accepted.
fn refusal(r: Result<(), AppError>) -> String {
    match r {
        Err(AppError::Conflict(m)) => m,
        other => format!("accepted or other: {other:?}"),
    }
}

#[tokio::test]
async fn the_same_surgeon_in_another_theatre_is_refused() {
    let w = world().await;
    let r = check(&w, w.theatre_1, vec![w.varma], ("01T11:00", "01T13:00")).await;
    assert_eq!(
        refusal(r),
        "Dr Asha Varma is already in Theatre 2 from 01 Dec 10:00 to 01 Dec 12:30."
    );
}

#[tokio::test]
async fn the_same_anaesthetist_in_another_theatre_is_refused() {
    let w = world().await;
    let r = check(
        &w,
        w.theatre_1,
        vec![w.rao, w.anaesthetist],
        ("01T12:00", "01T13:00"),
    )
    .await;
    let message = refusal(r);
    assert!(
        message.starts_with("Dr Meera Iyer is already in Theatre 2"),
        "{message}"
    );
}

#[tokio::test]
async fn back_to_back_cases_are_allowed() {
    let w = world().await;
    let after = check(&w, w.theatre_2, vec![w.varma], ("01T12:30", "01T14:00")).await;
    let before = check(&w, w.theatre_2, vec![w.varma], ("01T08:00", "01T10:00")).await;
    assert!(after.is_ok() && before.is_ok(), "{after:?} {before:?}");
}

#[tokio::test]
async fn a_case_past_midnight_clashes_with_the_next_morning() {
    let w = world().await;
    // Dr Rao: Theatre 1 from 23:00 on the 1st to 01:30 on the 2nd.
    insert(
        &w.owner,
        "INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
             scheduled_date, scheduled_start, scheduled_end, procedure_name) \
         VALUES ($1, gen_random_uuid(), $2, $3, '2026-12-01', '2026-12-01T23:00Z', \
                 '2026-12-02T01:30Z', 'Emergency laparotomy') RETURNING id",
        &[w.tenant, w.theatre_1, w.rao],
    )
    .await;
    let room = check(&w, w.theatre_1, vec![w.varma], ("02T01:00", "02T02:00")).await;
    let surgeon = check(&w, w.theatre_2, vec![w.rao], ("02T00:30", "02T02:00")).await;
    let (room, surgeon) = (refusal(room), refusal(surgeon));
    assert_eq!(
        room,
        "Theatre 1 is already booked from 01 Dec 23:00 to 02 Dec 01:30."
    );
    assert!(
        surgeon.starts_with("Dr Kiran Rao is already in Theatre 1"),
        "{surgeon}"
    );
}

#[tokio::test]
async fn a_case_that_ends_before_it_starts_is_refused() {
    let w = world().await;
    let r = check(&w, w.theatre_1, vec![w.rao], ("01T23:00", "01T01:30")).await;
    assert!(matches!(r, Err(AppError::BadRequest(_))), "{r:?}");
}

/// Set the seeded case to `status`, then book Dr Varma over its old slot.
async fn book_over_a_case_now(w: &World, status: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE ot_bookings SET status = $2::ot_booking_status WHERE tenant_id = $1")
        .bind(w.tenant)
        .bind(status)
        .execute(&w.owner)
        .await
        .expect("status");
    check(w, w.theatre_2, vec![w.varma], ("01T11:00", "01T12:00")).await
}

#[tokio::test]
async fn a_postponed_or_cancelled_case_frees_its_slot() {
    let w = world().await;
    let postponed = book_over_a_case_now(&w, "postponed").await;
    let cancelled = book_over_a_case_now(&w, "cancelled").await;
    assert!(
        postponed.is_ok() && cancelled.is_ok(),
        "{postponed:?} {cancelled:?}"
    );
}
