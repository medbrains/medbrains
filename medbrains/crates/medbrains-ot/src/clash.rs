//! Theatre double-booking: a room, a surgeon or an anaesthetist in two cases
//! at once.
//!
//! Times are compared as instants (`timestamptz` ranges, half-open), never by
//! `scheduled_date`, so a case that runs past midnight clashes with the next
//! morning's list, and a case ending at 10:00 does not clash with one
//! starting at 10:00. Every room and person in the slot is locked first, in
//! one sorted order, so two bookings racing for the same surgeon in
//! different theatres cannot both pass the check.

use chrono::{DateTime, Utc};
use medbrains_core::ot::OtBooking;
use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::UpdateBookingRequest;

/// A case's theatre, people and time, as it would be after the write.
#[derive(Debug)]
pub(crate) struct Slot {
    pub room: Uuid,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    /// Primary surgeon, anaesthetist and assistant surgeons, by user id.
    pub people: Vec<Uuid>,
    /// The booking being moved, so it does not clash with itself.
    pub exclude: Option<Uuid>,
}

/// The user ids in an `assistant_surgeons` JSON array. Entries that are not
/// user ids (free-text names) cannot be checked and are skipped.
pub(crate) fn assistant_ids(value: Option<&serde_json::Value>) -> Vec<Uuid> {
    value
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok()))
        .collect()
}

/// Refuse the slot if its room or any of its people is already in another
/// live case at an overlapping time; the message names who, where and when.
pub(crate) async fn refuse_clash(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    slot: &Slot,
) -> Result<(), AppError> {
    if slot.end <= slot.start {
        return Err(AppError::BadRequest(
            "The case must end after it starts; for a case past midnight, end it on the next day."
                .to_owned(),
        ));
    }
    lock(tx, slot).await?;
    first_clash(tx, tenant_id, slot)
        .await?
        .map_or(Ok(()), |message| Err(AppError::Conflict(message)))
}

/// Take a transaction lock on the room and on each person, in sorted key
/// order so two bookings never wait on each other's locks.
async fn lock(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, slot: &Slot) -> Result<(), AppError> {
    let mut keys: Vec<String> = slot
        .people
        .iter()
        .map(|p| format!("ot-person:{p}"))
        .collect();
    keys.push(format!("ot-room:{}", slot.room));
    keys.sort();
    keys.dedup();
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtextextended(k, 0)) \
         FROM unnest($1::text[]) WITH ORDINALITY AS t(k, n) ORDER BY n",
    )
    .bind(&keys)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The refusal for the first live case (not cancelled or postponed: a postponed
/// case keeps its old times but no longer holds them) that overlaps the slot in its room or
/// with one of its people, room clashes first; `None` when there is none.
async fn first_clash(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    slot: &Slot,
) -> Result<Option<String>, AppError> {
    let people: Vec<String> = slot.people.iter().map(Uuid::to_string).collect();
    let message = sqlx::query_scalar::<_, String>(
        "WITH tz AS (SELECT COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC') AS z), \
         hit AS ( \
           SELECT b.*, (b.ot_room_id = $2) AS same_room, \
                  CASE WHEN b.primary_surgeon_id = ANY($5::uuid[]) THEN b.primary_surgeon_id \
                       WHEN b.anesthetist_id = ANY($5::uuid[]) THEN b.anesthetist_id \
                       ELSE (SELECT a::uuid FROM jsonb_array_elements_text( \
                               CASE WHEN jsonb_typeof(b.assistant_surgeons) = 'array' \
                                    THEN b.assistant_surgeons ELSE '[]'::jsonb END) a \
                             WHERE a = ANY($6::text[]) LIMIT 1) END AS person \
           FROM ot_bookings b \
           WHERE b.tenant_id = $1 AND b.status NOT IN ('cancelled', 'postponed') AND b.deleted_at IS NULL \
             AND b.id IS DISTINCT FROM $7 \
             AND tstzrange(b.scheduled_start, b.scheduled_end) && tstzrange($3, $4) \
             AND (b.ot_room_id = $2 OR b.primary_surgeon_id = ANY($5::uuid[]) \
                  OR b.anesthetist_id = ANY($5::uuid[]) OR b.assistant_surgeons ?| $6::text[])) \
         SELECT CASE WHEN h.same_room THEN COALESCE(r.name, 'That theatre') || ' is already booked' \
                     ELSE COALESCE(u.full_name, 'A member of the team') || ' is already in ' \
                          || COALESCE(r.name, 'another theatre') END \
                || ' from ' || to_char(h.scheduled_start AT TIME ZONE tz.z, 'DD Mon HH24:MI') \
                || ' to ' || to_char(h.scheduled_end AT TIME ZONE tz.z, 'DD Mon HH24:MI') || '.' \
         FROM hit h CROSS JOIN tz \
         LEFT JOIN ot_rooms r ON r.id = h.ot_room_id AND r.tenant_id = h.tenant_id \
         LEFT JOIN users u ON u.id = h.person AND u.tenant_id = h.tenant_id \
         ORDER BY h.same_room DESC, h.scheduled_start LIMIT 1",
    )
    .bind(tenant_id)
    .bind(slot.room)
    .bind(slot.start)
    .bind(slot.end)
    .bind(&slot.people)
    .bind(&people)
    .bind(slot.exclude)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(message)
}

/// Refuse a reschedule, room change or anaesthetist change that would put
/// the room or one of the case's people in two cases at once.
pub(crate) async fn refuse_moved_clash(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
    body: &UpdateBookingRequest,
) -> Result<(), AppError> {
    let current = sqlx::query_as::<_, OtBooking>(
        "SELECT * FROM ot_bookings WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let mut people = vec![current.primary_surgeon_id];
    people.extend(body.anesthetist_id.or(current.anesthetist_id));
    people.extend(assistant_ids(Some(&current.assistant_surgeons)));
    let slot = Slot {
        room: body.ot_room_id.unwrap_or(current.ot_room_id),
        start: body.scheduled_start.unwrap_or(current.scheduled_start),
        end: body.scheduled_end.unwrap_or(current.scheduled_end),
        people,
        exclude: Some(id),
    };
    refuse_clash(tx, tenant_id, &slot).await
}
