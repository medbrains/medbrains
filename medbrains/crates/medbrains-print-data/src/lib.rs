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
pub mod pcpndt_form_f;
pub mod quality;
pub mod regulatory;
pub mod surgical;

use medbrains_server_core::error::AppError;

/// Print in the hospital's own zone, not the server's.
///
/// A death recorded at 01:30 IST is a death on the previous UTC day; a legal
/// document that prints it in UTC is five and a half hours and one date wrong.
/// The zone is the hospital's locale profile (`locale/timezone`, or its
/// country pack's only zone; RFC-WORLD-READY §2.3), never a default country.
/// Sets the transaction's `TimeZone` to it, so SQL-side `::date`, `::text` and
/// `to_char` read local time, and returns the zone's offset for timestamps
/// formatted in Rust. Transaction-local: it ends with the transaction and
/// never reaches the next borrower of the connection.
///
/// No zone in the profile, or an unknown zone name, fails the print rather
/// than falling back to UTC — a wrong time on a legal document is worse than
/// no document.
pub async fn set_print_timezone(
    conn: &mut sqlx::PgConnection,
    tenant_id: &uuid::Uuid,
) -> Result<chrono::FixedOffset, AppError> {
    let profile =
        medbrains_country::for_scope(&mut *conn, *tenant_id, medbrains_country::Scopes::default())
            .await
            .map_err(|e| match e {
                medbrains_country::CountryError::Db(e) => AppError::from(e),
                medbrains_country::CountryError::Pack(e) => AppError::Internal(e.to_string()),
            })?;
    let Some(zone) = profile
        .values
        .get("timezone")
        .and_then(serde_json::Value::as_str)
    else {
        return Err(AppError::BadRequest(
            "The hospital has no time zone yet; set it in Settings, Locale profile, before printing"
                .to_owned(),
        ));
    };
    // ponytail: one offset, taken now, for every timestamp on the page — exact
    // for zones without daylight saving (all tenants today). A DST tenant needs
    // a per-timestamp conversion (the server formatter, RFC §4.1).
    let offset_secs = sqlx::query_scalar!(
        r#"SELECT EXTRACT(EPOCH FROM (now() AT TIME ZONE z) - (now() AT TIME ZONE 'UTC'))::int
                  AS "offset!"
             FROM (SELECT set_config('TimeZone', $1, true) AS z) s"#,
        zone,
    )
    .fetch_one(conn)
    .await?;
    chrono::FixedOffset::east_opt(offset_secs)
        .ok_or_else(|| AppError::Internal(format!("timezone offset out of range: {offset_secs}s")))
}
