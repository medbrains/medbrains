//! One number: the paper register's number is the UHID (policy mode `uhid`).
//!
//! A hospital that keeps a paper register wants one number per patient, not
//! an automatic UHID beside a typed OPD number. In this mode the desk types
//! the register number and it becomes the UHID, with the UHID series' next
//! value filled in. The series row (`sequences`, `UHID`) is locked for the
//! rest of the transaction, the same row lock automatic registration takes,
//! so typed and automatic UHIDs are one queue: two desks typing one number
//! get one success and one refusal. A typed number above the series moves it
//! up (so the next automatic or suggested number stays ahead); an old, lower
//! number never moves it back.

use super::{MAX_DIGITS, max_number};
use medbrains_server_core::error::AppError;
use sqlx::PgConnection;
use uuid::Uuid;

/// The UHID series as registration formats it.
struct Series {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

impl Series {
    /// `n` as a UHID of this series: prefix, then the number padded.
    fn format(&self, n: i64) -> String {
        let pad = usize::try_from(self.pad_width).unwrap_or(0);
        format!("{}{n:0>pad$}", self.prefix)
    }
}

/// The register number the desk typed: digits only, at least 1. Leading
/// zeros are dropped, so "007" and "7" are one number.
///
/// # Errors
/// [`AppError::BadRequest`] for anything but a positive whole number.
pub fn parse_register_number(typed: &str) -> Result<i64, AppError> {
    let digits = typed.trim();
    let refused = || AppError::BadRequest("UHID / register no.: digits only, like 1043".into());
    if digits.is_empty() || digits.len() > MAX_DIGITS || !digits.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(refused());
    }
    digits
        .parse::<i64>()
        .ok()
        .filter(|n| (1..=max_number()).contains(n))
        .ok_or_else(refused)
}

/// The series row, read; locked to the end of the transaction when `lock`.
async fn series(conn: &mut PgConnection, tenant_id: Uuid, lock: bool) -> Result<Series, AppError> {
    let row = if lock {
        sqlx::query_as!(
            Series,
            "SELECT current_val, prefix, pad_width FROM sequences \
             WHERE tenant_id = $1 AND seq_type = 'UHID' FOR UPDATE",
            tenant_id
        )
        .fetch_optional(&mut *conn)
        .await?
    } else {
        sqlx::query_as!(
            Series,
            "SELECT current_val, prefix, pad_width FROM sequences \
             WHERE tenant_id = $1 AND seq_type = 'UHID'",
            tenant_id
        )
        .fetch_optional(&mut *conn)
        .await?
    };
    row.ok_or_else(|| AppError::Internal("UHID sequence not configured for this tenant".into()))
}

/// The UHID series' prefix, for refusing this mode over a prefixed series.
///
/// # Errors
/// A database failure, or no UHID series.
pub async fn series_prefix(conn: &mut PgConnection, tenant_id: Uuid) -> Result<String, AppError> {
    Ok(series(conn, tenant_id, false).await?.prefix)
}

/// The last UHID the series gave (`None` before the first) and the next, as
/// the registration form shows them beside the field.
///
/// # Errors
/// A database failure, or no UHID series.
pub async fn suggest_uhid(
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<(Option<String>, String), AppError> {
    let s = series(conn, tenant_id, false).await?;
    let previous = (s.current_val > 0).then(|| s.format(s.current_val));
    Ok((previous, s.format(s.current_val + 1)))
}

/// Take the register number the desk typed as the new patient's UHID.
///
/// Under the series row lock: refuse a number in use, naming its UHID and the
/// day it was registered (never the patient's name) and the next free one;
/// then move the series up to the number when it is higher, never down.
///
/// # Errors
/// [`AppError::BadRequest`] for a malformed number, [`AppError::Conflict`]
/// for one in use, or a database failure.
pub async fn take_typed_uhid(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    typed: &str,
) -> Result<String, AppError> {
    let number = parse_register_number(typed)?;
    let s = series(conn, tenant_id, true).await?;
    let uhid = s.format(number);
    let used_on = sqlx::query_scalar!(
        r#"SELECT COALESCE(opd_date, created_at::date) AS "used_on!" FROM patients
            WHERE tenant_id = $1 AND uhid = $2 LIMIT 1"#,
        tenant_id,
        uhid
    )
    .fetch_optional(&mut *conn)
    .await?;
    if let Some(used_on) = used_on {
        return Err(AppError::Conflict(format!(
            "UHID {uhid} is already used, registered on {}. Next free number: {}",
            used_on.format("%d %b %Y"),
            s.format(s.current_val + 1)
        )));
    }
    sqlx::query!(
        "UPDATE sequences SET current_val = GREATEST(current_val, $2) \
         WHERE tenant_id = $1 AND seq_type = 'UHID'",
        tenant_id,
        number
    )
    .execute(&mut *conn)
    .await?;
    Ok(uhid)
}

#[cfg(test)]
mod tests {
    use super::parse_register_number;

    #[test]
    fn a_register_number_is_digits_only() {
        assert_eq!(parse_register_number(" 007 ").ok(), Some(7));
        assert_eq!(parse_register_number("1043").ok(), Some(1043));
        for bad in [
            "",
            "0",
            "-3",
            "1.5",
            "12a",
            "MB-123456",
            "UHID-1",
            "1234567890123",
        ] {
            assert!(
                parse_register_number(bad).is_err(),
                "{bad:?} should be refused"
            );
        }
    }
}
