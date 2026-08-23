//! Server-side document rendering API (epic #267).
//!
//! POST /api/documents/render — bind live data into an HTML template
//! (Tera), render to PDF via Gotenberg, store to S3, record in
//! `document_outputs`, return a presigned download URL. Tenant rows in
//! `document_templates` override the built-in system templates.

use axum::routing::{get,post,put};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::header,
    response::IntoResponse,
};
use medbrains_print::paper::{MarginsMm, Paper};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use medbrains_core::permissions;

mod templates;
pub(crate) use templates::{SYSTEM_TEMPLATES, SystemTemplate};

#[derive(Debug, Deserialize)]
pub struct RenderRequest {
    pub template_code: String,
    pub source_id: Uuid,
    pub watermark: Option<String>,
}

fn renderer(state: &AppState) -> Result<&medbrains_print::gotenberg::GotenbergClient, AppError> {
    state.gotenberg.as_ref().ok_or_else(|| {
        AppError::ServiceUnavailable(
            "PDF rendering is not configured (GOTENBERG_URL unset)".to_owned(),
        )
    })
}

/// Resolve template HTML + geometry: tenant override from
/// `document_templates` (body_layout.html) else the built-in.
async fn resolve_template(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    code: &str,
) -> Result<(String, Paper, MarginsMm), AppError> {
    let builtin = SYSTEM_TEMPLATES
        .iter()
        .find(|t| t.code == code)
        .ok_or_else(|| AppError::BadRequest(format!("unknown template_code '{code}'")))?;

    let tenant_override: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT body_layout FROM document_templates \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true \
         ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?;

    let html = tenant_override
        .as_ref()
        .and_then(|v| v.get("html"))
        .and_then(serde_json::Value::as_str)
        .map_or_else(|| builtin.html.to_owned(), str::to_owned);

    Ok((html, builtin.paper, builtin.margins))
}

/// Tenant branding for the letterhead, from the tenants row + the
/// letterhead print-template settings.
async fn branding_context(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<serde_json::Value, AppError> {
    #[derive(Default, sqlx::FromRow)]
    struct TenantRow {
        name: String,
        address_line1: Option<String>,
        phone: Option<String>,
        registration_no: Option<String>,
    }
    let tenant: Option<TenantRow> = sqlx::query_as(
        "SELECT name, address_line1, phone, registration_no FROM tenants WHERE id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let letterhead: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'print_templates' AND key = 'letterhead'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let tenant = tenant.unwrap_or_default();
    let mut branding = serde_json::json!({
        "hospital_name": tenant.name,
        "address": tenant.address_line1,
        "phone": tenant.phone,
        "registration_no": tenant.registration_no,
    });
    if let Some(serde_json::Value::Object(extra)) = letterhead {
        if let Some(obj) = branding.as_object_mut() {
            for (k, v) in extra {
                obj.insert(k, v);
            }
        }
    }
    Ok(branding)
}

/// Allocate a document number and persist the output row.
#[allow(clippy::too_many_arguments)]
async fn record_output(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    template: &SystemTemplate,
    source_id: Uuid,
    patient_id: Option<Uuid>,
    file_key: &str,
    pdf: &[u8],
    context: &serde_json::Value,
    watermark: &str,
) -> Result<Uuid, AppError> {
    let today = chrono::Utc::now().format("%Y%m%d").to_string();
    let prefix = template.number_prefix;
    let day_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM document_outputs \
         WHERE tenant_id = $1 AND document_number LIKE $2 || '-' || $3 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(prefix)
    .bind(&today)
    .fetch_one(&mut **tx)
    .await?;
    let document_number = format!("{prefix}-{today}-{:04}", day_count + 1);

    let mut hasher = Sha256::new();
    hasher.update(pdf);
    let document_hash = hex::encode(hasher.finalize());

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs ( \
           tenant_id, module_code, source_table, source_id, patient_id, \
           document_number, title, category, status, file_url, file_size_bytes, \
           mime_type, page_count, watermark, context_snapshot, document_hash, generated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
           'custom'::document_template_category, 'generated'::document_output_status, \
           $8, $9, 'application/pdf', NULL, $10::watermark_type, $11, $12, $13) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(template.module_code)
    .bind(template.source_table)
    .bind(source_id)
    .bind(patient_id)
    .bind(&document_number)
    .bind(template.title)
    .bind(file_key)
    .bind(i64::try_from(pdf.len()).unwrap_or(0))
    .bind(watermark)
    .bind(context)
    .bind(&document_hash)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    Ok(id)
}

/// POST /api/documents/render
pub async fn render_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RenderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let gotenberg = renderer(&state)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let template = SYSTEM_TEMPLATES
        .iter()
        .find(|t| t.code == body.template_code)
        .ok_or_else(|| {
            AppError::BadRequest(format!("unknown template_code '{}'", body.template_code))
        })?;
    let (html_template, paper, margins) =
        resolve_template(&mut tx, claims.tenant_id, &body.template_code).await?;

    // Bind live data — context builders reuse the print_data fetchers.
    let (mut context, patient_id) =
        templates::build_context(&state, &claims, template.code, body.source_id).await?;

    let watermark = body
        .watermark
        .as_deref()
        .filter(|w| {
            matches!(
                *w,
                "none" | "draft" | "confidential" | "copy" | "duplicate" | "cancelled"
            )
        })
        .unwrap_or("none");

    if let Some(obj) = context.as_object_mut() {
        obj.insert(
            "branding".to_owned(),
            branding_context(&mut tx, claims.tenant_id).await?,
        );
        obj.insert("watermark".to_owned(), serde_json::json!(watermark));
        obj.insert(
            "generated_at".to_owned(),
            serde_json::json!(chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string()),
        );
    }

    let html = medbrains_print::engine::render_html(&html_template, &context)
        .map_err(|e| AppError::Internal(format!("template render: {e}")))?;
    let pdf = gotenberg
        .html_to_pdf(&html, paper, margins)
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("pdf render: {e}")))?;

    let month = chrono::Utc::now().format("%Y-%m").to_string();
    let file_key = format!(
        "{}/documents/{month}/{}/{}.pdf",
        claims.tenant_id,
        Uuid::new_v4(),
        template.code
    );
    state
        .documents_store
        .put(&file_key, pdf.clone(), Some("application/pdf"))
        .await
        .map_err(|e| AppError::Internal(format!("document store: {e}")))?;

    let document_output_id = record_output(
        &mut tx,
        &claims,
        template,
        body.source_id,
        patient_id,
        &file_key,
        &pdf,
        &context,
        watermark,
    )
    .await?;
    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "document_output_id": document_output_id,
        "file_key": file_key,
        "download_url": format!("/api/documents/{document_output_id}/download"),
    })))
}

/// GET /api/documents/{id}/download — stream the stored PDF through
/// the authenticated API (uniform across storage backends; every PHI
/// download passes auth + tenant scoping + the audit middleware).
pub async fn download_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let row: Option<(String, Option<String>, String)> = sqlx::query_as(
        "SELECT file_url, mime_type, document_number FROM document_outputs          WHERE id = $1 AND tenant_id = $2 AND file_url IS NOT NULL            AND status <> 'voided'::document_output_status",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?;
    let Some((file_key, mime_type, document_number)) = row else {
        return Err(AppError::NotFound);
    };

    let bytes = state
        .documents_store
        .get(&file_key)
        .await
        .map_err(|e| AppError::Internal(format!("document fetch: {e}")))?;

    Ok((
        [
            (
                header::CONTENT_TYPE,
                mime_type.unwrap_or_else(|| "application/pdf".to_owned()),
            ),
            (
                header::CONTENT_DISPOSITION,
                format!("inline; filename=\"{document_number}.pdf\""),
            ),
        ],
        bytes,
    ))
}

/// GET /api/documents/templates/{code}/preview — render the template
/// against its bundled sample context; PDF inline for the editor.
pub async fn preview_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let gotenberg = renderer(&state)?;

    let template = SYSTEM_TEMPLATES
        .iter()
        .find(|t| t.code == code)
        .ok_or_else(|| AppError::BadRequest(format!("unknown template_code '{code}'")))?;
    let sample = template.sample_context;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (html_template, paper, margins) =
        resolve_template(&mut tx, claims.tenant_id, &code).await?;
    let mut context: serde_json::Value =
        serde_json::from_str(sample).map_err(|e| AppError::Internal(e.to_string()))?;
    if let Some(obj) = context.as_object_mut() {
        obj.insert(
            "branding".to_owned(),
            branding_context(&mut tx, claims.tenant_id).await?,
        );
    }
    tx.commit().await?;

    let html = medbrains_print::engine::render_html(&html_template, &context)
        .map_err(|e| AppError::Internal(format!("template render: {e}")))?;
    let pdf = gotenberg
        .html_to_pdf(&html, paper, margins)
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("pdf render: {e}")))?;
    let _ = template;

    Ok((
        [
            (header::CONTENT_TYPE, "application/pdf".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                format!("inline; filename=\"{code}-preview.pdf\""),
            ),
        ],
        pdf,
    ))
}

#[derive(Debug, Deserialize)]
pub struct QueuePrintRequest {
    pub printer_id: Option<Uuid>,
    #[serde(default = "default_copies")]
    pub copies: i32,
}

const fn default_copies() -> i32 {
    1
}

/// POST /api/documents/{id}/queue-print — hand a rendered document to
/// the print queue (consumed by the print daemon, story #221).
pub async fn queue_print(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<QueuePrintRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM document_outputs WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !exists {
        return Err(AppError::NotFound);
    }

    let job_id: Uuid = sqlx::query_scalar(
        "INSERT INTO print_jobs (tenant_id, document_output_id, printer_id, copies, submitted_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.printer_id)
    .bind(body.copies.clamp(1, 10))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(
        serde_json::json!({ "print_job_id": job_id, "status": "queued" }),
    ))
}

// ── Template management (admin) ─────────────────────────────

/// GET /api/documents/templates — built-in registry + override flags.
pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let overridden: Vec<String> = sqlx::query_scalar(
        "SELECT code FROM document_templates WHERE tenant_id = $1 AND is_active = true",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *conn)
    .await?;

    let templates: Vec<serde_json::Value> = SYSTEM_TEMPLATES
        .iter()
        .map(|t| {
            let (w, h) = t.paper.size_mm();
            serde_json::json!({
                "code": t.code,
                "title": t.title,
                "module_code": t.module_code,
                "paper_mm": { "width": w, "height": h },
                "has_override": overridden.iter().any(|c| c == t.code),
                "default_html": t.html,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "templates": templates })))
}

#[derive(Debug, Deserialize)]
pub struct SaveTemplateRequest {
    /// Tera HTML override. Null/empty clears the override (back to built-in).
    pub html: Option<String>,
}

/// PUT /api/documents/templates/{code} — save or clear a tenant override.
pub async fn save_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(body): Json<SaveTemplateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let builtin = SYSTEM_TEMPLATES
        .iter()
        .find(|t| t.code == code)
        .ok_or_else(|| AppError::BadRequest(format!("unknown template_code '{code}'")))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    match body
        .html
        .as_deref()
        .map(str::trim)
        .filter(|h| !h.is_empty())
    {
        Some(html) => {
            // Validate before saving — a broken template must never
            // reach render time.
            medbrains_print::engine::render_html(
                html,
                &serde_json::from_str(builtin.sample_context)
                    .map_err(|e| AppError::Internal(e.to_string()))?,
            )
            .map_err(|e| AppError::BadRequest(format!("template does not compile: {e}")))?;

            sqlx::query(
                "INSERT INTO document_templates \
                   (tenant_id, code, name, module_code, body_layout, created_by) \
                 VALUES ($1, $2, $3, $4, jsonb_build_object('html', $5::text), $6) \
                 ON CONFLICT (tenant_id, code) DO UPDATE SET \
                   body_layout = jsonb_build_object('html', $5::text), \
                   version = document_templates.version + 1, \
                   is_active = true, updated_at = now()",
            )
            .bind(claims.tenant_id)
            .bind(&code)
            .bind(builtin.title)
            .bind(builtin.module_code)
            .bind(html)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
        }
        None => {
            sqlx::query(
                "UPDATE document_templates SET is_active = false, updated_at = now() \
                 WHERE tenant_id = $1 AND code = $2",
            )
            .bind(claims.tenant_id)
            .bind(&code)
            .execute(&mut *tx)
            .await?;
        }
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

/// Document-render routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/documents/render",
            post(render_document),
        )
        .route(
            "/api/documents/{id}/download",
            get(download_document),
        )
        .route(
            "/api/documents/{id}/queue-print",
            post(queue_print),
        )
        .route(
            "/api/documents/render/templates/{code}/preview",
            get(preview_template),
        )
        .route(
            "/api/documents/render/templates",
            get(list_templates),
        )
        .route(
            "/api/documents/render/templates/{code}",
            put(save_template),
        )
}
