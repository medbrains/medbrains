//! Hospital micro-site module. Ticket #2953: health packages / promotions catalog + booking.
//! Booking a package auto-charges its price (reusing the billing seam) so the patient can settle
//! it online. Gated by the `specialty.health_packages.*` permission.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{get,post,put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const HP_COLS: &str = "id, name, description, price, includes, category, is_active, is_promoted, \
     valid_until, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HealthPackage {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub includes: Option<String>,
    pub category: Option<String>,
    pub is_active: bool,
    pub is_promoted: bool,
    pub valid_until: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct PackageQuery {
    pub active_only: Option<bool>,
}

/// `GET /api/microsite/packages?active_only=` — the health-package catalog.
pub async fn list_health_packages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PackageQuery>,
) -> Result<Json<Vec<HealthPackage>>, AppError> {
    require_permission(&claims, "specialty.health_packages.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HealthPackage>(&format!(
        "SELECT {HP_COLS} FROM health_packages \
         WHERE tenant_id = $1 AND ($2::bool IS NOT TRUE OR is_active = true) \
         ORDER BY is_promoted DESC, name LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.active_only)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertPackageRequest {
    pub name: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub includes: Option<String>,
    pub category: Option<String>,
    pub is_active: Option<bool>,
    pub is_promoted: Option<bool>,
    pub valid_until: Option<NaiveDate>,
}

/// `POST /api/microsite/packages` — create a health package.
pub async fn create_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertPackageRequest>,
) -> Result<Json<HealthPackage>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Package name is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HealthPackage>(&format!(
        "INSERT INTO health_packages \
         (tenant_id, name, description, price, includes, category, is_active, is_promoted, valid_until) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), COALESCE($8, false), $9) \
         RETURNING {HP_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.description)
    .bind(body.price)
    .bind(&body.includes)
    .bind(&body.category)
    .bind(body.is_active)
    .bind(body.is_promoted)
    .bind(body.valid_until)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/microsite/packages/{id}` — update a health package.
pub async fn update_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertPackageRequest>,
) -> Result<Json<HealthPackage>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, HealthPackage>(&format!(
        "UPDATE health_packages SET name = $3, description = $4, price = $5, includes = $6, \
            category = $7, is_active = COALESCE($8, is_active), \
            is_promoted = COALESCE($9, is_promoted), valid_until = $10, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {HP_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.description)
    .bind(body.price)
    .bind(&body.includes)
    .bind(&body.category)
    .bind(body.is_active)
    .bind(body.is_promoted)
    .bind(body.valid_until)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/microsite/packages/{id}` — deactivate a package (soft).
pub async fn delete_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query_scalar::<_, Uuid>(
        "UPDATE health_packages SET is_active = false, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING id",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deactivated": done })))
}

#[derive(Debug, Deserialize)]
pub struct BookPackageRequest {
    pub patient_id: Uuid,
}

/// `POST /api/microsite/packages/{id}/book` — book a package for a patient; auto-charges the price
/// so it can be paid online. Returns the booking + the payable invoice.
pub async fn book_health_package(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<BookPackageRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pkg = sqlx::query_as::<_, (String, Decimal, bool)>(
        "SELECT name, price, is_active FROM health_packages WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if !pkg.2 {
        return Err(AppError::BadRequest("Package is not active".to_owned()));
    }

    let booking_id: Uuid = sqlx::query_scalar(
        "INSERT INTO health_package_bookings (tenant_id, package_id, patient_id, booked_by) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let charge = medbrains_server_services::billing::auto_charge(
        &mut tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id: body.patient_id,
            encounter_id: None,
            charge_code: "HEALTH_PKG".to_owned(),
            source: "procedure".to_owned(),
            source_id: booking_id,
            quantity: 1,
            description_override: Some(pkg.0),
            unit_price_override: Some(pkg.1),
            tax_percent_override: None,
        },
    )
    .await?;

    sqlx::query("UPDATE health_package_bookings SET invoice_id = $2 WHERE id = $1")
        .bind(booking_id)
        .bind(charge.invoice_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(
        serde_json::json!({ "booking_id": booking_id, "invoice_id": charge.invoice_id }),
    ))
}

// ── Patient testimonials / reviews (#2954) ─────────────────────────────────

const TESTIMONIAL_COLS: &str = "id, patient_name, rating, service, body, is_approved, \
     is_published, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Testimonial {
    pub id: Uuid,
    pub patient_name: String,
    pub rating: i32,
    pub service: Option<String>,
    pub body: String,
    pub is_approved: bool,
    pub is_published: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct TestimonialQuery {
    pub published_only: Option<bool>,
}

/// `GET /api/microsite/testimonials?published_only=` — testimonials (all, or the published set).
pub async fn list_testimonials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TestimonialQuery>,
) -> Result<Json<Vec<Testimonial>>, AppError> {
    require_permission(&claims, "specialty.health_packages.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Testimonial>(&format!(
        "SELECT {TESTIMONIAL_COLS} FROM testimonials \
         WHERE tenant_id = $1 AND ($2::bool IS NOT TRUE OR is_published = true) \
         ORDER BY created_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.published_only)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateTestimonialRequest {
    pub patient_name: String,
    pub rating: i32,
    pub service: Option<String>,
    pub body: String,
}

/// `POST /api/microsite/testimonials` — submit a testimonial (unapproved).
pub async fn create_testimonial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTestimonialRequest>,
) -> Result<Json<Testimonial>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    if body.patient_name.trim().is_empty() || body.body.trim().is_empty() {
        return Err(AppError::BadRequest("Name and review text are required".to_owned()));
    }
    if !(1..=5).contains(&body.rating) {
        return Err(AppError::BadRequest("Rating must be 1-5".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Testimonial>(&format!(
        "INSERT INTO testimonials (tenant_id, patient_name, rating, service, body) \
         VALUES ($1, $2, $3, $4, $5) RETURNING {TESTIMONIAL_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_name.trim())
    .bind(body.rating)
    .bind(&body.service)
    .bind(body.body.trim())
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ModerateTestimonialRequest {
    pub is_approved: Option<bool>,
    pub is_published: Option<bool>,
}

/// `PUT /api/microsite/testimonials/{id}` — moderate: approve / publish a testimonial.
pub async fn moderate_testimonial(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ModerateTestimonialRequest>,
) -> Result<Json<Testimonial>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Testimonial>(&format!(
        "UPDATE testimonials SET is_approved = COALESCE($3, is_approved), \
            is_published = COALESCE($4, is_published), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {TESTIMONIAL_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.is_approved)
    .bind(body.is_published)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── SEO settings (#2955) ───────────────────────────────────────────────────

const SEO_COLS: &str = "id, page_slug, meta_title, meta_description, keywords, og_image_url, \
     schema_markup, created_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SeoSetting {
    pub id: Uuid,
    pub page_slug: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub keywords: Option<String>,
    pub og_image_url: Option<String>,
    pub schema_markup: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/microsite/seo` — per-page SEO metadata.
pub async fn list_seo_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SeoSetting>>, AppError> {
    require_permission(&claims, "specialty.health_packages.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SeoSetting>(&format!(
        "SELECT {SEO_COLS} FROM seo_settings WHERE tenant_id = $1 ORDER BY page_slug LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertSeoRequest {
    pub page_slug: String,
    pub meta_title: Option<String>,
    pub meta_description: Option<String>,
    pub keywords: Option<String>,
    pub og_image_url: Option<String>,
    pub schema_markup: Option<serde_json::Value>,
}

/// `POST /api/microsite/seo` — create or update a page's SEO metadata.
pub async fn upsert_seo_setting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertSeoRequest>,
) -> Result<Json<SeoSetting>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    if body.page_slug.trim().is_empty() {
        return Err(AppError::BadRequest("Page slug is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SeoSetting>(&format!(
        "INSERT INTO seo_settings \
         (tenant_id, page_slug, meta_title, meta_description, keywords, og_image_url, schema_markup) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '{{}}'::jsonb)) \
         ON CONFLICT (tenant_id, page_slug) DO UPDATE SET meta_title = EXCLUDED.meta_title, \
            meta_description = EXCLUDED.meta_description, keywords = EXCLUDED.keywords, \
            og_image_url = EXCLUDED.og_image_url, schema_markup = EXCLUDED.schema_markup, \
            updated_at = now() \
         RETURNING {SEO_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.page_slug.trim())
    .bind(&body.meta_title)
    .bind(&body.meta_description)
    .bind(&body.keywords)
    .bind(&body.og_image_url)
    .bind(&body.schema_markup)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Custom domains (#2956) ─────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SiteDomain {
    pub id: Uuid,
    pub domain: String,
    pub is_primary: bool,
    pub is_verified: bool,
    pub verification_token: Option<String>,
    pub created_at: DateTime<Utc>,
}

const DOMAIN_COLS: &str =
    "id, domain, is_primary, is_verified, verification_token, created_at";

/// `GET /api/microsite/domains` — mapped custom domains.
pub async fn list_site_domains(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SiteDomain>>, AppError> {
    require_permission(&claims, "specialty.health_packages.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SiteDomain>(&format!(
        "SELECT {DOMAIN_COLS} FROM site_domains WHERE tenant_id = $1 ORDER BY is_primary DESC, domain"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AddDomainRequest {
    pub domain: String,
    pub is_primary: Option<bool>,
}

/// `POST /api/microsite/domains` — map a custom domain (a verification token is issued).
pub async fn add_site_domain(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddDomainRequest>,
) -> Result<Json<SiteDomain>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    if body.domain.trim().is_empty() {
        return Err(AppError::BadRequest("Domain is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SiteDomain>(&format!(
        "INSERT INTO site_domains (tenant_id, domain, is_primary, verification_token) \
         VALUES ($1, $2, COALESCE($3, false), 'mb-verify-' || gen_random_uuid()::text) \
         RETURNING {DOMAIN_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.domain.trim())
    .bind(body.is_primary)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/microsite/domains/{id}/verify` — mark a domain verified (DNS check is ops).
pub async fn verify_site_domain(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SiteDomain>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SiteDomain>(&format!(
        "UPDATE site_domains SET is_verified = true, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING {DOMAIN_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Chat / WhatsApp widget config (#2959) ──────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MicrositeConfig {
    pub whatsapp_number: Option<String>,
    pub whatsapp_enabled: bool,
    pub chat_widget_enabled: bool,
    pub chat_greeting: Option<String>,
}

/// `GET /api/microsite/config` — the chat/WhatsApp widget config (defaults if unset).
pub async fn get_microsite_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MicrositeConfig>, AppError> {
    require_permission(&claims, "specialty.health_packages.list")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MicrositeConfig>(
        "SELECT whatsapp_number, whatsapp_enabled, chat_widget_enabled, chat_greeting \
         FROM microsite_config WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(MicrositeConfig {
        whatsapp_number: None,
        whatsapp_enabled: false,
        chat_widget_enabled: false,
        chat_greeting: None,
    });
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub whatsapp_number: Option<String>,
    pub whatsapp_enabled: bool,
    pub chat_widget_enabled: bool,
    pub chat_greeting: Option<String>,
}

/// `PUT /api/microsite/config` — set the chat/WhatsApp widget config.
pub async fn update_microsite_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateConfigRequest>,
) -> Result<Json<MicrositeConfig>, AppError> {
    require_permission(&claims, "specialty.health_packages.manage")?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, MicrositeConfig>(
        "INSERT INTO microsite_config \
         (tenant_id, whatsapp_number, whatsapp_enabled, chat_widget_enabled, chat_greeting) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (tenant_id) DO UPDATE SET whatsapp_number = EXCLUDED.whatsapp_number, \
            whatsapp_enabled = EXCLUDED.whatsapp_enabled, \
            chat_widget_enabled = EXCLUDED.chat_widget_enabled, \
            chat_greeting = EXCLUDED.chat_greeting, updated_at = now() \
         RETURNING whatsapp_number, whatsapp_enabled, chat_widget_enabled, chat_greeting",
    )
    .bind(claims.tenant_id)
    .bind(&body.whatsapp_number)
    .bind(body.whatsapp_enabled)
    .bind(body.chat_widget_enabled)
    .bind(&body.chat_greeting)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Public microsite health packages routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/microsite/packages",
            get(list_health_packages).post(create_health_package),
        )
        .route(
            "/api/microsite/packages/{id}",
            put(update_health_package).delete(delete_health_package),
        )
        .route(
            "/api/microsite/packages/{id}/book",
            post(book_health_package),
        )
        .route(
            "/api/microsite/testimonials",
            get(list_testimonials).post(create_testimonial),
        )
        .route(
            "/api/microsite/testimonials/{id}",
            put(moderate_testimonial),
        )
        .route(
            "/api/microsite/seo",
            get(list_seo_settings).post(upsert_seo_setting),
        )
        .route(
            "/api/microsite/domains",
            get(list_site_domains).post(add_site_domain),
        )
        .route(
            "/api/microsite/domains/{id}/verify",
            post(verify_site_domain),
        )
        .route(
            "/api/microsite/config",
            get(get_microsite_config).put(update_microsite_config),
        )
}
