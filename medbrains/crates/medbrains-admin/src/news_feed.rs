//! Medical news feed — global public content in `news_feed_articles`, ingested
//! by the newspaper4k worker. Distinct from `news.rs` (tenant-scoped internal
//! advisories on `/api/news`). Not tenant-scoped, so queried via the pool
//! directly (no RLS / tenant context). List + full-text search + full article.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{error::AppError, state::AppState};

// Full article incl. `content` (body text) — for the single-article reader only.
const DETAIL_COLS: &str = "id, topic, source, title, summary, content, url, image_url, author, \
                           published_at";
// List rows omit `content`: cards show title/summary/image. Shipping the full
// body for every row blew a 100-article feed to ~65 KB raw (#167 field projection).
const LIST_COLS: &str = "id, topic, source, title, summary, url, image_url, author, published_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NewsFeedArticle {
    pub id: Uuid,
    pub topic: String,
    pub source: String,
    pub title: String,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub url: String,
    pub image_url: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
}

/// List row — the reader's `content` is fetched on demand via the detail route.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NewsFeedListItem {
    pub id: Uuid,
    pub topic: String,
    pub source: String,
    pub title: String,
    pub summary: Option<String>,
    pub url: String,
    pub image_url: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct NewsFeedQuery {
    /// Filter by role topic, e.g. "Clinical medicine".
    pub topic: Option<String>,
    /// Full-text search across title + summary + content.
    pub q: Option<String>,
    pub limit: Option<i64>,
}

/// `GET /api/news-feed` — latest articles for a topic, or full-text search across all.
pub async fn list_news_feed(
    State(state): State<AppState>,
    Query(params): Query<NewsFeedQuery>,
) -> Result<Json<Vec<NewsFeedListItem>>, AppError> {
    let limit = params.limit.unwrap_or(20).clamp(1, 100);
    let search = params
        .q
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let rows = sqlx::query_as::<_, NewsFeedListItem>(&format!(
        // The same article lives under several topic feeds, so dedupe by URL
        // (keep the most recent copy) before ranking/ordering.
        "SELECT {LIST_COLS} FROM ( \
           SELECT DISTINCT ON (url) {LIST_COLS}, search_tsv \
           FROM news_feed_articles \
           WHERE ($1::text IS NULL OR topic = $1) \
             AND ($2::text IS NULL OR search_tsv @@ websearch_to_tsquery('english', $2)) \
           ORDER BY url, published_at DESC NULLS LAST \
         ) d \
         ORDER BY \
           CASE WHEN $2::text IS NULL THEN 0::float4 \
                ELSE ts_rank(d.search_tsv, websearch_to_tsquery('english', $2)) END DESC, \
           d.published_at DESC NULLS LAST \
         LIMIT $3"
    ))
    .bind(params.topic)
    .bind(search)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

/// `GET /api/news-feed/{id}` — a single article with full text for the reader view.
pub async fn get_news_feed_article(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<NewsFeedArticle>, AppError> {
    let row = sqlx::query_as::<_, NewsFeedArticle>(&format!(
        "SELECT {DETAIL_COLS} FROM news_feed_articles WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}
