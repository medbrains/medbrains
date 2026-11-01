//! The files an approved export becomes: a flat dataset (CSV plus data
//! dictionary) or an OMOP CDM v5.4 bundle (zip plus README).

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use super::datasets::{self, ReadError};
use super::{ExportRow, deid, omop};

/// The OMOP bundle's name among the datasets.
pub const OMOP: &str = "omop";

/// What an approval stores.
#[derive(Debug)]
pub struct Built {
    pub data: Vec<u8>,
    pub dictionary: Vec<u8>,
    pub report: Value,
    pub rows: usize,
    pub suppressed: usize,
}

/// The data file's name and whether it is text (CSV) or binary (zip).
#[must_use]
pub fn data_file(row: &ExportRow) -> (String, bool) {
    let short = &row.id.simple().to_string()[..8];
    if row.dataset == OMOP {
        (format!("research-omop-{short}.zip"), false)
    } else {
        (format!("research-{}-{short}-data.csv", row.dataset), true)
    }
}

/// The dictionary's name: a CSV data dictionary, or the bundle's README.
#[must_use]
pub fn dictionary_file(row: &ExportRow) -> String {
    let short = &row.id.simple().to_string()[..8];
    if row.dataset == OMOP {
        format!("research-omop-{short}-README.txt")
    } else {
        format!("research-{}-{short}-dictionary.csv", row.dataset)
    }
}

/// Read and de-identify `row`'s extract under `salt`.
///
/// # Errors
/// An unknown dataset, too many rows, a bundle that could not be written,
/// or a database error.
pub async fn build(
    tx: &mut PgConnection,
    tenant: Uuid,
    row: &ExportRow,
    salt: &[u8],
) -> Result<Built, ReadError> {
    let period = (row.period_from, row.period_to);
    let reference = &row.id.simple().to_string()[..8];
    if row.dataset == OMOP {
        let sources = omop::Sources {
            visits: datasets::read(tx, tenant, "visits", period).await?,
            diagnoses: datasets::read(tx, tenant, "diagnoses", period).await?,
            labs: datasets::read(tx, tenant, "labs", period).await?,
            medicines: datasets::read(tx, tenant, "medicines", period).await?,
            vitals: datasets::read(tx, tenant, "vitals", period).await?,
        };
        let map = concepts(tx, &omop::codes(&sources)).await?;
        let b = omop::bundle(&sources, &map, salt, period, reference);
        if b.zip.is_empty() {
            return Err(ReadError::Unwritable);
        }
        return Ok(Built {
            data: b.zip,
            dictionary: b.readme.into_bytes(),
            report: b.report,
            rows: b.rows,
            suppressed: b.suppressed,
        });
    }
    let fields = datasets::fields(&row.dataset).ok_or(ReadError::Unknown)?;
    let raw = datasets::read(tx, tenant, &row.dataset, period).await?;
    let out = deid::release(fields, raw, salt, reference);
    Ok(Built {
        data: deid::to_csv(&out.header, &out.rows).into_bytes(),
        dictionary: datasets::dictionary(row, fields, &out.report).into_bytes(),
        report: out.report,
        rows: out.rows.len(),
        suppressed: out.suppressed_rows,
    })
}

/// OMOP concept ids for `codes`, from the licence-free vocabularies the
/// hospital loaded into `omop_concept_map`; empty when none are loaded.
async fn concepts(
    tx: &mut PgConnection,
    codes: &[(String, String)],
) -> Result<omop::ConceptMap, ReadError> {
    let (vocabularies, values): (Vec<String>, Vec<String>) = codes.iter().cloned().unzip();
    let rows = sqlx::query_as::<_, (String, String, i64, Option<i64>)>(
        "SELECT m.vocabulary_id, m.concept_code, m.source_concept_id, m.standard_concept_id \
         FROM omop_concept_map m \
         JOIN unnest($1::text[], $2::text[]) AS c(vocabulary_id, concept_code) \
           USING (vocabulary_id, concept_code)",
    )
    .bind(&vocabularies)
    .bind(&values)
    .fetch_all(&mut *tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(v, c, s, t)| ((v, c), (s, t)))
        .collect())
}
