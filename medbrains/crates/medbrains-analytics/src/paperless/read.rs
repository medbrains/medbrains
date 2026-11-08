//! Reading the meter for a range of days: headline shares, a department
//! table, the daily trend, the documents by type, and the sentence.
//!
//! Four bounded queries in one unit of work, all over `paperless_daily` and
//! `paperless_days`, never the clinical tables.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use medbrains_documents::signable::SIGNABLE;
use medbrains_kernel::{Actor, Tx};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use super::summary::{Counts, Halves, sentence};
use super::{ReportQuery, sources};

/// Days read when the caller names no start.
const DEFAULT_DAYS: i64 = 30;
/// Most days one read covers.
const MAX_DAYS: i64 = 366;
/// Most department rows (two halves each) one read returns.
const MAX_DEPARTMENT_ROWS: i64 = 2000;

/// Why the legally-signed share is what it is.
const LEGAL_NOTE: &str = "No IT Act signing provider (DSC or Aadhaar eSign) is connected yet, \
    so no document carries a legal signature. Digital signatures here are MedBrains Ed25519 \
    signatures: they prove who signed and that nothing changed, but are not s.3A signatures.";

/// What the meter does not see, said on the screen rather than left out.
const NOT_COUNTED: &[&str] = &[
    "Paper that was never scanned is invisible to the system, so the digital share is an upper bound.",
    "Only a document's first print has a date; reprints are not counted.",
    "MRD physical file requests are not counted yet: the file-room tracker (PR #5255) is not merged.",
    "Consent forms are signed in the consent module and are not counted yet.",
];

/// One day of the trend. A day the meter never counted has no counts.
#[derive(Debug, Serialize)]
pub struct DayPoint {
    pub date: NaiveDate,
    pub measured: bool,
    pub counts: Option<Counts>,
    pub digital_pct: Option<f64>,
    pub signed_pct: Option<f64>,
}

/// One department's row. `department_id` null is "no department".
#[derive(Debug, Serialize)]
pub struct DepartmentRow {
    pub department_id: Option<Uuid>,
    pub name: String,
    pub counts: Counts,
    pub digital_pct: Option<f64>,
    pub signed_pct: Option<f64>,
}

/// One document type's row.
#[derive(Debug, Serialize)]
pub struct TypeRow {
    pub doc_type: String,
    pub label: String,
    pub created: i64,
    pub signed: i64,
    pub signed_pct: Option<f64>,
}

/// The legally-signed share: 0% of a known count while no provider exists.
#[derive(Debug, Serialize)]
pub struct Legal {
    pub signed: i64,
    pub pct: Option<f64>,
    pub provider_connected: bool,
    pub note: &'static str,
}

/// `GET /api/analytics/paperless`.
#[derive(Debug, Serialize)]
pub struct PaperlessReport {
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub days: usize,
    pub measured_days: usize,
    pub last_counted_at: Option<DateTime<Utc>>,
    pub totals: Counts,
    pub digital_pct: Option<f64>,
    pub signed_pct: Option<f64>,
    pub legal: Legal,
    pub summary: String,
    pub series: Vec<DayPoint>,
    pub departments: Vec<DepartmentRow>,
    pub doc_types: Vec<TypeRow>,
    pub not_counted: Vec<String>,
}

/// `(created, signed, scanned, printed)` sums as a row.
type Sums = (i64, i64, i64, i64);

/// Counts from a row of sums.
const fn counts((created, signed, scanned, printed): Sums) -> Counts {
    Counts {
        created,
        signed,
        scanned,
        printed,
    }
}

/// The days asked for, capped to today and to [`MAX_DAYS`].
fn range(q: &ReportQuery, today: NaiveDate) -> Result<(NaiveDate, NaiveDate), AppError> {
    let to = q.to.unwrap_or(today).min(today);
    let days = q.days.unwrap_or(DEFAULT_DAYS).clamp(1, MAX_DAYS);
    let from = q
        .from
        .unwrap_or(to - Duration::days(days - 1))
        .max(to - Duration::days(MAX_DAYS - 1));
    if from > to {
        return Err(AppError::BadRequest(
            "The start day is after the end day.".to_owned(),
        ));
    }
    Ok((from, to))
}

/// The meter for `q`'s days, read as `actor`.
pub async fn report(
    pool: &PgPool,
    actor: Actor,
    q: &ReportQuery,
) -> Result<PaperlessReport, AppError> {
    let mut tx = medbrains_kernel::begin(pool, actor).await?;
    let (_, today) = super::clock(&mut tx, actor.tenant_id).await?;
    let (from, to) = range(q, today)?;
    let counted: Vec<(NaiveDate, DateTime<Utc>)> = sqlx::query_as(
        "SELECT day, computed_at FROM paperless_days \
          WHERE tenant_id = $1 AND day BETWEEN $2 AND $3 ORDER BY day",
    )
    .bind(actor.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;
    // The later half starts at the middle counted day; with none, all is "before".
    let mid = counted
        .get(counted.len() / 2)
        .map_or(to + Duration::days(1), |c| c.0);
    let scope = (actor.tenant_id, from, to);
    let days = by_day(&mut tx, scope).await?;
    let depts = by_department(&mut tx, scope, mid).await?;
    let types = by_type(&mut tx, scope).await?;
    let skipped = skipped_types(&mut tx).await?;
    tx.commit().await?;
    Ok(assemble(Parts {
        from,
        to,
        mid,
        counted,
        days,
        depts,
        types,
        skipped,
    }))
}

/// Tenant and days every read shares.
type Scope = (Uuid, NaiveDate, NaiveDate);

/// Sums per day.
async fn by_day(tx: &mut Tx, s: Scope) -> Result<Vec<(NaiveDate, Sums)>, AppError> {
    let rows: Vec<(NaiveDate, i64, i64, i64, i64)> = sqlx::query_as(
        "SELECT day, SUM(created)::int8, SUM(signed)::int8, SUM(scanned)::int8, SUM(printed)::int8 \
           FROM paperless_daily \
          WHERE tenant_id = $1 AND day BETWEEN $2 AND $3 \
          GROUP BY day",
    )
    .bind(s.0)
    .bind(s.1)
    .bind(s.2)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(d, a, b, c, e)| (d, (a, b, c, e)))
        .collect())
}

/// One department's sums in one half: `(id, name, later half?, sums)`.
type DeptSums = (Option<Uuid>, String, Option<bool>, Sums);

/// Sums per department and half, with every active department present even
/// when it made no documents, a retired one only while it has documents in
/// the range, and "no department" when anything lacks one.
async fn by_department(tx: &mut Tx, s: Scope, mid: NaiveDate) -> Result<Vec<DeptSums>, AppError> {
    let rows: Vec<(Option<Uuid>, String, Option<bool>, i64, i64, i64, i64)> = sqlx::query_as(
        "WITH agg AS ( \
           SELECT department_id, day >= $4 AS later, SUM(created)::int8 AS c, \
                  SUM(signed)::int8 AS s, SUM(scanned)::int8 AS sc, SUM(printed)::int8 AS p \
             FROM paperless_daily \
            WHERE tenant_id = $1 AND day BETWEEN $2 AND $3 \
            GROUP BY 1, 2) \
         SELECT * FROM ( \
           SELECT d.id, d.name, agg.later, COALESCE(agg.c, 0), COALESCE(agg.s, 0), \
                  COALESCE(agg.sc, 0), COALESCE(agg.p, 0) \
             FROM departments d LEFT JOIN agg ON agg.department_id = d.id \
            WHERE d.tenant_id = $1 \
              AND ((d.deleted_at IS NULL AND d.is_active) OR agg.department_id IS NOT NULL) \
           UNION ALL \
           SELECT NULL, 'No department', later, c, s, sc, p FROM agg WHERE department_id IS NULL \
         ) x LIMIT $5",
    )
    .bind(s.0)
    .bind(s.1)
    .bind(s.2)
    .bind(mid)
    .bind(MAX_DEPARTMENT_ROWS)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(i, n, l, a, b, c, e)| (i, n, l, (a, b, c, e)))
        .collect())
}

/// Documents made and signed per type.
async fn by_type(tx: &mut Tx, s: Scope) -> Result<Vec<(String, i64, i64)>, AppError> {
    Ok(sqlx::query_as(
        "SELECT doc_type, SUM(created)::int8, SUM(signed)::int8 FROM paperless_daily \
          WHERE tenant_id = $1 AND day BETWEEN $2 AND $3 AND created > 0 \
          GROUP BY doc_type",
    )
    .bind(s.0)
    .bind(s.1)
    .bind(s.2)
    .fetch_all(&mut **tx)
    .await?)
}

/// Signable types the meter cannot count on this database, by label.
async fn skipped_types(tx: &mut Tx) -> Result<Vec<&'static str>, AppError> {
    let cols = super::columns(tx).await?;
    Ok(SIGNABLE
        .iter()
        .filter(|t| sources::signable_statement(t, &cols).is_none())
        .map(|t| t.label)
        .collect())
}

/// Everything [`assemble`] builds the report from.
struct Parts {
    from: NaiveDate,
    to: NaiveDate,
    mid: NaiveDate,
    counted: Vec<(NaiveDate, DateTime<Utc>)>,
    days: Vec<(NaiveDate, Sums)>,
    depts: Vec<DeptSums>,
    types: Vec<(String, i64, i64)>,
    skipped: Vec<&'static str>,
}

/// The report from the rows read.
fn assemble(p: Parts) -> PaperlessReport {
    let series = trend(&p);
    let (mut before, mut after) = (Counts::default(), Counts::default());
    for (day, sums) in &p.days {
        if *day >= p.mid {
            after += counts(*sums)
        } else {
            before += counts(*sums)
        }
    }
    let mut totals = before;
    totals += after;
    let halves = halves_by_department(&p.depts);
    let movers: Vec<Halves> = halves.iter().map(|(_, h)| h.clone()).collect();
    let mut not_counted: Vec<String> = NOT_COUNTED.iter().map(|s| (*s).to_owned()).collect();
    not_counted.extend(
        p.skipped
            .iter()
            .map(|l| format!("{l}: its table has no creation time, so it is not counted.")),
    );
    PaperlessReport {
        from: p.from,
        to: p.to,
        days: series.len(),
        measured_days: p.counted.len(),
        last_counted_at: p.counted.iter().map(|c| c.1).max(),
        totals,
        digital_pct: totals.digital_pct(),
        signed_pct: totals.signed_pct(),
        legal: legal(totals),
        summary: sentence(p.counted.len(), before, after, &movers),
        series,
        departments: department_rows(halves),
        doc_types: type_rows(&p.types),
        not_counted,
    }
}

/// The legally-signed share: no provider, so 0 signed of a known count.
const fn legal(totals: Counts) -> Legal {
    Legal {
        signed: 0,
        pct: if totals.created > 0 { Some(0.0) } else { None },
        provider_connected: false,
        note: LEGAL_NOTE,
    }
}

/// Every day in the range; a day never counted has no counts.
fn trend(p: &Parts) -> Vec<DayPoint> {
    let sums: std::collections::HashMap<NaiveDate, Sums> = p.days.iter().copied().collect();
    let counted: std::collections::HashSet<NaiveDate> = p.counted.iter().map(|c| c.0).collect();
    p.from
        .iter_days()
        .take_while(|d| *d <= p.to)
        .map(|date| {
            let measured = counted.contains(&date);
            let c = measured.then(|| {
                sums.get(&date)
                    .copied()
                    .map_or_else(Counts::default, counts)
            });
            DayPoint {
                date,
                measured,
                digital_pct: c.and_then(|c| c.digital_pct()),
                signed_pct: c.and_then(|c| c.signed_pct()),
                counts: c,
            }
        })
        .collect()
}

/// Each department's two halves, in the order the rows came.
fn halves_by_department(rows: &[DeptSums]) -> Vec<(Option<Uuid>, Halves)> {
    let mut out: Vec<(Option<Uuid>, Halves)> = Vec::new();
    let mut at: std::collections::HashMap<Option<Uuid>, usize> = std::collections::HashMap::new();
    for (id, name, later, sums) in rows {
        let i = *at.entry(*id).or_insert_with(|| {
            out.push((
                *id,
                Halves {
                    name: name.clone(),
                    before: Counts::default(),
                    after: Counts::default(),
                },
            ));
            out.len() - 1
        });
        match later {
            Some(true) => out[i].1.after += counts(*sums),
            Some(false) => out[i].1.before += counts(*sums),
            None => {}
        }
    }
    out
}

/// The department table: most documents first, then by name.
fn department_rows(halves: Vec<(Option<Uuid>, Halves)>) -> Vec<DepartmentRow> {
    let mut rows: Vec<DepartmentRow> = halves
        .into_iter()
        .map(|(department_id, h)| {
            let mut c = h.before;
            c += h.after;
            DepartmentRow {
                department_id,
                name: h.name,
                digital_pct: c.digital_pct(),
                signed_pct: c.signed_pct(),
                counts: c,
            }
        })
        .collect();
    rows.sort_by(|a, b| {
        b.counts
            .created
            .cmp(&a.counts.created)
            .then_with(|| a.name.cmp(&b.name))
    });
    rows
}

/// Every signable type and clinical notes, with what the range made of each.
fn type_rows(found: &[(String, i64, i64)]) -> Vec<TypeRow> {
    let named = SIGNABLE
        .iter()
        .map(|t| (t.record_type, t.label))
        .chain([("clinical_note", "Clinical note")]);
    named
        .map(|(doc_type, label)| {
            let (created, signed) = found
                .iter()
                .find(|f| f.0 == doc_type)
                .map_or((0, 0), |f| (f.1, f.2));
            TypeRow {
                doc_type: doc_type.to_owned(),
                label: label.to_owned(),
                created,
                signed,
                signed_pct: super::summary::pct(signed, created),
            }
        })
        .collect()
}
