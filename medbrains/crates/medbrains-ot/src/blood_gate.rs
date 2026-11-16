//! The theatre "blood arranged" gate.
//!
//! Blood is arranged when the blood bank has a compatible crossmatch for this
//! patient that will still be valid when the operation starts (NABH
//! transfusion safety; D&C Part XII-B; the 72-hour sample rule the bank's own
//! issue gate applies).
//!
//! It reads `crossmatch_requests` and `blood_components`, the tables the
//! blood bank writes. The gate it replaces read `blood_requests`, which no
//! code writes, so it refused every real patient (#5962).

use chrono::{DateTime, Utc};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// The refusal the theatre screen shows when no crossmatch covers the case.
pub const NO_CROSSMATCH: &str = "Cannot mark blood arranged: the blood bank has no \
     compatible crossmatch for this patient that is still valid at the scheduled start. A \
     crossmatch holds for 72 hours. Send a fresh sample to the blood bank for crossmatch first.";

/// Why blood cannot be marked arranged for this booking, or `None` when it can.
///
/// Passes only on a crossmatch the bank marked `compatible`, tested no more
/// than 72 hours before the later of now and the scheduled start, and, when
/// the bank tied a unit to it, that unit still usable and in date at the
/// start. `scheduled_start` is the start the same request is moving the case
/// to, if any. A request still `requested` or `testing` is not blood arranged.
pub async fn blood_arranged_gap(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    booking_id: Uuid,
    scheduled_start: Option<DateTime<Utc>>,
) -> Result<Option<&'static str>, AppError> {
    let covered = sqlx::query_scalar!(
        r#"SELECT EXISTS (
             SELECT 1 FROM crossmatch_requests xm
             LEFT JOIN blood_components bc
               ON bc.id = xm.component_id AND bc.tenant_id = xm.tenant_id
              WHERE xm.tenant_id = b.tenant_id AND xm.patient_id = b.patient_id
                AND xm.status = 'compatible' AND xm.deleted_at IS NULL
                AND xm.tested_at >= GREATEST(now(), COALESCE($3, b.scheduled_start))
                                    - interval '72 hours'
                AND (xm.component_id IS NULL OR (
                     bc.deleted_at IS NULL
                     AND bc.status IN ('available', 'reserved', 'crossmatched', 'issued')
                     AND bc.expiry_at > GREATEST(now(), COALESCE($3, b.scheduled_start))))
           ) AS "covered!"
           FROM ot_bookings b
          WHERE b.id = $1 AND b.tenant_id = $2"#,
        booking_id,
        tenant_id,
        scheduled_start,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok((!covered).then_some(NO_CROSSMATCH))
}
