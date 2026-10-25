//! Historical import: a hospital's past — patients, visits, admissions, lab
//! results, dispenses, bills and claims from the system it used before — as
//! dated records in the same tables live work uses.
//!
//! How hospitals migrate, and so how this works:
//! - **Closed history only, before a cut-over.** Everything is dated before
//!   the hospital's go-live moment (`history_import/go_live_at`) and never in
//!   the future; an admission must already be discharged. Inpatients on the
//!   go-live day are admitted live, so history can never touch live work.
//! - **Insert, never update.** A batch adds rows; it never changes one that
//!   exists, including today's.
//! - **Same rules, no side effects.** Records are checked like live entries
//!   (names, phones, the hospital's diagnosis coding, masters, money that adds
//!   up, dates in order), but nothing a live write would trigger fires: no
//!   SMS/WhatsApp, no critical-value alerts, no NDPS register entry, no
//!   auto-billing, no stock movement. History is a record of what happened,
//!   not a new event.
//! - **Checked first, all or nothing.** Like the onboarding workbook, a batch
//!   runs inside one transaction: a dry run, or any problem, rolls it back and
//!   returns every problem by record and field.
//! - **Idempotent and traceable.** Each record carries the external id it had
//!   in the old system; (kind, external id) is unique per hospital, so a
//!   re-sent record is skipped. `history_import_records` ties every row to
//!   its batch, and the audit log names who committed it.

mod clinical;
mod ctx;
mod engine;
mod money;
mod orders;
mod patients;
mod rows;
mod settings;

use axum::{
    Extension, Json,
    extract::{DefaultBodyLimit, Path, State},
    routing::get,
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use ctx::{Ctx, Problem};
use engine::{import_all, load_context};
use rows::{NewBatch, audit_commit, finish_batch, insert_batch, reserve_uhids};
use settings::{get_settings, load_go_live, put_settings};

/// More than any one upload should carry; split bigger exports into batches.
const MAX_RECORDS: usize = 2_000;
/// 2,000 records of a few hundred bytes each, with room to spare (axum's default is 2 MB).
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Kind {
    Patient,
    Visit,
    Admission,
    LabOrder,
    Dispense,
    Invoice,
    Claim,
}

impl Kind {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Patient => "patient",
            Self::Visit => "visit",
            Self::Admission => "admission",
            Self::LabOrder => "lab_order",
            Self::Dispense => "dispense",
            Self::Invoice => "invoice",
            Self::Claim => "claim",
        }
    }

    fn parse(s: &str) -> Option<Self> {
        [
            Self::Patient,
            Self::Visit,
            Self::Admission,
            Self::LabOrder,
            Self::Dispense,
            Self::Invoice,
            Self::Claim,
        ]
        .into_iter()
        .find(|k| k.as_str() == s)
    }
}

/// One record from the old system. The variant order is the import order:
/// patients before their visits, visits before the bills that name them.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub(crate) enum Record {
    Patient(patients::PatientRec),
    Visit(clinical::VisitRec),
    Admission(clinical::AdmissionRec),
    LabOrder(orders::LabRec),
    Dispense(orders::DispenseRec),
    Invoice(money::InvoiceRec),
    Claim(money::ClaimRec),
}

impl Record {
    const fn kind(&self) -> Kind {
        match self {
            Self::Patient(_) => Kind::Patient,
            Self::Visit(_) => Kind::Visit,
            Self::Admission(_) => Kind::Admission,
            Self::LabOrder(_) => Kind::LabOrder,
            Self::Dispense(_) => Kind::Dispense,
            Self::Invoice(_) => Kind::Invoice,
            Self::Claim(_) => Kind::Claim,
        }
    }

    fn external_id(&self) -> &str {
        match self {
            Self::Patient(r) => &r.external_id,
            Self::Visit(r) => &r.external_id,
            Self::Admission(r) => &r.external_id,
            Self::LabOrder(r) => &r.external_id,
            Self::Dispense(r) => &r.external_id,
            Self::Invoice(r) => &r.external_id,
            Self::Claim(r) => &r.external_id,
        }
    }

    /// Every external id or UHID this record mentions, so lookups are one query per batch.
    fn mentions(&self) -> Vec<&str> {
        let mut out = vec![self.external_id()];
        match self {
            Self::Patient(_) => {}
            Self::Visit(r) => out.push(&r.patient),
            Self::Admission(r) => out.push(&r.patient),
            Self::LabOrder(r) => out.extend(
                [Some(&r.patient), r.visit.as_ref(), r.admission.as_ref()]
                    .into_iter()
                    .flatten()
                    .map(String::as_str),
            ),
            Self::Dispense(r) => out.extend(
                [Some(&r.patient), r.visit.as_ref(), r.admission.as_ref()]
                    .into_iter()
                    .flatten()
                    .map(String::as_str),
            ),
            Self::Invoice(r) => out.extend(
                [Some(&r.patient), r.visit.as_ref(), r.admission.as_ref()]
                    .into_iter()
                    .flatten()
                    .map(String::as_str),
            ),
            Self::Claim(r) => out.push(&r.invoice),
        }
        out
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct BatchRequest {
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) dry_run: bool,
    pub(crate) records: Vec<Record>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct Tally {
    pub(crate) kind: Kind,
    pub(crate) added: u32,
    /// Already imported by an earlier batch (same external id): left as it is.
    pub(crate) skipped: u32,
}

#[derive(Debug, Serialize)]
pub(crate) struct BatchResult {
    pub(crate) batch_id: Uuid,
    pub(crate) applied: bool,
    pub(crate) dry_run: bool,
    pub(crate) status: &'static str,
    pub(crate) go_live_at: DateTime<Utc>,
    pub(crate) tallies: Vec<Tally>,
    pub(crate) problems: Vec<Problem>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub(crate) struct BatchRow {
    pub(crate) id: Uuid,
    pub(crate) label: String,
    pub(crate) dry_run: bool,
    pub(crate) status: String,
    pub(crate) go_live_at: DateTime<Utc>,
    pub(crate) record_count: i32,
    pub(crate) tallies: Value,
    pub(crate) problems: Value,
    pub(crate) problem_count: i32,
    pub(crate) created_by_name: Option<String>,
    pub(crate) created_at: DateTime<Utc>,
}

pub(crate) async fn tx_for(
    state: &AppState,
    tenant: Uuid,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await?;
    Ok(tx)
}

/// `GET /api/history-import/batches` — the latest 100 batches, newest first.
pub(crate) async fn list_batches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BatchRow>>, AppError> {
    require_permission(&claims, permissions::admin::history_import::VIEW)?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, BatchRow>(
        "SELECT b.id, b.label, b.dry_run, b.status, b.go_live_at, b.record_count, b.tallies, \
                '[]'::jsonb AS problems, jsonb_array_length(b.problems) AS problem_count, \
                u.full_name AS created_by_name, b.created_at \
           FROM history_import_batches b LEFT JOIN users u ON u.id = b.created_by \
          WHERE b.tenant_id = $1 AND b.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/history-import/batches/{id}` — one batch with its problems.
pub(crate) async fn get_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BatchRow>, AppError> {
    require_permission(&claims, permissions::admin::history_import::VIEW)?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let row = sqlx::query_as::<_, BatchRow>(
        "SELECT b.id, b.label, b.dry_run, b.status, b.go_live_at, b.record_count, b.tallies, b.problems, \
                jsonb_array_length(b.problems) AS problem_count, u.full_name AS created_by_name, b.created_at \
           FROM history_import_batches b LEFT JOIN users u ON u.id = b.created_by \
          WHERE b.tenant_id = $1 AND b.id = $2 AND b.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/history-import/batches` — check (dry run) or commit one batch.
pub(crate) async fn run_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BatchRequest>,
) -> Result<Json<BatchResult>, AppError> {
    require_permission(&claims, permissions::admin::history_import::RUN)?;
    let label = body.label.trim().to_owned();
    if label.is_empty() || body.records.is_empty() {
        return Err(AppError::BadRequest(
            "A batch needs a label and at least one record".to_owned(),
        ));
    }
    if body.records.len() > MAX_RECORDS {
        return Err(AppError::BadRequest(format!(
            "This batch has {} records; send at most {MAX_RECORDS} at a time",
            body.records.len()
        )));
    }
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let go_live = load_go_live(&mut tx, claims.tenant_id)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest(
                "Set the hospital's go-live date before importing history".to_owned(),
            )
        })?;
    let batch = Uuid::new_v4();
    let count = i32::try_from(body.records.len()).unwrap_or(i32::MAX);
    let header = NewBatch {
        id: batch,
        tenant: claims.tenant_id,
        user: claims.sub,
        label: &label,
        dry_run: body.dry_run,
        go_live,
        count,
    };
    insert_batch(&mut tx, header).await?;
    // Rows this batch writes are audited as the batch (see migration 1214),
    // so the import never holds the hospital's audit-chain lock.
    sqlx::query("SELECT set_config('app.history_import_batch', $1, true)")
        .bind(batch.to_string())
        .execute(&mut *tx)
        .await?;
    let patients = body
        .records
        .iter()
        .filter(|r| matches!(r, Record::Patient(_)))
        .count();
    let uhids = reserve_uhids(&state, claims.tenant_id, patients, body.dry_run).await?;
    let mut ctx = load_context(
        tx,
        claims.tenant_id,
        claims.sub,
        batch,
        go_live,
        &body.records,
        uhids,
    )
    .await?;
    let tallies = import_all(&mut ctx, &body.records).await?;

    let applied = !body.dry_run && ctx.problems.is_empty();
    let status = if applied {
        "committed"
    } else if ctx.problems.is_empty() {
        "validated"
    } else {
        "refused"
    };
    let (tally_json, problem_json) = (json!(tallies), json!(ctx.problems));
    let Ctx {
        mut tx, problems, ..
    } = ctx;
    if applied {
        finish_batch(&mut tx, batch, status, &tally_json, &problem_json).await?;
        audit_commit(&mut tx, &claims, header, &tally_json).await?;
        tx.commit().await?;
    } else {
        // Nothing of the batch survives a dry run or a refusal — except the report.
        tx.rollback().await?;
        let mut tx = tx_for(&state, claims.tenant_id).await?;
        insert_batch(&mut tx, header).await?;
        finish_batch(&mut tx, batch, status, &tally_json, &problem_json).await?;
        tx.commit().await?;
    }
    Ok(Json(BatchResult {
        batch_id: batch,
        applied,
        dry_run: body.dry_run,
        status,
        go_live_at: go_live,
        tallies,
        problems,
    }))
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/history-import/settings",
            get(get_settings).put(put_settings),
        )
        .route(
            "/api/history-import/batches",
            get(list_batches)
                .post(run_batch)
                .layer(DefaultBodyLimit::max(MAX_BODY_BYTES)),
        )
        .route("/api/history-import/batches/{id}", get(get_batch))
}
