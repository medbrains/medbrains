//! Slot UUIDs and holds.
//!
//! UHI names a slot by a UUID, sent as the
//! fulfilment id and in the `@abdm/gov.in/slot_id` tag; `uhi_slot_ids` maps
//! each to the doctor, day and time it stands for, so a slot keeps its UUID
//! across searches. An `init` holds a slot for its transaction; a live hold
//! counts against the slot's capacity like a booking.

use std::collections::HashMap;

use chrono::{NaiveDate, NaiveTime};
use uuid::Uuid;

use super::slots::Slot;
use crate::error::AppError;

/// Give each slot its stable UUID: one upsert for the whole answer, so a
/// slot keeps its UUID across searches.
///
/// # Errors
/// A database fault.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn assign_ids(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    slots: &mut [Slot],
) -> Result<(), AppError> {
    let doctors: Vec<Uuid> = slots.iter().map(|s| s.doctor_id).collect();
    let dates: Vec<NaiveDate> = slots.iter().map(|s| s.date).collect();
    let starts: Vec<NaiveTime> = slots.iter().map(|s| s.start).collect();
    // allow-raw-sql: compile-checked, on the caller's tenant-scoped (RLS) transaction
    let rows = sqlx::query!(
        "INSERT INTO uhi_slot_ids (tenant_id, doctor_id, slot_date, slot_start) \
         SELECT $1, d, s, t FROM UNNEST($2::uuid[], $3::date[], $4::time[]) AS u(d, s, t) \
         ON CONFLICT (tenant_id, doctor_id, slot_date, slot_start) \
         DO UPDATE SET doctor_id = EXCLUDED.doctor_id \
         RETURNING id, doctor_id, slot_date, slot_start",
        tenant_id,
        &doctors,
        &dates,
        &starts,
    )
    .fetch_all(&mut **tx)
    .await?;
    let ids: HashMap<(Uuid, NaiveDate, NaiveTime), Uuid> = rows
        .into_iter()
        .map(|r| ((r.doctor_id, r.slot_date, r.slot_start), r.id))
        .collect();
    for slot in slots {
        if let Some(id) = ids.get(&(slot.doctor_id, slot.date, slot.start)) {
            slot.id = *id;
        }
    }
    Ok(())
}

/// Live holds per slot, other than `holder`'s own: an `init` takes a slot
/// for [`SLOT_HOLD_MINUTES`] until confirm books it or the hold runs out.
pub(super) async fn held(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    doctors: &[Uuid],
    (first, last): (NaiveDate, NaiveDate),
    holder: Option<Uuid>,
) -> Result<HashMap<(Uuid, NaiveDate, NaiveTime), i64>, AppError> {
    // allow-raw-sql: compile-checked, on the caller's tenant-scoped (RLS) transaction
    let rows = sqlx::query!(
        r#"SELECT s.doctor_id, s.slot_date, s.slot_start, count(*) AS "n!"
             FROM uhi_transactions t JOIN uhi_slot_ids s ON s.id = t.slot_id
            WHERE t.tenant_id = $1 AND t.state = 'initialised' AND t.appointment_id IS NULL
              AND t.deleted_at IS NULL
              AND t.slot_held_until > now() AND ($2::uuid IS NULL OR t.id <> $2)
              AND s.doctor_id = ANY($3) AND s.slot_date BETWEEN $4 AND $5
            GROUP BY 1, 2, 3"#,
        tenant_id,
        holder,
        doctors,
        first,
        last,
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| ((r.doctor_id, r.slot_date, r.slot_start), r.n))
        .collect())
}

/// How long `init` holds a slot for the patient — the consultation docs'
/// fifteen minutes.
pub const SLOT_HOLD_MINUTES: i32 = 15;

pub type SlotKey = (Uuid, NaiveDate, NaiveTime);

/// How much of a slot is gone: its bookings plus the live `init` holds on it.
pub fn taken_at(counts: [&HashMap<SlotKey, i64>; 2], key: SlotKey) -> i64 {
    counts.iter().filter_map(|m| m.get(&key)).sum()
}
