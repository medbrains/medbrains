//! Bed state changes shared by the modules that own a step of a bed's cycle.

use sqlx::PgConnection;
use uuid::Uuid;

/// Make a cleaned bed available again.
///
/// Both turnaround records -- IPD's `bed_turnaround_log` and housekeeping's
/// `room_turnarounds` -- were marked complete without touching `bed_states`,
/// so a bed cleaned and signed off still showed as dirty and could not be
/// allocated. Only a bed still waiting on cleaning is released: one already
/// re-occupied, reserved or taken out of service keeps its status.
///
/// Returns whether a bed was released.
pub async fn release_cleaned_bed(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    bed_id: Uuid,
    cleaned_by: Uuid,
) -> Result<bool, sqlx::Error> {
    let released = sqlx::query(
        "UPDATE bed_states SET \
           status = 'vacant_clean'::bed_status, \
           cleaning_completed_at = NOW(), \
           changed_by = $3, \
           reason = 'Turnaround complete', \
           changed_at = NOW() \
         WHERE location_id = $1 AND tenant_id = $2 \
           AND status = 'vacant_dirty'::bed_status AND admission_id IS NULL",
    )
    .bind(bed_id)
    .bind(tenant_id)
    .bind(cleaned_by)
    .execute(conn)
    .await?;
    Ok(released.rows_affected() > 0)
}
