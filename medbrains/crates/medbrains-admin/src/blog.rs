//! Hospital blog — tenant-authored posts surfaced in Health Pulse. Reading
//! published posts needs `dashboard.view`; authoring needs the hospital
//! content permission (`admin.settings.branding.manage`). Tenant-scoped (RLS).

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const READ_PERM: &str = "dashboard.view";
const AUTHOR_PERM: &str = "admin.settings.branding.manage";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BlogPost {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub body_html: String,
    pub cover_image_url: Option<String>,
    pub status: String,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

const SELECT_COLS: &str = "id, title, slug, excerpt, body_html, cover_image_url, status, \
                           author_id, author_name, published_at, created_at, updated_at";

/// List row — omits `body_html` (the reader/editor fetches the full post by id).
/// The body is multi-KB HTML; shipping it for every card bloated the feed (#167).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BlogPostListItem {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub cover_image_url: Option<String>,
    pub status: String,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

const LIST_COLS: &str = "id, title, slug, excerpt, cover_image_url, status, author_id, \
                         author_name, published_at, created_at, updated_at";

#[derive(Debug, Deserialize)]
pub struct ListBlogQuery {
    /// Authors can include drafts/archived; readers only see published.
    pub include_drafts: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertBlogRequest {
    pub title: String,
    pub slug: Option<String>,
    pub excerpt: Option<String>,
    pub body_html: Option<String>,
    pub cover_image_url: Option<String>,
    pub status: Option<String>,
}

fn slugify(input: &str) -> String {
    let slug: String = input
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let trimmed = slug.trim_matches('-').to_owned();
    let collapsed = trimmed
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "post".to_owned()
    } else {
        collapsed
    }
}

fn normalize_status(status: Option<&str>) -> Result<&'static str, AppError> {
    match status.unwrap_or("draft") {
        "draft" => Ok("draft"),
        "published" => Ok("published"),
        "archived" => Ok("archived"),
        other => Err(AppError::BadRequest(format!("invalid blog status: {other}"))),
    }
}

async fn unique_slug(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    base: &str,
    exclude_id: Option<Uuid>,
) -> Result<String, AppError> {
    let mut candidate = base.to_owned();
    let mut counter = 2u32;
    loop {
        let taken: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM blog_posts \
             WHERE tenant_id = $1 AND slug = $2 AND ($3::uuid IS NULL OR id <> $3))",
        )
        .bind(tenant_id)
        .bind(&candidate)
        .bind(exclude_id)
        .fetch_one(&mut **tx)
        .await?;
        if !taken {
            return Ok(candidate);
        }
        candidate = format!("{base}-{counter}");
        counter += 1;
    }
}

/// `GET /api/blog` — published posts (or all, with `include_drafts` for authors).
pub async fn list_blog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBlogQuery>,
) -> Result<Json<Vec<BlogPostListItem>>, AppError> {
    require_permission(&claims, READ_PERM)?;
    let include_drafts = params.include_drafts.unwrap_or(false);
    if include_drafts {
        require_permission(&claims, AUTHOR_PERM)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, BlogPostListItem>(&format!(
        "SELECT {LIST_COLS} FROM blog_posts \
         WHERE ($1 OR status = 'published') \
         ORDER BY COALESCE(published_at, created_at) DESC LIMIT 200"
    ))
    .bind(include_drafts)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/blog/{id}` — a single post (drafts only visible to authors).
pub async fn get_blog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BlogPost>, AppError> {
    require_permission(&claims, READ_PERM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let post = sqlx::query_as::<_, BlogPost>(&format!(
        "SELECT {SELECT_COLS} FROM blog_posts WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    if post.status != "published" {
        require_permission(&claims, AUTHOR_PERM)?;
    }
    Ok(Json(post))
}

/// `POST /api/blog` — create a post (author only).
pub async fn create_blog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertBlogRequest>,
) -> Result<Json<BlogPost>, AppError> {
    require_permission(&claims, AUTHOR_PERM)?;
    let status = normalize_status(body.status.as_deref())?;
    let base_slug = slugify(body.slug.as_deref().unwrap_or(&body.title));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let slug = unique_slug(&mut tx, claims.tenant_id, &base_slug, None).await?;
    let author_name: Option<String> =
        sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
            .bind(claims.sub)
            .fetch_optional(&mut *tx)
            .await?;

    let post = sqlx::query_as::<_, BlogPost>(&format!(
        "INSERT INTO blog_posts \
         (tenant_id, title, slug, excerpt, body_html, cover_image_url, status, \
          author_id, author_name, published_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, \
                 CASE WHEN $7 = 'published' THEN now() ELSE NULL END, $8) \
         RETURNING {SELECT_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(&body.title)
    .bind(&slug)
    .bind(&body.excerpt)
    .bind(body.body_html.as_deref().unwrap_or(""))
    .bind(&body.cover_image_url)
    .bind(status)
    .bind(claims.sub)
    .bind(&author_name)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(post))
}

/// `PUT /api/blog/{id}` — update a post (author only). Stamps `published_at`
/// the first time it transitions to published.
pub async fn update_blog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertBlogRequest>,
) -> Result<Json<BlogPost>, AppError> {
    require_permission(&claims, AUTHOR_PERM)?;
    let status = normalize_status(body.status.as_deref())?;
    let base_slug = slugify(body.slug.as_deref().unwrap_or(&body.title));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let slug = unique_slug(&mut tx, claims.tenant_id, &base_slug, Some(id)).await?;
    let post = sqlx::query_as::<_, BlogPost>(&format!(
        "UPDATE blog_posts SET \
           title = $2, slug = $3, excerpt = $4, body_html = $5, cover_image_url = $6, \
           status = $7, \
           published_at = CASE \
             WHEN $7 = 'published' AND published_at IS NULL THEN now() \
             WHEN $7 <> 'published' THEN NULL \
             ELSE published_at END \
         WHERE id = $1 \
         RETURNING {SELECT_COLS}"
    ))
    .bind(id)
    .bind(&body.title)
    .bind(&slug)
    .bind(&body.excerpt)
    .bind(body.body_html.as_deref().unwrap_or(""))
    .bind(&body.cover_image_url)
    .bind(status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(post))
}

/// `DELETE /api/blog/{id}` — delete a post (author only).
pub async fn delete_blog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, AUTHOR_PERM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let affected = sqlx::query("DELETE FROM blog_posts WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    tx.commit().await?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
