//! CMS & Blog types.
//!
//! This module provides types for:
//! - Blog posts with workflow
//! - Categories (hierarchical)
//! - Tags
//! - Media library
//! - Authors
//! - Subscribers
//! - Static pages
//! - Site settings

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Post Status ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "cms_post_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CmsPostStatus {
    #[default]
    Draft,
    PendingReview,
    PendingMedicalReview,
    Approved,
    Published,
    Scheduled,
    Archived,
}

// ── Content Type ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "cms_content_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CmsContentType {
    #[default]
    Article,
    QuickPost,
    Opinion,
    CaseStudy,
    News,
    Event,
    Announcement,
}

// ── Categories ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsCategory {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub requires_medical_review: bool,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsCategoryWithChildren {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub requires_medical_review: bool,
    pub sort_order: i32,
    pub is_active: bool,
    pub children: Vec<CmsCategoryWithChildren>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsCategory {
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub requires_medical_review: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsCategory {
    pub parent_id: Option<Uuid>,
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub requires_medical_review: Option<bool>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

// ── Tags ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsTag {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsTag {
    pub name: String,
    pub slug: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsTag {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
}

// ── Authors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsAuthor {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub name: String,
    pub slug: String,
    pub bio: Option<String>,
    pub credentials: Option<String>,
    pub designation: Option<String>,
    pub avatar_url: Option<String>,
    pub website: Option<String>,
    pub twitter: Option<String>,
    pub linkedin: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsAuthor {
    pub user_id: Option<Uuid>,
    pub name: String,
    pub slug: Option<String>,
    pub bio: Option<String>,
    pub credentials: Option<String>,
    pub designation: Option<String>,
    pub avatar_url: Option<String>,
    pub website: Option<String>,
    pub twitter: Option<String>,
    pub linkedin: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsAuthor {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub bio: Option<String>,
    pub credentials: Option<String>,
    pub designation: Option<String>,
    pub avatar_url: Option<String>,
    pub website: Option<String>,
    pub twitter: Option<String>,
    pub linkedin: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<bool>,
}

// ── Media Library ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsMedia {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub filename: String,
    pub original_name: String,
    pub mime_type: String,
    pub file_size: i64,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub alt_text: Option<String>,
    pub caption: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsMedia {
    pub filename: String,
    pub original_name: String,
    pub mime_type: String,
    pub file_size: i64,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub alt_text: Option<String>,
    pub caption: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsMedia {
    pub alt_text: Option<String>,
    pub caption: Option<String>,
}

// ── Posts ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsPost {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub author_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub content_type: CmsContentType,
    pub feature_image_id: Option<Uuid>,
    pub feature_image_alt: Option<String>,
    pub feature_image_caption: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub og_image_id: Option<Uuid>,
    pub canonical_url: Option<String>,
    pub status: CmsPostStatus,
    pub is_featured: bool,
    pub reading_time_minutes: Option<i32>,
    pub published_at: Option<DateTime<Utc>>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub submitted_for_review_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_notes: Option<String>,
    pub medical_reviewed_by: Option<Uuid>,
    pub medical_reviewed_at: Option<DateTime<Utc>>,
    pub medical_review_notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Post with author and category names for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPostSummary {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content_type: CmsContentType,
    pub status: CmsPostStatus,
    pub is_featured: bool,
    pub reading_time_minutes: Option<i32>,
    pub feature_image_url: Option<String>,
    pub author_name: String,
    pub category_name: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Full post with all relations for detail view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPostDetail {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub content_type: CmsContentType,
    pub status: CmsPostStatus,
    pub is_featured: bool,
    pub reading_time_minutes: Option<i32>,
    pub feature_image: Option<CmsMedia>,
    pub og_image: Option<CmsMedia>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub canonical_url: Option<String>,
    pub author: CmsAuthor,
    pub category: Option<CmsCategory>,
    pub tags: Vec<CmsTag>,
    pub published_at: Option<DateTime<Utc>>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsPost {
    pub author_id: Uuid,
    pub category_id: Option<Uuid>,
    pub title: String,
    pub slug: Option<String>,
    pub excerpt: Option<String>,
    pub content: String,
    pub content_type: Option<CmsContentType>,
    pub feature_image_id: Option<Uuid>,
    pub feature_image_alt: Option<String>,
    pub feature_image_caption: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub og_image_id: Option<Uuid>,
    pub canonical_url: Option<String>,
    pub is_featured: Option<bool>,
    pub tag_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsPost {
    pub category_id: Option<Uuid>,
    pub title: Option<String>,
    pub slug: Option<String>,
    pub excerpt: Option<String>,
    pub content: Option<String>,
    pub content_type: Option<CmsContentType>,
    pub feature_image_id: Option<Uuid>,
    pub feature_image_alt: Option<String>,
    pub feature_image_caption: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub og_image_id: Option<Uuid>,
    pub canonical_url: Option<String>,
    pub is_featured: Option<bool>,
    pub tag_ids: Option<Vec<Uuid>>,
}

// ── Post Workflow ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitPostForReview {
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewPostAction {
    pub action: ReviewAction,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewAction {
    Approve,
    Reject,
    RequestChanges,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulePostRequest {
    pub scheduled_at: DateTime<Utc>,
}

// ── Post Revisions ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsPostRevision {
    pub id: Uuid,
    pub post_id: Uuid,
    pub revision_number: i32,
    pub title: String,
    pub content: String,
    pub excerpt: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ── Post Analytics ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPostAnalytics {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub status: CmsPostStatus,
    pub published_at: Option<DateTime<Utc>>,
    pub author_name: String,
    pub category_name: Option<String>,
    pub total_views: i64,
    pub days_with_views: i64,
    pub last_viewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsDashboardStats {
    pub total_posts: i64,
    pub published_posts: i64,
    pub draft_posts: i64,
    pub total_views: i64,
    pub total_subscribers: i64,
    pub active_subscribers: i64,
    pub top_posts: Vec<CmsPostAnalytics>,
}

// ── Subscribers ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsSubscriber {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub status: String,
    pub confirmation_token: Option<String>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub unsubscribed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsSubscriber {
    pub email: String,
    pub name: Option<String>,
}

// ── Static Pages ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsPage {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub template: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub is_published: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCmsPage {
    pub title: String,
    pub slug: Option<String>,
    pub content: String,
    pub template: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub is_published: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsPage {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub content: Option<String>,
    pub template: Option<String>,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub is_published: Option<bool>,
    pub sort_order: Option<i32>,
}

// ── Site Settings ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsSettings {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub site_title: Option<String>,
    pub site_tagline: Option<String>,
    pub site_description: Option<String>,
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub twitter_handle: Option<String>,
    pub facebook_url: Option<String>,
    pub instagram_url: Option<String>,
    pub youtube_url: Option<String>,
    pub linkedin_url: Option<String>,
    pub default_meta_title: Option<String>,
    pub default_meta_description: Option<String>,
    pub google_analytics_id: Option<String>,
    pub posts_per_page: i32,
    pub show_author_bio: bool,
    pub enable_comments: bool,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub custom_css: Option<String>,
    pub custom_js: Option<String>,
    pub custom_head: Option<String>,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsSettings {
    pub site_title: Option<String>,
    pub site_tagline: Option<String>,
    pub site_description: Option<String>,
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub twitter_handle: Option<String>,
    pub facebook_url: Option<String>,
    pub instagram_url: Option<String>,
    pub youtube_url: Option<String>,
    pub linkedin_url: Option<String>,
    pub default_meta_title: Option<String>,
    pub default_meta_description: Option<String>,
    pub google_analytics_id: Option<String>,
    pub posts_per_page: Option<i32>,
    pub show_author_bio: Option<bool>,
    pub enable_comments: Option<bool>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub custom_css: Option<String>,
    pub custom_js: Option<String>,
    pub custom_head: Option<String>,
}

// ── Menus ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CmsMenu {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub location: String,
    pub items: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsMenuItem {
    pub id: String,
    pub label: String,
    pub url: Option<String>,
    pub page_id: Option<Uuid>,
    pub target: Option<String>,
    pub children: Vec<CmsMenuItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCmsMenu {
    pub name: Option<String>,
    pub items: Option<Vec<CmsMenuItem>>,
}

// ── Public API Types ─────────────────────────────────────────────────────────

/// Public post for website display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPublicPost {
    pub id: Uuid,
    pub title: String,
    pub slug: String,
    pub excerpt: Option<String>,
    pub content: String,
    pub content_type: CmsContentType,
    pub reading_time_minutes: Option<i32>,
    pub feature_image_url: Option<String>,
    pub feature_image_alt: Option<String>,
    pub author: CmsPublicAuthor,
    pub category: Option<CmsPublicCategory>,
    pub tags: Vec<CmsPublicTag>,
    pub published_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPublicAuthor {
    pub name: String,
    pub slug: String,
    pub bio: Option<String>,
    pub credentials: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPublicCategory {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPublicTag {
    pub name: String,
    pub slug: String,
}

/// Public page listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmsPostList {
    pub posts: Vec<CmsPublicPost>,
    pub total: i64,
    pub page: i32,
    pub per_page: i32,
    pub total_pages: i32,
}
