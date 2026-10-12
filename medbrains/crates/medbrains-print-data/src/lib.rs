//! Print-data crate — read-only endpoints that assemble print/PDF payloads.
//! Foundation coupling (server-core + medbrains-core::print_data types); clinical
//! adds authz_patient + events (workflow); several use the signed_documents helper.

pub mod academic;
pub mod admin;
pub mod billing;
pub mod bme;
pub mod clinical;
pub mod consent;
pub mod general;
pub mod gst_invoice;
pub mod hr;
pub mod medicolegal;
pub mod mrd;
pub mod quality;
pub mod regulatory;
pub mod surgical;

use medbrains_server_core::error::AppError;

/// Print in the hospital's own zone, not the server's.
///
/// A death recorded at 01:30 IST is a death on the previous UTC day; a legal
/// document that prints it in UTC is five and a half hours and one date wrong.
/// Sets the transaction's `TimeZone` to `tenants.timezone`, so SQL-side
/// `::date`, `::text` and `to_char` read local time, and returns the zone's
/// offset for timestamps formatted in Rust. Transaction-local: it ends with the
/// transaction and never reaches the next borrower of the connection.
///
/// An unknown zone name fails the print rather than falling back to UTC — a
/// wrong time on a legal document is worse than no document.
pub async fn set_print_timezone(
    conn: &mut sqlx::PgConnection,
    tenant_id: &uuid::Uuid,
) -> Result<chrono::FixedOffset, AppError> {
    // ponytail: one offset, taken now, for every timestamp on the page — exact
    // for zones without daylight saving (all tenants today). A DST tenant needs
    // chrono-tz and a per-timestamp conversion.
    let (_, offset_secs): (String, i32) = sqlx::query_as(
        "SELECT set_config('TimeZone', z.tz, true), \
           EXTRACT(EPOCH FROM (now() AT TIME ZONE z.tz) - (now() AT TIME ZONE 'UTC'))::int \
         FROM (SELECT COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC') AS tz) z",
    )
    .bind(tenant_id)
    .fetch_one(conn)
    .await?;
    chrono::FixedOffset::east_opt(offset_secs)
        .ok_or_else(|| AppError::Internal(format!("timezone offset out of range: {offset_secs}s")))
}
