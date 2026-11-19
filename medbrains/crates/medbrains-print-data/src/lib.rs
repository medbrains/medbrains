//! Print-data crate — read-only endpoints that assemble print/PDF payloads.
//! Foundation coupling (server-core + medbrains-core::print_data types); clinical
//! adds `authz_patient` + events (workflow); several use the `signed_documents` helper.

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

mod zone;
pub use zone::{PrintOffset, PrintZone};

/// Print in the zone of whoever prints, as their screens show it.
///
/// A death recorded at 01:30 IST is a death on the previous UTC day; a legal
/// document that prints it in UTC is five and a half hours and one date wrong.
/// The zone is the locale profile resolved for `user` (their facility's zone,
/// else the hospital's, else the country pack's only zone; RFC-WORLD-READY
/// §2.3), so a print matches the screen it was printed from. Documents do not
/// carry a facility of their own yet: the printing user's facility stands for
/// it, and with no user the hospital's zone is used.
///
/// Sets the transaction's `TimeZone` to it, so SQL-side `::date`, `::text` and
/// `to_char` read local time with Postgres' daylight-saving rules, and returns
/// a [`PrintZone`] that gives each Rust-formatted timestamp its own offset.
/// Transaction-local: it never reaches the next borrower of the connection.
///
/// No zone anywhere fails the print rather than falling back to UTC — a wrong
/// time on a legal document is worse than no document.
pub async fn set_print_timezone(
    conn: &mut sqlx::PgConnection,
    tenant_id: &uuid::Uuid,
    user: Option<uuid::Uuid>,
) -> Result<PrintZone, AppError> {
    let scopes = medbrains_country::Scopes {
        user,
        facility: None,
        facility_of_user: user.is_some(),
    };
    let profile = medbrains_country::for_scope(&mut *conn, *tenant_id, scopes)
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
    sqlx::query_scalar!(
        r#"SELECT set_config('TimeZone', $1, true) AS "zone!""#,
        zone
    )
    .fetch_one(&mut *conn)
    .await?;
    zone::load(conn, zone).await
}
