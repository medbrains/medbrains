#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use medbrains_core::document::{
    DocumentFormReviewSchedule, DocumentOutput, DocumentOutputSignature, DocumentTemplate,
    DocumentTemplateVersion, PrintJob, PrinterConfig,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Templates ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub category: Option<String>,
    pub module_code: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub code: String,
    pub name: String,
    pub category: String,
    pub module_code: Option<String>,
    pub description: Option<String>,
    pub version: Option<i32>,
    pub is_active: Option<bool>,
    pub is_default: Option<bool>,
    pub print_format: Option<String>,
    pub header_layout: Option<serde_json::Value>,
    pub body_layout: Option<serde_json::Value>,
    pub footer_layout: Option<serde_json::Value>,
    pub show_logo: Option<bool>,
    pub logo_position: Option<String>,
    pub show_hospital_name: Option<bool>,
    pub show_hospital_address: Option<bool>,
    pub show_hospital_phone: Option<bool>,
    pub show_registration_no: Option<bool>,
    pub show_accreditation: Option<bool>,
    pub font_family: Option<String>,
    pub font_size_pt: Option<i32>,
    pub margin_top_mm: Option<i32>,
    pub margin_bottom_mm: Option<i32>,
    pub margin_left_mm: Option<i32>,
    pub margin_right_mm: Option<i32>,
    pub show_page_numbers: Option<bool>,
    pub show_print_metadata: Option<bool>,
    pub show_qr_code: Option<bool>,
    pub default_watermark: Option<String>,
    pub signature_blocks: Option<serde_json::Value>,
    pub required_context: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub category: Option<String>,
    pub module_code: Option<String>,
    pub description: Option<String>,
    pub version: Option<i32>,
    pub is_active: Option<bool>,
    pub is_default: Option<bool>,
    pub print_format: Option<String>,
    pub header_layout: Option<serde_json::Value>,
    pub body_layout: Option<serde_json::Value>,
    pub footer_layout: Option<serde_json::Value>,
    pub show_logo: Option<bool>,
    pub logo_position: Option<String>,
    pub show_hospital_name: Option<bool>,
    pub show_hospital_address: Option<bool>,
    pub show_hospital_phone: Option<bool>,
    pub show_registration_no: Option<bool>,
    pub show_accreditation: Option<bool>,
    pub font_family: Option<String>,
    pub font_size_pt: Option<i32>,
    pub margin_top_mm: Option<i32>,
    pub margin_bottom_mm: Option<i32>,
    pub margin_left_mm: Option<i32>,
    pub margin_right_mm: Option<i32>,
    pub show_page_numbers: Option<bool>,
    pub show_print_metadata: Option<bool>,
    pub show_qr_code: Option<bool>,
    pub default_watermark: Option<String>,
    pub signature_blocks: Option<serde_json::Value>,
    pub required_context: Option<Vec<String>>,
}

// ── Generation ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct GenerateDocumentRequest {
    pub template_code: String,
    pub title: String,
    pub module_code: Option<String>,
    pub source_table: Option<String>,
    pub source_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub visit_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub context_data: Option<serde_json::Value>,
    pub language_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PreviewDocumentRequest {
    pub template_code: String,
    pub context_data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct PreviewDocumentResponse {
    pub template: DocumentTemplate,
    pub context_data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct BatchGenerateRequest {
    pub template_code: String,
    pub title: String,
    pub module_code: Option<String>,
    pub source_table: Option<String>,
    pub source_ids: Vec<Uuid>,
    pub context_data: Option<serde_json::Value>,
    pub language_code: Option<String>,
}

// ── Outputs ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListOutputsQuery {
    pub patient_id: Option<Uuid>,
    pub module_code: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordPrintRequest {
    pub printed_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct VoidOutputRequest {
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct OutputStatsResponse {
    pub total_documents: i64,
    pub total_prints: i64,
    pub by_category: Vec<CategoryCount>,
    pub by_status: Vec<StatusCount>,
    pub voided_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

// ── Signatures ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateOutputSignatureRequest {
    pub document_output_id: Uuid,
    pub signer_role: String,
    pub signer_name: Option<String>,
    pub designation: Option<String>,
    pub registration_number: Option<String>,
    pub signature_type: String,
    pub signature_image_url: Option<String>,
    pub biometric_hash: Option<String>,
    pub aadhaar_ref: Option<String>,
    pub thumb_impression: Option<bool>,
}

// ── Review Schedule ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListReviewScheduleQuery {
    pub overdue: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReviewScheduleRequest {
    pub template_id: Uuid,
    pub review_cycle_months: i32,
    pub notes: Option<String>,
}

// ── Helper structs ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TodayDocCount {
    count: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct TotalCount {
    count: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct TotalPrints {
    total: i64,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Templates
// ══════════════════════════════════════════════════════════

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<DocumentTemplate>>, AppError> {
    require_permission(&claims, permissions::documents::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DocumentTemplate>(
        "SELECT * FROM document_templates \
         WHERE ($1::text IS NULL OR category::text = $1) \
         AND ($2::text IS NULL OR module_code = $2) \
         AND ($3::bool IS NULL OR is_active = $3) \
         ORDER BY category, name \
         LIMIT 500",
    )
    .bind(&params.category)
    .bind(&params.module_code)
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<DocumentTemplate>, AppError> {
    require_permission(&claims, permissions::documents::templates::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DocumentTemplate>(
        "INSERT INTO document_templates \
         (tenant_id, code, name, category, module_code, description, \
          version, is_active, is_default, print_format, \
          header_layout, body_layout, footer_layout, \
          show_logo, logo_position, show_hospital_name, \
          show_hospital_address, show_hospital_phone, \
          show_registration_no, show_accreditation, \
          font_family, font_size_pt, \
          margin_top_mm, margin_bottom_mm, margin_left_mm, margin_right_mm, \
          show_page_numbers, show_print_metadata, show_qr_code, \
          default_watermark, signature_blocks, required_context, \
          created_by) \
         VALUES ($1, $2, $3, $4::document_template_category, $5, $6, \
                 COALESCE($7, 1), COALESCE($8, true), COALESCE($9, false), \
                 COALESCE($10::print_format, 'a4_portrait'::print_format), \
                 $11, $12, $13, \
                 COALESCE($14, true), $15, COALESCE($16, true), \
                 COALESCE($17, true), COALESCE($18, true), \
                 COALESCE($19, false), COALESCE($20, false), \
                 $21, COALESCE($22, 10), \
                 COALESCE($23, 10), COALESCE($24, 10), \
                 COALESCE($25, 10), COALESCE($26, 10), \
                 COALESCE($27, true), COALESCE($28, true), \
                 COALESCE($29, false), \
                 COALESCE($30::watermark_type, 'none'::watermark_type), \
                 $31, $32, $33) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.module_code)
    .bind(&body.description)
    .bind(body.version)
    .bind(body.is_active)
    .bind(body.is_default)
    .bind(&body.print_format)
    .bind(&body.header_layout)
    .bind(&body.body_layout)
    .bind(&body.footer_layout)
    .bind(body.show_logo)
    .bind(&body.logo_position)
    .bind(body.show_hospital_name)
    .bind(body.show_hospital_address)
    .bind(body.show_hospital_phone)
    .bind(body.show_registration_no)
    .bind(body.show_accreditation)
    .bind(&body.font_family)
    .bind(body.font_size_pt)
    .bind(body.margin_top_mm)
    .bind(body.margin_bottom_mm)
    .bind(body.margin_left_mm)
    .bind(body.margin_right_mm)
    .bind(body.show_page_numbers)
    .bind(body.show_print_metadata)
    .bind(body.show_qr_code)
    .bind(&body.default_watermark)
    .bind(&body.signature_blocks)
    .bind(body.required_context.as_deref().unwrap_or(&[]))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentTemplate>, AppError> {
    require_permission(&claims, permissions::documents::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row =
        sqlx::query_as::<_, DocumentTemplate>("SELECT * FROM document_templates WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateRequest>,
) -> Result<Json<DocumentTemplate>, AppError> {
    require_permission(&claims, permissions::documents::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DocumentTemplate>(
        "UPDATE document_templates SET \
         name = COALESCE($2, name), \
         category = COALESCE($3::document_template_category, category), \
         module_code = COALESCE($4, module_code), \
         description = COALESCE($5, description), \
         version = COALESCE($6, version), \
         is_active = COALESCE($7, is_active), \
         is_default = COALESCE($8, is_default), \
         print_format = COALESCE($9::print_format, print_format), \
         header_layout = COALESCE($10, header_layout), \
         body_layout = COALESCE($11, body_layout), \
         footer_layout = COALESCE($12, footer_layout), \
         show_logo = COALESCE($13, show_logo), \
         logo_position = COALESCE($14, logo_position), \
         show_hospital_name = COALESCE($15, show_hospital_name), \
         show_hospital_address = COALESCE($16, show_hospital_address), \
         show_hospital_phone = COALESCE($17, show_hospital_phone), \
         show_registration_no = COALESCE($18, show_registration_no), \
         show_accreditation = COALESCE($19, show_accreditation), \
         font_family = COALESCE($20, font_family), \
         font_size_pt = COALESCE($21, font_size_pt), \
         margin_top_mm = COALESCE($22, margin_top_mm), \
         margin_bottom_mm = COALESCE($23, margin_bottom_mm), \
         margin_left_mm = COALESCE($24, margin_left_mm), \
         margin_right_mm = COALESCE($25, margin_right_mm), \
         show_page_numbers = COALESCE($26, show_page_numbers), \
         show_print_metadata = COALESCE($27, show_print_metadata), \
         show_qr_code = COALESCE($28, show_qr_code), \
         default_watermark = COALESCE($29::watermark_type, default_watermark), \
         signature_blocks = COALESCE($30, signature_blocks), \
         required_context = COALESCE($31, required_context), \
         updated_by = $32 \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.module_code)
    .bind(&body.description)
    .bind(body.version)
    .bind(body.is_active)
    .bind(body.is_default)
    .bind(&body.print_format)
    .bind(&body.header_layout)
    .bind(&body.body_layout)
    .bind(&body.footer_layout)
    .bind(body.show_logo)
    .bind(&body.logo_position)
    .bind(body.show_hospital_name)
    .bind(body.show_hospital_address)
    .bind(body.show_hospital_phone)
    .bind(body.show_registration_no)
    .bind(body.show_accreditation)
    .bind(&body.font_family)
    .bind(body.font_size_pt)
    .bind(body.margin_top_mm)
    .bind(body.margin_bottom_mm)
    .bind(body.margin_left_mm)
    .bind(body.margin_right_mm)
    .bind(body.show_page_numbers)
    .bind(body.show_print_metadata)
    .bind(body.show_qr_code)
    .bind(&body.default_watermark)
    .bind(&body.signature_blocks)
    .bind(&body.required_context)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::documents::templates::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE document_templates SET is_active = false, updated_by = $2 \
         WHERE id = $1",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn list_template_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(template_id): Path<Uuid>,
) -> Result<Json<Vec<DocumentTemplateVersion>>, AppError> {
    require_permission(&claims, permissions::documents::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DocumentTemplateVersion>(
        "SELECT * FROM document_template_versions \
         WHERE template_id = $1 \
         ORDER BY version_number DESC \
         LIMIT 100",
    )
    .bind(template_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_default_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DocumentTemplate>>, AppError> {
    require_permission(&claims, permissions::documents::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DocumentTemplate>(
        "SELECT DISTINCT ON (category) * FROM document_templates \
         WHERE is_default = true AND is_active = true \
         ORDER BY category, updated_at DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn set_default_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentTemplate>, AppError> {
    require_permission(&claims, permissions::documents::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get the template's category first
    let category: String =
        sqlx::query_scalar("SELECT category::text FROM document_templates WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    // Unset is_default for all templates in same category
    sqlx::query(
        "UPDATE document_templates SET is_default = false, updated_by = $2 \
         WHERE category::text = $1 AND is_default = true",
    )
    .bind(&category)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    // Set the target template as default
    let row = sqlx::query_as::<_, DocumentTemplate>(
        "UPDATE document_templates SET is_default = true, updated_by = $2 \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Generation
// ══════════════════════════════════════════════════════════

pub async fn generate_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateDocumentRequest>,
) -> Result<Json<DocumentOutput>, AppError> {
    require_permission(&claims, permissions::documents::GENERATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Look up template by code
    let template = sqlx::query_as::<_, DocumentTemplate>(
        "SELECT * FROM document_templates \
         WHERE code = $1 AND is_active = true \
         LIMIT 1",
    )
    .bind(&body.template_code)
    .fetch_one(&mut *tx)
    .await?;

    // Generate document number: DOC-YYYYMMDD-XXXX
    let today = Utc::now().format("%Y%m%d").to_string();
    let count_row = sqlx::query_as::<_, TodayDocCount>(
        "SELECT COUNT(*)::bigint AS count FROM document_outputs \
         WHERE document_number LIKE 'DOC-' || $1 || '-%'",
    )
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;

    let counter = count_row.count + 1;
    let document_number = format!("DOC-{today}-{counter:04}");

    let context_snapshot = body.context_data.unwrap_or_else(|| serde_json::json!({}));

    let row = sqlx::query_as::<_, DocumentOutput>(
        "INSERT INTO document_outputs \
         (tenant_id, template_id, template_version, module_code, \
          source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, \
          watermark, language_code, context_snapshot, \
          generated_by) \
         VALUES ($1, $2, $3, $4, \
                 $5, $6, $7, $8, $9, \
                 $10, $11, $12, \
                 'generated'::document_output_status, \
                 $13, $14, $15, \
                 $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(template.id)
    .bind(template.version)
    .bind(
        body.module_code
            .as_deref()
            .or(template.module_code.as_deref()),
    )
    .bind(&body.source_table)
    .bind(body.source_id)
    .bind(body.patient_id)
    .bind(body.visit_id)
    .bind(body.admission_id)
    .bind(&document_number)
    .bind(&body.title)
    .bind(template.category)
    .bind(template.default_watermark)
    .bind(body.language_code.as_deref().unwrap_or("en"))
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn preview_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PreviewDocumentRequest>,
) -> Result<Json<PreviewDocumentResponse>, AppError> {
    require_permission(&claims, permissions::documents::GENERATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let template = sqlx::query_as::<_, DocumentTemplate>(
        "SELECT * FROM document_templates \
         WHERE code = $1 AND is_active = true \
         LIMIT 1",
    )
    .bind(&body.template_code)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let context_data = body.context_data.unwrap_or_else(|| serde_json::json!({}));

    Ok(Json(PreviewDocumentResponse {
        template,
        context_data,
    }))
}

pub async fn batch_generate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BatchGenerateRequest>,
) -> Result<Json<Vec<DocumentOutput>>, AppError> {
    require_permission(&claims, permissions::documents::GENERATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Look up template by code
    let template = sqlx::query_as::<_, DocumentTemplate>(
        "SELECT * FROM document_templates \
         WHERE code = $1 AND is_active = true \
         LIMIT 1",
    )
    .bind(&body.template_code)
    .fetch_one(&mut *tx)
    .await?;

    // Get today's base count for numbering
    let today = Utc::now().format("%Y%m%d").to_string();
    let count_row = sqlx::query_as::<_, TodayDocCount>(
        "SELECT COUNT(*)::bigint AS count FROM document_outputs \
         WHERE document_number LIKE 'DOC-' || $1 || '-%'",
    )
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;

    let context_snapshot = body
        .context_data
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));

    let effective_module_code = body
        .module_code
        .as_deref()
        .or(template.module_code.as_deref());

    let mut results = Vec::with_capacity(body.source_ids.len());

    for (i, source_id) in body.source_ids.iter().enumerate() {
        let counter = count_row.count + (i as i64) + 1;
        let document_number = format!("DOC-{today}-{counter:04}");

        let row = sqlx::query_as::<_, DocumentOutput>(
            "INSERT INTO document_outputs \
             (tenant_id, template_id, template_version, module_code, \
              source_table, source_id, \
              document_number, title, category, status, \
              watermark, language_code, context_snapshot, \
              generated_by) \
             VALUES ($1, $2, $3, $4, \
                     $5, $6, \
                     $7, $8, $9, \
                     'generated'::document_output_status, \
                     $10, $11, $12, \
                     $13) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(template.id)
        .bind(template.version)
        .bind(effective_module_code)
        .bind(&body.source_table)
        .bind(source_id)
        .bind(&document_number)
        .bind(&body.title)
        .bind(template.category)
        .bind(template.default_watermark)
        .bind(body.language_code.as_deref().unwrap_or("en"))
        .bind(&context_snapshot)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        results.push(row);
    }

    tx.commit().await?;
    Ok(Json(results))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Outputs
// ══════════════════════════════════════════════════════════

pub async fn list_outputs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOutputsQuery>,
) -> Result<Json<Vec<DocumentOutput>>, AppError> {
    require_permission(&claims, permissions::documents::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DocumentOutput>(
        "SELECT * FROM document_outputs \
         WHERE ($1::uuid IS NULL OR patient_id = $1) \
         AND ($2::text IS NULL OR module_code = $2) \
         AND ($3::text IS NULL OR category::text = $3) \
         AND ($4::text IS NULL OR status::text = $4) \
         ORDER BY created_at DESC \
         LIMIT 500",
    )
    .bind(params.patient_id)
    .bind(&params.module_code)
    .bind(&params.category)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_output(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentOutput>, AppError> {
    require_permission(&claims, permissions::documents::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DocumentOutput>("SELECT * FROM document_outputs WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn record_print(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(_body): Json<RecordPrintRequest>,
) -> Result<Json<DocumentOutput>, AppError> {
    require_permission(&claims, permissions::documents::REPRINT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();

    // Increment print_count, set first_printed_at on first print,
    // set watermark to 'duplicate' on 2nd+ print
    let row = sqlx::query_as::<_, DocumentOutput>(
        "UPDATE document_outputs SET \
         print_count = print_count + 1, \
         first_printed_at = COALESCE(first_printed_at, $2), \
         last_printed_at = $2, \
         status = CASE \
             WHEN status = 'generated'::document_output_status \
             THEN 'printed'::document_output_status \
             ELSE status END, \
         watermark = CASE \
             WHEN print_count >= 1 THEN 'duplicate'::watermark_type \
             ELSE watermark END \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn void_output(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VoidOutputRequest>,
) -> Result<Json<DocumentOutput>, AppError> {
    require_permission(&claims, permissions::documents::VOID)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();

    let row = sqlx::query_as::<_, DocumentOutput>(
        "UPDATE document_outputs SET \
         status = 'voided'::document_output_status, \
         watermark = 'cancelled'::watermark_type, \
         voided_by = $2, \
         voided_at = $3, \
         voided_reason = $4 \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(now)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_patient_outputs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<DocumentOutput>>, AppError> {
    require_permission(&claims, permissions::documents::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DocumentOutput>(
        "SELECT * FROM document_outputs \
         WHERE patient_id = $1 \
         ORDER BY created_at DESC \
         LIMIT 500",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn output_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OutputStatsResponse>, AppError> {
    require_permission(&claims, permissions::documents::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Total documents
    let total_row =
        sqlx::query_as::<_, TotalCount>("SELECT COUNT(*)::bigint AS count FROM document_outputs")
            .fetch_one(&mut *tx)
            .await?;

    // Total prints
    let prints_row = sqlx::query_as::<_, TotalPrints>(
        "SELECT COALESCE(SUM(print_count), 0)::bigint AS total \
         FROM document_outputs",
    )
    .fetch_one(&mut *tx)
    .await?;

    // By category
    let by_category = sqlx::query_as::<_, CategoryCount>(
        "SELECT category::text AS category, COUNT(*)::bigint AS count \
         FROM document_outputs \
         GROUP BY category \
         ORDER BY count DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    // By status
    let by_status = sqlx::query_as::<_, StatusCount>(
        "SELECT status::text AS status, COUNT(*)::bigint AS count \
         FROM document_outputs \
         GROUP BY status \
         ORDER BY count DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    // Voided count
    let voided_row = sqlx::query_as::<_, TotalCount>(
        "SELECT COUNT(*)::bigint AS count FROM document_outputs \
         WHERE status = 'voided'::document_output_status",
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(OutputStatsResponse {
        total_documents: total_row.count,
        total_prints: prints_row.total,
        by_category,
        by_status,
        voided_count: voided_row.count,
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Signatures
// ══════════════════════════════════════════════════════════

pub async fn list_output_signatures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(document_output_id): Path<Uuid>,
) -> Result<Json<Vec<DocumentOutputSignature>>, AppError> {
    require_permission(&claims, permissions::documents::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DocumentOutputSignature>(
        "SELECT * FROM document_output_signatures \
         WHERE document_output_id = $1 \
         ORDER BY signed_at DESC",
    )
    .bind(document_output_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn add_output_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOutputSignatureRequest>,
) -> Result<Json<DocumentOutputSignature>, AppError> {
    require_permission(&claims, permissions::documents::GENERATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();

    let row = sqlx::query_as::<_, DocumentOutputSignature>(
        "INSERT INTO document_output_signatures \
         (tenant_id, document_output_id, signer_role, signer_name, \
          designation, registration_number, \
          signature_type, signature_image_url, \
          biometric_hash, aadhaar_ref, thumb_impression, \
          signed_at, captured_by) \
         VALUES ($1, $2, $3, $4, \
                 $5, $6, \
                 $7::signature_type, $8, \
                 $9, $10, COALESCE($11, false), \
                 $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.document_output_id)
    .bind(&body.signer_role)
    .bind(&body.signer_name)
    .bind(&body.designation)
    .bind(&body.registration_number)
    .bind(&body.signature_type)
    .bind(&body.signature_image_url)
    .bind(&body.biometric_hash)
    .bind(&body.aadhaar_ref)
    .bind(body.thumb_impression)
    .bind(now)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_output_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_output_id, sig_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::documents::GENERATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM document_output_signatures WHERE id = $1")
        .bind(sig_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Review Schedule
// ══════════════════════════════════════════════════════════

pub async fn list_review_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListReviewScheduleQuery>,
) -> Result<Json<Vec<DocumentFormReviewSchedule>>, AppError> {
    require_permission(&claims, permissions::documents::review::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if params.overdue.unwrap_or(false) {
        sqlx::query_as::<_, DocumentFormReviewSchedule>(
            "SELECT * FROM document_form_review_schedule \
             WHERE next_review_due IS NOT NULL \
             AND next_review_due <= CURRENT_DATE \
             ORDER BY next_review_due ASC \
             LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, DocumentFormReviewSchedule>(
            "SELECT * FROM document_form_review_schedule \
             ORDER BY next_review_due ASC NULLS LAST \
             LIMIT 200",
        )
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_review_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReviewScheduleRequest>,
) -> Result<Json<DocumentFormReviewSchedule>, AppError> {
    require_permission(&claims, permissions::documents::review::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Compute next_review_due from now + cycle months
    let next_due = Utc::now().date_naive() + chrono::Months::new(body.review_cycle_months as u32);

    let row = sqlx::query_as::<_, DocumentFormReviewSchedule>(
        "INSERT INTO document_form_review_schedule \
         (tenant_id, template_id, review_cycle_months, \
          next_review_due, review_status, notes) \
         VALUES ($1, $2, $3, $4, 'pending', $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.template_id)
    .bind(body.review_cycle_months)
    .bind(next_due)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn mark_reviewed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DocumentFormReviewSchedule>, AppError> {
    require_permission(&claims, permissions::documents::review::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();

    // Fetch the current schedule to compute next review due
    let current = sqlx::query_as::<_, DocumentFormReviewSchedule>(
        "SELECT * FROM document_form_review_schedule WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let next_due = now.date_naive() + chrono::Months::new(current.review_cycle_months as u32);

    let row = sqlx::query_as::<_, DocumentFormReviewSchedule>(
        "UPDATE document_form_review_schedule SET \
         last_reviewed_at = $2, \
         last_reviewed_by = $3, \
         next_review_due = $4, \
         review_status = 'reviewed' \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(now)
    .bind(claims.sub)
    .bind(next_due)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Printers (Phase 2 stubs)
// ══════════════════════════════════════════════════════════

pub async fn list_printers(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PrinterConfig>>, AppError> {
    require_permission(&claims, permissions::documents::printers::LIST)?;

    // TODO: Phase 2 — printer discovery and configuration
    Ok(Json(Vec::new()))
}

pub async fn create_printer(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::documents::printers::MANAGE)?;

    // TODO: Phase 2 — printer registration with connection testing
    Err(AppError::Internal(
        "printer management not yet implemented (Phase 2)".to_owned(),
    ))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Print Jobs (Phase 2 stubs)
// ══════════════════════════════════════════════════════════

pub async fn list_print_jobs(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PrintJob>>, AppError> {
    require_permission(&claims, permissions::documents::printers::LIST)?;

    // TODO: Phase 2 — print job queue management
    Ok(Json(Vec::new()))
}

pub async fn update_print_job(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::documents::printers::MANAGE)?;

    // TODO: Phase 2 — print job status updates (cancel, retry, etc.)
    Err(AppError::Internal(
        "print job management not yet implemented (Phase 2)".to_owned(),
    ))
}
