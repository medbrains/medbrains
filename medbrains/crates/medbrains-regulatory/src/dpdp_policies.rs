//! The policy pack: drafted from a template, sent for review, approved by a
//! different person — which publishes it and supersedes the version before —
//! or returned with a reason. A published version is never edited; a change
//! is a new version started from it.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::dpdp_templates::{self as templates, KINDS, LANGUAGES, TEMPLATE_VERSION};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Policy {
    pub id: Uuid,
    pub kind: String,
    pub language: String,
    pub version: i32,
    pub title: String,
    pub body: String,
    pub template_version: Option<String>,
    pub status: String,
    pub drafted_by: Uuid,
    pub drafted_by_name: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub decided_by_name: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub return_reason: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

const SELECT: &str = "SELECT p.id, p.kind, p.language, p.version, p.title, p.body, \
        p.template_version, p.status, p.drafted_by, d.full_name AS drafted_by_name, \
        p.submitted_at, a.full_name AS decided_by_name, p.decided_at, p.return_reason, \
        p.published_at, p.updated_at \
   FROM compliance_policies p \
   LEFT JOIN users d ON d.id = p.drafted_by \
   LEFT JOIN users a ON a.id = p.decided_by \
  WHERE p.tenant_id = $1 AND p.deleted_at IS NULL";

async fn fetch(tx: &mut Tx<'_>, tenant_id: Uuid, id: Uuid) -> Result<Policy, AppError> {
    sqlx::query_as::<_, Policy>(&format!("{SELECT} AND p.id = $2"))
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub kind: Option<String>,
}

/// `GET /api/regulatory/dpdp/policies` — every version, newest first.
pub async fn list_policies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Policy>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Policy>(&format!(
        "{SELECT} AND ($2::text IS NULL OR p.kind = $2) \
         ORDER BY p.kind, p.language, p.version DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(&q.kind)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/regulatory/dpdp/templates` — what each policy is and its legal basis.
pub async fn list_templates(
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<templates::TemplateInfo>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::VIEW)?;
    Ok(Json(templates::TEMPLATES.to_vec()))
}

#[derive(Debug, Deserialize)]
pub struct StartDraft {
    pub kind: String,
    pub language: String,
}

/// The placeholders' values: the hospital's name and the officers.
async fn placeholders(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<Vec<(&'static str, Option<String>)>, AppError> {
    let hospital: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;
    let officers = crate::dpdp_officers::load(tx, tenant_id).await?;
    let who = |role: &str| {
        officers
            .iter()
            .find(|o| o.role == role)
            .map(|o| format!("{}, {} — {}, {}", o.name, o.designation, o.email, o.phone))
    };
    Ok(vec![
        ("hospital", hospital),
        ("dpo", who("dpo")),
        ("grievance_officer", who("grievance_officer")),
        ("certin_poc", who("certin_poc")),
    ])
}

/// `POST /api/regulatory/dpdp/policies` — start a draft: from the published
/// version if there is one, else from the template.
pub async fn start_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(b): Json<StartDraft>,
) -> Result<Json<Policy>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::POLICY_DRAFT)?;
    if !KINDS.contains(&b.kind.as_str()) || !LANGUAGES.contains(&b.language.as_str()) {
        return Err(AppError::BadRequest("Unknown policy or language".into()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current: Option<(String, String)> = sqlx::query_as(
        "SELECT title, body FROM compliance_policies WHERE tenant_id = $1 AND kind = $2 \
            AND language = $3 AND status = 'published' AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&b.kind)
    .bind(&b.language)
    .fetch_optional(&mut *tx)
    .await?;
    let (title, body) = match current {
        Some(published) => published,
        None => {
            let values = placeholders(&mut tx, claims.tenant_id).await?;
            let text = templates::body(&b.kind, &b.language).ok_or(AppError::NotFound)?;
            let title = templates::title(&b.kind).unwrap_or("Policy").to_owned();
            (title, templates::fill(&text, &values))
        }
    };
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO compliance_policies (tenant_id, kind, language, version, title, body, \
             template_version, drafted_by) \
         SELECT $1, $2, $3, COALESCE(MAX(version), 0) + 1, $4, $5, $6, $7 \
           FROM compliance_policies WHERE tenant_id = $1 AND kind = $2 AND language = $3 \
            AND deleted_at IS NULL \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&b.kind)
    .bind(&b.language)
    .bind(&title)
    .bind(&body)
    .bind(TEMPLATE_VERSION)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(d) if d.is_unique_violation() => {
            AppError::Conflict("A draft of this policy is already open — continue that one".into())
        }
        other => other.into(),
    })?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct EditDraft {
    pub title: String,
    pub body: String,
}

/// `PUT /api/regulatory/dpdp/policies/{id}` — edit a draft (or a returned one).
pub async fn edit_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(b): Json<EditDraft>,
) -> Result<Json<Policy>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::POLICY_DRAFT)?;
    if b.title.trim().chars().count() < 3 || b.body.trim().chars().count() < 20 {
        return Err(AppError::BadRequest(
            "A policy needs a title and its text".into(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let done = sqlx::query(
        "UPDATE compliance_policies SET title = $3, body = $4, status = 'draft' \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND status IN ('draft', 'returned')",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(b.title.trim())
    .bind(&b.body)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    settle(tx, &claims, id, done).await
}

/// `PUT /api/regulatory/dpdp/policies/{id}/submit`
pub async fn submit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Policy>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::POLICY_DRAFT)?;
    let mut tx = begin(&state, &claims).await?;
    let done = sqlx::query(
        "UPDATE compliance_policies SET status = 'in_review', submitted_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND status IN ('draft', 'returned')",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    settle(tx, &claims, id, done).await
}

#[derive(Debug, Deserialize)]
pub struct ReturnDraft {
    pub reason: String,
}

/// `PUT /api/regulatory/dpdp/policies/{id}/return` — send back with a reason.
pub async fn return_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(b): Json<ReturnDraft>,
) -> Result<Json<Policy>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::POLICY_APPROVE)?;
    if b.reason.trim().chars().count() < 3 {
        return Err(AppError::BadRequest("Say what needs to change".into()));
    }
    reject_own(&state, &claims, id).await?;
    let mut tx = begin(&state, &claims).await?;
    let done = sqlx::query(
        "UPDATE compliance_policies SET status = 'returned', return_reason = $3, \
                decided_by = $4, decided_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND status = 'in_review'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(b.reason.trim())
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    settle(tx, &claims, id, done).await
}

/// `PUT /api/regulatory/dpdp/policies/{id}/approve` — publish it, and retire
/// the version it replaces, in one transaction.
pub async fn approve(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Policy>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::POLICY_APPROVE)?;
    reject_own(&state, &claims, id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let p = fetch(&mut tx, claims.tenant_id, id).await?;
    if p.status != "in_review" {
        return Err(AppError::Conflict(
            "Only a policy sent for review can be approved".into(),
        ));
    }
    if let Some(why) = templates::unfinished(&p.body) {
        return Err(AppError::Conflict(format!("{why} before approving it")));
    }
    sqlx::query(
        "UPDATE compliance_policies SET status = 'superseded', superseded_at = now() \
          WHERE tenant_id = $1 AND kind = $2 AND language = $3 AND status = 'published' \
            AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&p.kind)
    .bind(&p.language)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE compliance_policies SET status = 'published', decided_by = $1, decided_at = now(), \
                published_at = now() \
          WHERE id = $2 AND tenant_id = $3 AND status = 'in_review'",
    )
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Maker-checker: whoever drafted a policy never decides it.
async fn reject_own(state: &AppState, claims: &Claims, id: Uuid) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let p = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    if p.drafted_by == claims.sub {
        return Err(AppError::ForbiddenReason(
            "You drafted this policy, so someone else must approve or return it".into(),
        ));
    }
    Ok(())
}

async fn begin<'a>(state: &AppState, claims: &Claims) -> Result<Tx<'a>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// Commit a state change, or say why it could not happen (not found is a
/// 404; a policy in the wrong state is a 409).
async fn settle(
    mut tx: Tx<'_>,
    claims: &Claims,
    id: Uuid,
    changed: u64,
) -> Result<Json<Policy>, AppError> {
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    if changed == 0 {
        return Err(AppError::Conflict(format!(
            "This policy is {} — that step is not possible now",
            row.status.replace('_', " ")
        )));
    }
    tx.commit().await?;
    Ok(Json(row))
}
