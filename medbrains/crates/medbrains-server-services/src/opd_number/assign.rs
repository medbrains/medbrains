//! Giving and correcting an OPD number, under the hospital's lock.

use super::{Mode, Policy, Scope, read_policy, suggest};
use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use medbrains_server_core::hospital_time::tenant_local_today;
use sqlx::PgConnection;
use uuid::Uuid;

/// What an OPD number is being given to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Target {
    Patient(Uuid),
    Visit(Uuid),
}

/// What the desk entered with the number.
#[derive(Debug, Clone, Copy, Default)]
pub struct Entry<'a> {
    /// The number typed; `None` takes the suggestion.
    pub typed: Option<&'a str>,
    /// The per-patient OPD date; `None` is today (or, correcting, unchanged).
    pub opd_date: Option<NaiveDate>,
    /// Whether the caller holds `patients.opd_number.backdate`.
    pub may_backdate: bool,
}

/// What was numbered: the target, the number, and the OPD date per patient.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Assigned {
    pub target: Target,
    pub number: String,
    pub opd_date: Option<NaiveDate>,
}

/// The OPD date to store: today when none is given, never the future, and
/// before today only when the hospital allows it and the caller may.
///
/// # Errors
/// [`AppError::BadRequest`] for a future date or backdating switched off,
/// [`AppError::Forbidden`] for a caller who may not backdate.
pub fn check_date(
    policy: &Policy,
    entry: &Entry<'_>,
    today: NaiveDate,
) -> Result<NaiveDate, AppError> {
    let date = entry.opd_date.unwrap_or(today);
    if date > today {
        return Err(AppError::BadRequest(
            "The OPD date cannot be in the future".into(),
        ));
    }
    if date < today && !policy.allow_backdate {
        return Err(AppError::BadRequest(
            "This hospital does not allow an earlier OPD date".into(),
        ));
    }
    if date < today && !entry.may_backdate {
        return Err(AppError::Forbidden);
    }
    Ok(date)
}

/// Give a patient or a visit its OPD number when the hospital keeps one.
///
/// The number the desk typed (manual; nothing when it typed none, never a silent
/// number), or the next one (auto). Per visit it goes on the visit
/// (`encounter_id`); per patient on the patient, with its OPD date, once: at
/// registration, or at the first visit of a patient registered before the
/// hospital turned it on. `None` when nothing was written.
///
/// # Errors
/// [`AppError::BadRequest`] for a malformed number or date,
/// [`AppError::Forbidden`] for a backdate the caller may not make,
/// [`AppError::Conflict`] for a number in use, or a database failure.
pub async fn assign(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    (patient_id, encounter_id): (Uuid, Option<Uuid>),
    entry: Entry<'_>,
) -> Result<Option<Assigned>, AppError> {
    let policy = read_policy(conn, tenant_id).await?;
    let target = match (policy.mode, policy.scope, encounter_id) {
        (Mode::Off, _, _) | (_, Scope::Visit, None) => return Ok(None),
        (_, Scope::Visit, Some(id)) => Target::Visit(id),
        (_, Scope::Patient, _) => {
            lock(conn, tenant_id).await?;
            if patient_number(conn, tenant_id, patient_id).await?.is_some() {
                return Ok(None);
            }
            Target::Patient(patient_id)
        }
    };
    let manual = policy.mode == Mode::Manual;
    let typed = entry
        .typed
        .map(str::trim)
        .filter(|t| !t.is_empty() && manual);
    // Manual means the desk types it: nothing typed, nothing given, so a
    // patient registered before the hospital turned it on is asked at the desk.
    if manual && typed.is_none() {
        return Ok(None);
    }
    let today = tenant_local_today(&mut *conn, tenant_id).await?;
    let opd_date = match target {
        Target::Patient(_) => Some(check_date(&policy, &entry, today)?),
        Target::Visit(_) => None,
    };
    let number = set_number(conn, tenant_id, &policy, target, (typed, opd_date)).await?;
    Ok(Some(Assigned {
        target,
        number,
        opd_date,
    }))
}

/// The patient's OPD number, if they have one.
///
/// # Errors
/// A database failure.
pub async fn patient_number(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<String>, AppError> {
    let number = sqlx::query_scalar!(
        "SELECT opd_number FROM patients WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        patient_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    Ok(number.flatten())
}

/// The hospital's OPD number lock, held to the end of the transaction, so the
/// check that a number is free and its write are one step. Re-entrant.
async fn lock(conn: &mut PgConnection, tenant_id: Uuid) -> Result<(), AppError> {
    sqlx::query!(
        "SELECT pg_advisory_xact_lock(hashtextextended('opd_number:' || ($1::uuid)::text, 0))",
        tenant_id
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Under the hospital's lock: pick the number, refuse one in use, write it
/// (and, per patient, the OPD date when one is given).
async fn set_number(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    policy: &Policy,
    target: Target,
    (typed, opd_date): (Option<&str>, Option<NaiveDate>),
) -> Result<String, AppError> {
    let number = typed.map(|t| policy.parse(t)).transpose()?;
    lock(conn, tenant_id).await?;
    let number = match number {
        Some(n) => n,
        None => suggest(conn, tenant_id, policy).await?.next,
    };
    let own_id = match target {
        Target::Patient(id) | Target::Visit(id) => id,
    };
    refuse_if_used(conn, tenant_id, policy, number, own_id).await?;
    let formatted = policy.format(number);
    let updated = match target {
        Target::Patient(id) => {
            sqlx::query!(
                "UPDATE patients SET opd_number = $3, opd_date = COALESCE($4, opd_date), \
                    updated_at = now() \
             WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
                tenant_id,
                id,
                formatted,
                opd_date
            )
            .execute(&mut *conn)
            .await?
        }
        Target::Visit(id) => {
            sqlx::query!(
                "UPDATE encounters SET encounter_number = $3, updated_at = now() \
             WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
                tenant_id,
                id,
                formatted
            )
            .execute(&mut *conn)
            .await?
        }
    };
    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(formatted)
}

/// Refuse `number` when another patient or visit holds it, naming the UHID and
/// the date of that use (never the other patient's name) and the next free one.
async fn refuse_if_used(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    policy: &Policy,
    number: i64,
    own_id: Uuid,
) -> Result<(), AppError> {
    let used = sqlx::query!(
        r#"SELECT uhid AS "uhid!", used_on AS "used_on!" FROM (
             SELECT p.uhid, p.created_at::date AS used_on, p.id AS row_id FROM patients p
              WHERE p.tenant_id = $1 AND p.opd_number IS NOT NULL AND p.deleted_at IS NULL
                AND (substring(p.opd_number FROM '([0-9]+)$'))::bigint = $2
             UNION ALL
             SELECT p.uhid, e.encounter_date, e.id FROM encounters e
               JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id
              WHERE e.tenant_id = $1 AND e.encounter_number IS NOT NULL AND e.deleted_at IS NULL
                AND (substring(e.encounter_number FROM '([0-9]+)$'))::bigint = $2
           ) used WHERE row_id <> $3 LIMIT 1"#,
        tenant_id,
        number,
        own_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    let Some(used) = used else { return Ok(()) };
    let next = suggest(conn, tenant_id, policy).await?.next;
    Err(AppError::Conflict(format!(
        "OPD number {} is already used by UHID {} on {}. Next free number: {}",
        policy.format(number),
        used.uhid,
        used.used_on.format("%d %b %Y"),
        policy.format(next)
    )))
}

#[cfg(test)]
mod tests {
    use super::{Entry, Policy, check_date};
    use chrono::NaiveDate;

    #[test]
    fn the_opd_date_is_today_never_future_and_earlier_only_when_allowed() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 20).unwrap_or_default();
        let past = NaiveDate::from_ymd_opt(2019, 3, 4).unwrap_or_default();
        let allowed = Policy {
            allow_backdate: true,
            ..Policy::default()
        };
        let may = Entry {
            opd_date: Some(past),
            may_backdate: true,
            ..Entry::default()
        };
        assert_eq!(
            check_date(&allowed, &Entry::default(), today).ok(),
            Some(today)
        );
        assert_eq!(check_date(&allowed, &may, today).ok(), Some(past));
        assert!(check_date(&Policy::default(), &may, today).is_err());
        let may_not = Entry {
            may_backdate: false,
            ..may
        };
        assert!(check_date(&allowed, &may_not, today).is_err());
        let future = Entry {
            opd_date: today.succ_opt(),
            ..may
        };
        assert!(check_date(&allowed, &future, today).is_err());
    }
}
