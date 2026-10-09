//! Chart review: every note on the patient's record, across visits, newest
//! care first (RFCs/RFC-MODULE-clinical-notes.md, phase 4).

use std::collections::{HashMap, HashSet};

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::model::Note;
use crate::store;

/// One page of notes: what a reviewer scrolls before asking for more.
const PAGE: i64 = 30;

#[derive(Debug, Deserialize)]
pub struct ChartQuery {
    pub note_type: Option<String>,
    pub author_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    /// `signed`, `draft` or `entered_in_error`; absent: everything except
    /// notes entered in error, which are struck from the reading view.
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    /// The last note of the previous page: the page starts after it.
    pub before_at: Option<DateTime<Utc>>,
    pub before_id: Option<Uuid>,
}

/// The visit a note was written on, so the screen can open its case sheet.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChartVisit {
    pub encounter_id: Uuid,
    pub encounter_type: String,
    pub encounter_date: Option<NaiveDate>,
    pub admission_id: Option<Uuid>,
    pub er_visit_id: Option<Uuid>,
}

/// A choice the filters offer: only what is on this patient's record.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Facet {
    pub kind: String,
    pub value: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
pub struct ChartPage {
    /// Notes in the page, each followed by the addenda that amend it.
    pub notes: Vec<Note>,
    pub visits: Vec<ChartVisit>,
    pub facets: Vec<Facet>,
    pub has_more: bool,
}

/// `GET /api/patients/{id}/clinical-notes` — the patient's notes across
/// every visit, filtered, a page at a time.
pub async fn patient_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Query(q): Query<ChartQuery>,
) -> Result<Json<ChartPage>, AppError> {
    require_permission(&claims, permissions::clinical_notes::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = crate::begin(&state, &claims).await?;
    let author_only = store::settings(&mut tx, claims.tenant_id)
        .await?
        .draft_visibility
        == "author_only";
    // Drafts follow the hospital's setting, as on the case sheet.
    let visible = "n.tenant_id = $2 AND n.patient_id = $3 AND n.deleted_at IS NULL \
                   AND (n.status <> 'draft' OR NOT $4 OR n.author_id = $1)";
    let sql = format!(
        "{} WHERE {visible} AND n.amends_note_id IS NULL \
             AND ($5::text IS NULL OR t.code = $5) \
             AND ($6::uuid IS NULL OR n.author_id = $6) \
             AND ($7::uuid IS NULL OR n.service_department_id = $7) \
             AND (n.status = $8::text OR ($8::text IS NULL AND n.status <> 'entered_in_error')) \
             AND ($9::timestamptz IS NULL OR n.service_at >= $9) \
             AND ($10::timestamptz IS NULL OR n.service_at < $10) \
             AND ($11::timestamptz IS NULL OR (n.service_at, n.id) < ($11, $12)) \
           ORDER BY n.service_at DESC, n.id DESC LIMIT {}",
        store::note_select(1),
        PAGE + 1
    );
    let mut notes = sqlx::query_as::<_, Note>(&sql)
        .bind(claims.sub)
        .bind(claims.tenant_id)
        .bind(patient_id)
        .bind(author_only)
        .bind(&q.note_type)
        .bind(q.author_id)
        .bind(q.department_id)
        .bind(&q.status)
        .bind(q.from)
        .bind(q.to)
        .bind(q.before_at)
        .bind(q.before_id.unwrap_or_else(Uuid::max))
        .fetch_all(&mut *tx)
        .await?;
    let has_more = notes.len() > usize::try_from(PAGE).unwrap_or(usize::MAX);
    notes.truncate(usize::try_from(PAGE).unwrap_or(usize::MAX));

    // Every addendum of the page's notes in one round trip, not one each.
    let parents: Vec<Uuid> = notes.iter().map(|n| n.id).collect();
    let addenda_sql = format!(
        "{} WHERE {visible} AND n.amends_note_id = ANY($5) \
           ORDER BY n.service_at, n.created_at LIMIT 500",
        store::note_select(1)
    );
    let addenda = sqlx::query_as::<_, Note>(&addenda_sql)
        .bind(claims.sub)
        .bind(claims.tenant_id)
        .bind(patient_id)
        .bind(author_only)
        .bind(&parents)
        .fetch_all(&mut *tx)
        .await?;

    let encounters: Vec<Uuid> = notes
        .iter()
        .map(|n| n.encounter_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let visits = sqlx::query_as::<_, ChartVisit>(
        "SELECT e.id AS encounter_id, e.encounter_type::text AS encounter_type, \
                e.encounter_date, \
                a.id AS admission_id, er.id AS er_visit_id \
           FROM encounters e \
           LEFT JOIN admissions a ON a.encounter_id = e.id \
           LEFT JOIN er_visits er ON er.encounter_id = e.id \
          WHERE e.tenant_id = $1 AND e.id = ANY($2)",
    )
    .bind(claims.tenant_id)
    .bind(&encounters)
    .fetch_all(&mut *tx)
    .await?;

    let facets = facets(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    crate::soap_access::withhold(&state, &claims, &mut notes).await?;
    let mut addenda = addenda;
    crate::soap_access::withhold(&state, &claims, &mut addenda).await?;

    let ordered = nest_addenda(notes, addenda);
    Ok(Json(ChartPage {
        notes: ordered,
        visits,
        facets,
        has_more,
    }))
}

/// What the filters can offer: the types, authors and departments on this
/// patient's record.
async fn facets(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<Facet>, AppError> {
    Ok(sqlx::query_as::<_, Facet>(
        "SELECT DISTINCT kind, value, label FROM ( \
           SELECT 'note_type' AS kind, t.code AS value, t.name AS label \
             FROM clinical_notes n JOIN note_types t ON t.id = n.note_type_id \
            WHERE n.tenant_id = $1 AND n.patient_id = $2 AND n.deleted_at IS NULL \
           UNION ALL \
           SELECT 'author', u.id::text, u.full_name \
             FROM clinical_notes n JOIN users u ON u.id = n.author_id \
            WHERE n.tenant_id = $1 AND n.patient_id = $2 AND n.deleted_at IS NULL \
           UNION ALL \
           SELECT 'department', d.id::text, d.name \
             FROM clinical_notes n JOIN departments d ON d.id = n.service_department_id \
            WHERE n.tenant_id = $1 AND n.patient_id = $2 AND n.deleted_at IS NULL \
         ) f ORDER BY kind, label LIMIT 300",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// Each note followed by the addenda that amend it, in the page's order.
fn nest_addenda(notes: Vec<Note>, addenda: Vec<Note>) -> Vec<Note> {
    let mut by_parent: HashMap<Uuid, Vec<Note>> = HashMap::new();
    for a in addenda {
        if let Some(parent) = a.amends_note_id {
            by_parent.entry(parent).or_default().push(a);
        }
    }
    let mut ordered = Vec::with_capacity(notes.len() + by_parent.len());
    for n in notes {
        let children = by_parent.remove(&n.id).unwrap_or_default();
        ordered.push(n);
        ordered.extend(children);
    }
    ordered
}
