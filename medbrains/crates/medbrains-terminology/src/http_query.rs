//! Read endpoints: search, concept, hierarchy, ECL, analytics.
//!
//! All authenticated, all bounded at [`MAX_RESULTS`] rows (licence clause
//! 2.2.4 — no bulk extraction), none paginated, so the content cannot be
//! walked out page by page.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions::terminology::snomed;
use serde::{Deserialize, Serialize};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;

use crate::analytics::{self, SnomedConceptCount, SnomedRollupRow};
use crate::concept::{self, Direction, SnomedConceptDetail, SnomedConceptSummary};
use crate::ecl::{self, SnomedEclResult};
use crate::ids::ROOT;
use crate::release::{self, LICENCE_NOTICE};
use crate::sctid::parse_sctid;
use crate::search::{self, MAX_RESULTS, SearchParams, SnomedConceptHit};

/// Searching serves both browsing and picking a concept to count by.
const SEARCHERS: [&str; 2] = [snomed::VIEW, snomed::ANALYTICS];

fn sctid(value: &str) -> Result<i64, AppError> {
    parse_sctid(value)
        .ok_or_else(|| AppError::BadRequest(format!("{value} is not a SNOMED CT identifier")))
}

#[derive(Debug, Serialize)]
pub struct SnomedLoadedRelease {
    pub edition: String,
    pub version_date: chrono::NaiveDate,
    pub module_ids: Vec<String>,
    pub imported_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SnomedStatus {
    pub loaded: bool,
    pub releases: Vec<SnomedLoadedRelease>,
    pub licence_notice: &'static str,
}

/// `GET /api/terminology/snomed/status` — what is loaded, and the notice.
pub async fn get_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SnomedStatus>, AppError> {
    require_any_permission(&claims, &[snomed::VIEW, snomed::ANALYTICS, snomed::MANAGE])?;
    let releases: Vec<SnomedLoadedRelease> = release::loaded(&state.db)
        .await?
        .into_iter()
        .map(|r| SnomedLoadedRelease {
            edition: r.edition,
            version_date: r.version_date,
            module_ids: r.module_ids,
            imported_at: r.imported_at,
        })
        .collect();
    Ok(Json(SnomedStatus {
        loaded: !releases.is_empty(),
        releases,
        licence_notice: LICENCE_NOTICE,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SnomedSearchQuery {
    pub q: String,
    pub limit: Option<i64>,
    pub active_only: Option<bool>,
    pub semantic_tag: Option<String>,
    pub refset: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SnomedSearchResponse {
    /// False until a release is imported — an empty list then means "not
    /// loaded", never "no such concept".
    pub loaded: bool,
    pub results: Vec<SnomedConceptHit>,
}

/// `GET /api/terminology/snomed/search`.
pub async fn search_concepts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SnomedSearchQuery>,
) -> Result<Json<SnomedSearchResponse>, AppError> {
    require_any_permission(&claims, &SEARCHERS)?;
    if !release::is_loaded(&state.db).await? {
        return Ok(Json(SnomedSearchResponse {
            loaded: false,
            results: Vec::new(),
        }));
    }
    let lang = q
        .lang
        .as_deref()
        .map(str::trim)
        .filter(|l| l.len() == 2 && l.bytes().all(|b| b.is_ascii_lowercase()))
        .unwrap_or("en")
        .to_owned();
    let params = SearchParams {
        q: q.q.chars().take(200).collect(),
        limit: q.limit.unwrap_or(20),
        active_only: q.active_only.unwrap_or(true),
        semantic_tag: q.semantic_tag.filter(|t| !t.trim().is_empty()),
        refset: q.refset.as_deref().map(sctid).transpose()?,
        lang,
    };
    let results = search::search(&state.db, &params).await?;
    Ok(Json(SnomedSearchResponse {
        loaded: true,
        results,
    }))
}

/// `GET /api/terminology/snomed/concepts/{id}`.
pub async fn get_concept(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
) -> Result<Json<SnomedConceptDetail>, AppError> {
    require_any_permission(&claims, &SEARCHERS)?;
    concept::detail(&state.db, sctid(&id)?)
        .await?
        .map(Json)
        .ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct SnomedHierarchyQuery {
    /// `ancestors` | `descendants`.
    pub direction: String,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SnomedHierarchyResponse {
    pub concepts: Vec<SnomedConceptSummary>,
    pub total: i64,
}

/// `GET /api/terminology/snomed/concepts/{id}/hierarchy`.
pub async fn get_concept_hierarchy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Query(q): Query<SnomedHierarchyQuery>,
) -> Result<Json<SnomedHierarchyResponse>, AppError> {
    require_permission(&claims, snomed::VIEW)?;
    let direction = match q.direction.as_str() {
        "ancestors" => Direction::Up,
        "descendants" => Direction::Down,
        _ => {
            return Err(AppError::BadRequest(
                "direction is ancestors or descendants".to_owned(),
            ));
        }
    };
    let limit = q.limit.unwrap_or(MAX_RESULTS);
    let (concepts, total) = concept::walk(&state.db, sctid(&id)?, direction, limit).await?;
    Ok(Json(SnomedHierarchyResponse { concepts, total }))
}

#[derive(Debug, Deserialize)]
pub struct SnomedSubsumesQuery {
    pub sub: String,
    pub sup: String,
}

#[derive(Debug, Serialize)]
pub struct SnomedSubsumption {
    pub sub: String,
    pub sup: String,
    pub is_a: bool,
}

/// `GET /api/terminology/snomed/subsumes?sub=&sup=` — is `sub` a kind of `sup`?
pub async fn check_subsumption(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SnomedSubsumesQuery>,
) -> Result<Json<SnomedSubsumption>, AppError> {
    require_permission(&claims, snomed::VIEW)?;
    let is_a = search::is_a(&state.db, sctid(&q.sub)?, sctid(&q.sup)?).await?;
    Ok(Json(SnomedSubsumption {
        sub: q.sub,
        sup: q.sup,
        is_a,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SnomedEclQuery {
    pub expression: String,
    pub limit: Option<i64>,
}

/// `GET /api/terminology/snomed/ecl?expression=`.
pub async fn evaluate_ecl(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SnomedEclQuery>,
) -> Result<Json<SnomedEclResult>, AppError> {
    require_permission(&claims, snomed::VIEW)?;
    let expr = ecl::parse(&q.expression).map_err(|e| AppError::BadRequest(e.to_string()))?;
    let result = ecl::evaluate(&state.db, &expr, q.limit.unwrap_or(MAX_RESULTS)).await?;
    Ok(Json(result))
}

#[derive(Debug, Deserialize)]
pub struct SnomedCountQuery {
    pub concept: String,
}

/// `GET /api/terminology/snomed/analytics/count?concept=`.
pub async fn count_coded_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SnomedCountQuery>,
) -> Result<Json<SnomedConceptCount>, AppError> {
    require_permission(&claims, snomed::ANALYTICS)?;
    let concept = sctid(&q.concept)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let count = analytics::count_under(&mut tx, claims.tenant_id, concept).await?;
    tx.commit().await?;
    Ok(Json(count))
}

#[derive(Debug, Deserialize)]
pub struct SnomedRollupQuery {
    pub parent: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SnomedRollup {
    pub parent_id: String,
    pub categories: Vec<SnomedRollupRow>,
}

/// `GET /api/terminology/snomed/analytics/rollup?parent=` — the root's
/// children (top-level categories) by default.
pub async fn rollup_coded_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SnomedRollupQuery>,
) -> Result<Json<SnomedRollup>, AppError> {
    require_permission(&claims, snomed::ANALYTICS)?;
    let parent = q.parent.as_deref().map(sctid).transpose()?.unwrap_or(ROOT);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let categories = analytics::rollup(&mut tx, claims.tenant_id, parent).await?;
    tx.commit().await?;
    Ok(Json(SnomedRollup {
        parent_id: parent.to_string(),
        categories,
    }))
}
