//! The datasets a study may ask for, and how each is read.
//!
//! Every read takes only what [`super::deid`] needs: the patient's id (to
//! key and count, never released), birth date, sex and pincode, the event's
//! date and the dataset's coded fields. No name, contact, identifier or free
//! text is selected, so none can leak through a later change to the release.

use chrono::NaiveDate;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::deid::{Field, Kind, RawRow};

/// Rows read at most; a larger extract must narrow its period.
pub const MAX_ROWS: usize = 100_000;

const VISITS: &[Field] = &[
    Field {
        name: "encounter_type",
        kind: Kind::Category,
        description: "OPD, IPD, emergency or home health",
    },
    Field {
        name: "visit_type",
        kind: Kind::Category,
        description: "New, follow-up and similar, as recorded",
    },
    Field {
        name: "department",
        kind: Kind::Category,
        description: "Department of the visit",
    },
];
const DIAGNOSES: &[Field] = &[
    Field {
        name: "icd_code",
        kind: Kind::Category,
        description: "ICD-10 code of the recorded diagnosis",
    },
    Field {
        name: "is_primary",
        kind: Kind::Category,
        description: "true when it was the primary diagnosis",
    },
    Field {
        name: "encounter_type",
        kind: Kind::Category,
        description: "Setting of the encounter",
    },
    Field {
        name: "department",
        kind: Kind::Category,
        description: "Department of the encounter",
    },
];
const ADMISSIONS: &[Field] = &[
    Field {
        name: "department",
        kind: Kind::Category,
        description: "Admitting department",
    },
    Field {
        name: "admission_source",
        kind: Kind::Category,
        description: "Where the patient came from",
    },
    Field {
        name: "ip_type",
        kind: Kind::Category,
        description: "Inpatient category",
    },
    Field {
        name: "discharge_type",
        kind: Kind::Category,
        description: "How the stay ended (blank while admitted)",
    },
    Field {
        name: "length_of_stay_days",
        kind: Kind::Number,
        description: "Whole days from admission to discharge (blank while admitted)",
    },
];

/// The patient columns every dataset reads, joined as `p`.
const PATIENT: &str = "p.id, p.date_of_birth, p.gender::text, \
    COALESCE((SELECT pa.postal_code FROM patient_addresses pa \
              WHERE pa.patient_id = p.id AND pa.deleted_at IS NULL \
              ORDER BY pa.is_primary DESC NULLS LAST LIMIT 1), p.address->>'pincode')";

/// A dataset's fields, or `None` for a name no study may ask for.
#[must_use]
pub fn fields(dataset: &str) -> Option<&'static [Field]> {
    match dataset {
        "visits" => Some(VISITS),
        "diagnoses" => Some(DIAGNOSES),
        "admissions" => Some(ADMISSIONS),
        _ => None,
    }
}

fn sql(dataset: &str) -> Option<String> {
    let body = match dataset {
        "visits" => {
            "e.encounter_date, e.encounter_type::text, e.visit_type, dep.name \
            FROM encounters e JOIN patients p ON p.id = e.patient_id \
            LEFT JOIN departments dep ON dep.id = e.department_id \
            WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND NOT COALESCE(e.is_dummy, false) \
              AND e.encounter_date BETWEEN $2 AND $3"
        }
        "diagnoses" => {
            "e.encounter_date, d.icd_code, d.is_primary::text, e.encounter_type::text, dep.name \
            FROM diagnoses d JOIN encounters e ON e.id = d.encounter_id \
            JOIN patients p ON p.id = e.patient_id \
            LEFT JOIN departments dep ON dep.id = e.department_id \
            WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
              AND NOT COALESCE(e.is_dummy, false) AND e.encounter_date BETWEEN $2 AND $3"
        }
        "admissions" => {
            "a.admitted_at::date, dep.name, a.admission_source::text, a.ip_type::text, \
              a.discharge_type::text, (a.discharged_at::date - a.admitted_at::date)::text \
            FROM admissions a JOIN patients p ON p.id = a.patient_id \
            LEFT JOIN departments dep ON dep.id = a.department_id \
            WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND NOT COALESCE(a.is_dummy, false) \
              AND a.mlc_case_id IS NULL AND a.admitted_at::date BETWEEN $2 AND $3"
        }
        _ => return None,
    };
    Some(format!(
        "SELECT {PATIENT}, {body} AND p.deleted_at IS NULL ORDER BY 1 LIMIT {}",
        MAX_ROWS + 1
    ))
}

/// Why an extract could not be read.
#[derive(Debug, thiserror::Error)]
pub enum ReadError {
    #[error("unknown dataset")]
    Unknown,
    #[error("more than {MAX_ROWS} rows — narrow the period")]
    TooMany,
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

/// The dataset's raw rows over `[from, to]` at the transaction's hospital.
///
/// # Errors
/// An unknown dataset, too many rows, or a database error.
pub async fn read(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    dataset: &str,
    (from, to): (NaiveDate, NaiveDate),
) -> Result<Vec<RawRow>, ReadError> {
    let n = fields(dataset).ok_or(ReadError::Unknown)?.len();
    let sql = sql(dataset).ok_or(ReadError::Unknown)?;
    let rows = sqlx::query(&sql)
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&mut **tx)
        .await?;
    if rows.len() > MAX_ROWS {
        return Err(ReadError::TooMany);
    }
    rows.iter()
        .map(|r| {
            use sqlx::Row as _;
            Ok(RawRow {
                patient: r.try_get(0)?,
                birth: r.try_get(1)?,
                sex: r.try_get(2)?,
                pincode: r.try_get(3)?,
                on: r.try_get(4)?,
                values: (5..5 + n)
                    .map(|i| r.try_get::<Option<String>, _>(i))
                    .collect::<Result<_, _>>()?,
            })
        })
        .collect::<Result<_, sqlx::Error>>()
        .map_err(ReadError::Db)
}
