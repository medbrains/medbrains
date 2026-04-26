//! CMS & Blog routes.
//!
//! Provides endpoints for:
//! - Blog posts (CRUD, workflow, scheduling)
//! - Categories (hierarchical)
//! - Tags
//! - Media library
//! - Authors
//! - Subscribers
//! - Static pages
//! - Site settings
//! - Public API

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use medbrains_core::cms::{
    CmsAuthor, CmsCategory, CmsCategoryWithChildren, CmsDashboardStats, CmsMedia, CmsMenu, CmsPage,
    CmsPost, CmsPostAnalytics, CmsPostDetail, CmsPostList, CmsPostRevision, CmsPostSummary,
    CmsPublicPost, CmsSettings, CmsSubscriber, CmsTag, CreateCmsAuthor, CreateCmsCategory,
    CreateCmsMedia, CreateCmsPage, CreateCmsPost, CreateCmsSubscriber, CreateCmsTag,
    ReviewPostAction, SchedulePostRequest, SubmitPostForReview, UpdateCmsAuthor, UpdateCmsCategory,
    UpdateCmsMedia, UpdateCmsMenu, UpdateCmsPage, UpdateCmsPost, UpdateCmsSettings, UpdateCmsTag,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{middleware::auth::Claims, state::AppState};

// ── Query Parameters ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PostListQuery {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
    pub status: Option<String>,
    pub category_id: Option<Uuid>,
    pub author_id: Option<Uuid>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PublicPostQuery {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
    pub category: Option<String>,
    pub tag: Option<String>,
    pub author: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MediaListQuery {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubscriberListQuery {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
    pub status: Option<String>,
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

/// Get CMS dashboard statistics
pub async fn get_dashboard_stats(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<CmsDashboardStats>, (StatusCode, String)> {
    // TODO: Query aggregated stats
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Categories ───────────────────────────────────────────────────────────────

/// List categories (flat)
pub async fn list_categories(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsCategory>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// List categories (tree structure)
pub async fn list_categories_tree(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsCategoryWithChildren>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// Get category by ID
pub async fn get_category(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsCategory>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Category not found".to_string()))
}

/// Create category
pub async fn create_category(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCmsCategory>,
) -> Result<Json<CmsCategory>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update category
pub async fn update_category(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCmsCategory>,
) -> Result<Json<CmsCategory>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete category
pub async fn delete_category(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

// ── Tags ─────────────────────────────────────────────────────────────────────

/// List tags
pub async fn list_tags(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsTag>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// Get tag by ID
pub async fn get_tag(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsTag>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Tag not found".to_string()))
}

/// Create tag
pub async fn create_tag(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCmsTag>,
) -> Result<Json<CmsTag>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update tag
pub async fn update_tag(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCmsTag>,
) -> Result<Json<CmsTag>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete tag
pub async fn delete_tag(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

/// Bulk delete tags
pub async fn bulk_delete_tags(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(ids): Json<Vec<Uuid>>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = ids;
    Ok(StatusCode::NO_CONTENT)
}

// ── Authors ──────────────────────────────────────────────────────────────────

/// List authors
pub async fn list_authors(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsAuthor>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// Get author by ID
pub async fn get_author(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsAuthor>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Author not found".to_string()))
}

/// Create author
pub async fn create_author(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCmsAuthor>,
) -> Result<Json<CmsAuthor>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update author
pub async fn update_author(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCmsAuthor>,
) -> Result<Json<CmsAuthor>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete author
pub async fn delete_author(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

// ── Media Library ────────────────────────────────────────────────────────────

/// List media
pub async fn list_media(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<MediaListQuery>,
) -> Result<Json<Vec<CmsMedia>>, (StatusCode, String)> {
    let _ = query;
    Ok(Json(vec![]))
}

/// Get media by ID
pub async fn get_media(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsMedia>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Media not found".to_string()))
}

/// Create media (upload)
pub async fn create_media(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCmsMedia>,
) -> Result<Json<CmsMedia>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update media metadata
pub async fn update_media(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCmsMedia>,
) -> Result<Json<CmsMedia>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete media
pub async fn delete_media(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

// ── Posts ────────────────────────────────────────────────────────────────────

/// List posts (admin)
pub async fn list_posts(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<PostListQuery>,
) -> Result<Json<Vec<CmsPostSummary>>, (StatusCode, String)> {
    let _ = query;
    Ok(Json(vec![]))
}

/// Get post by ID (admin)
pub async fn get_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsPostDetail>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Post not found".to_string()))
}

/// Create post
pub async fn create_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCmsPost>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update post
pub async fn update_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCmsPost>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete post
pub async fn delete_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

// ── Post Workflow ────────────────────────────────────────────────────────────

/// Submit post for review
pub async fn submit_post_for_review(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SubmitPostForReview>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Review post (approve/reject)
pub async fn review_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReviewPostAction>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Medical review post
pub async fn medical_review_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReviewPostAction>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Publish post
pub async fn publish_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Schedule post for future publication
pub async fn schedule_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SchedulePostRequest>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Archive post
pub async fn archive_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Unarchive post
pub async fn unarchive_post(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Post Revisions ───────────────────────────────────────────────────────────

/// List post revisions
pub async fn list_post_revisions(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(post_id): Path<Uuid>,
) -> Result<Json<Vec<CmsPostRevision>>, (StatusCode, String)> {
    let _ = post_id;
    Ok(Json(vec![]))
}

/// Get specific revision
pub async fn get_post_revision(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((post_id, revision_number)): Path<(Uuid, i32)>,
) -> Result<Json<CmsPostRevision>, (StatusCode, String)> {
    let _ = (post_id, revision_number);
    Err((StatusCode::NOT_FOUND, "Revision not found".to_string()))
}

/// Restore revision
pub async fn restore_post_revision(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((post_id, revision_number)): Path<(Uuid, i32)>,
) -> Result<Json<CmsPost>, (StatusCode, String)> {
    let _ = (post_id, revision_number);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Post Analytics ───────────────────────────────────────────────────────────

/// Get post analytics
pub async fn get_post_analytics(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsPostAnalytics>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Post not found".to_string()))
}

/// List top posts
pub async fn list_top_posts(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsPostAnalytics>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

// ── Subscribers ──────────────────────────────────────────────────────────────

/// List subscribers
pub async fn list_subscribers(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<SubscriberListQuery>,
) -> Result<Json<Vec<CmsSubscriber>>, (StatusCode, String)> {
    let _ = query;
    Ok(Json(vec![]))
}

/// Get subscriber by ID
pub async fn get_subscriber(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsSubscriber>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Subscriber not found".to_string()))
}

/// Delete subscriber
pub async fn delete_subscriber(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

/// Export subscribers to CSV
pub async fn export_subscribers(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<String, (StatusCode, String)> {
    // TODO: Generate CSV
    Ok("email,name,status,created_at\n".to_string())
}

// ── Static Pages ─────────────────────────────────────────────────────────────

/// List pages
pub async fn list_pages(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsPage>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// Get page by ID
pub async fn get_page(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CmsPage>, (StatusCode, String)> {
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Page not found".to_string()))
}

/// Create page
pub async fn create_page(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCmsPage>,
) -> Result<Json<CmsPage>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update page
pub async fn update_page(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCmsPage>,
) -> Result<Json<CmsPage>, (StatusCode, String)> {
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete page
pub async fn delete_page(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

// ── Site Settings ────────────────────────────────────────────────────────────

/// Get site settings
pub async fn get_settings(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<CmsSettings>, (StatusCode, String)> {
    Err((StatusCode::NOT_FOUND, "Settings not found".to_string()))
}

/// Update site settings
pub async fn update_settings(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<UpdateCmsSettings>,
) -> Result<Json<CmsSettings>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Menus ────────────────────────────────────────────────────────────────────

/// List menus
pub async fn list_menus(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<CmsMenu>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// Get menu by location
pub async fn get_menu(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(location): Path<String>,
) -> Result<Json<CmsMenu>, (StatusCode, String)> {
    let _ = location;
    Err((StatusCode::NOT_FOUND, "Menu not found".to_string()))
}

/// Update menu
pub async fn update_menu(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(location): Path<String>,
    Json(payload): Json<UpdateCmsMenu>,
) -> Result<Json<CmsMenu>, (StatusCode, String)> {
    let _ = (location, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Public API (no auth required) ────────────────────────────────────────────

/// List published posts (public)
pub async fn public_list_posts(
    State(_state): State<AppState>,
    Query(query): Query<PublicPostQuery>,
) -> Result<Json<CmsPostList>, (StatusCode, String)> {
    let _ = query;
    Ok(Json(CmsPostList {
        posts: vec![],
        total: 0,
        page: 1,
        per_page: 10,
        total_pages: 0,
    }))
}

/// Get published post by slug (public)
pub async fn public_get_post(
    State(_state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<CmsPublicPost>, (StatusCode, String)> {
    let _ = slug;
    Err((StatusCode::NOT_FOUND, "Post not found".to_string()))
}

/// Get featured posts (public)
pub async fn public_featured_posts(
    State(_state): State<AppState>,
) -> Result<Json<Vec<CmsPublicPost>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

/// Subscribe to newsletter (public)
pub async fn public_subscribe(
    State(_state): State<AppState>,
    Json(payload): Json<CreateCmsSubscriber>,
) -> Result<Json<CmsSubscriber>, (StatusCode, String)> {
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Confirm subscription (public)
pub async fn public_confirm_subscription(
    State(_state): State<AppState>,
    Path(token): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = token;
    Ok(StatusCode::OK)
}

/// Unsubscribe (public)
pub async fn public_unsubscribe(
    State(_state): State<AppState>,
    Path(token): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = token;
    Ok(StatusCode::OK)
}

/// Record post view (public)
pub async fn public_record_view(
    State(_state): State<AppState>,
    Path(post_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let _ = post_id;
    Ok(StatusCode::OK)
}

/// Get public page by slug
pub async fn public_get_page(
    State(_state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<CmsPage>, (StatusCode, String)> {
    let _ = slug;
    Err((StatusCode::NOT_FOUND, "Page not found".to_string()))
}
