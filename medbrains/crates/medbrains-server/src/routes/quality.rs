#![allow(clippy::too_many_lines)]

use axum::{Extension, Json, extract::{Path, Query, State}};
use medbrains_core::permissions;
use medbrains_core::quality::{
    AccreditationBody, CapaStatus, CommitteeFrequency, ComplianceStatus,
    DocumentStatus, IncidentSeverity, IncidentStatus, IndicatorFrequency,
    QualityAccreditationCompliance, QualityAccreditationStandard, QualityActionItem,
    QualityAudit, QualityCapa, QualityCommittee, QualityCommitteeMeeting,
    QualityDocument, QualityDocumentAcknowledgment, QualityIncident,
    QualityIndicator, QualityIndicatorValue,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Indicators ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListIndicatorsQuery {
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIndicatorRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub sub_category: Option<String>,
    pub numerator_description: Option<String>,
    pub denominator_description: Option<String>,
    pub unit: Option<String>,
    pub frequency: IndicatorFrequency,
    pub target_value: Option<Decimal>,
    pub threshold_warning: Option<Decimal>,
    pub threshold_critical: Option<Decimal>,
    pub auto_calculated: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListIndicatorValuesQuery {
    pub indicator_id: Option<Uuid>,
    pub period: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordIndicatorValueRequest {
    pub indicator_id: Uuid,
    pub period_start: String,
    pub period_end: String,
    pub numerator_value: Option<Decimal>,
    pub denominator_value: Option<Decimal>,
    pub calculated_value: Option<Decimal>,
    pub department_id: Option<Uuid>,
    pub notes: Option<String>,
}

// ── Documents ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListDocumentsQuery {
    pub status: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDocumentRequest {
    pub document_number: String,
    pub title: String,
    pub category: String,
    pub department_id: Option<Uuid>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub reviewer_id: Option<Uuid>,
    pub is_training_required: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDocumentStatusRequest {
    pub status: DocumentStatus,
}

// ── Incidents ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListIncidentsQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIncidentRequest {
    pub title: String,
    pub description: Option<String>,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub department_id: Option<Uuid>,
    pub location: Option<String>,
    pub incident_date: String,
    pub is_anonymous: Option<bool>,
    pub patient_id: Option<Uuid>,
    pub immediate_action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncidentRequest {
    pub status: Option<IncidentStatus>,
    pub assigned_to: Option<Uuid>,
    pub root_cause: Option<String>,
    pub contributing_factors: Option<serde_json::Value>,
    pub is_reportable: Option<bool>,
    pub regulatory_body: Option<String>,
}

// ── CAPA ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCapaQuery {
    pub incident_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCapaRequest {
    pub incident_id: Uuid,
    pub capa_type: String,
    pub description: Option<String>,
    pub action_plan: Option<String>,
    pub assigned_to: Uuid,
    pub due_date: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCapaRequest {
    pub status: Option<CapaStatus>,
    pub effectiveness_check: Option<String>,
}

// ── Committees ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateCommitteeRequest {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub committee_type: String,
    pub chairperson_id: Option<Uuid>,
    pub secretary_id: Option<Uuid>,
    pub members: Option<serde_json::Value>,
    pub meeting_frequency: CommitteeFrequency,
    pub charter: Option<String>,
    pub is_mandatory: Option<bool>,
}

// ── Meetings ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListMeetingsQuery {
    pub committee_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMeetingRequest {
    pub committee_id: Uuid,
    pub scheduled_date: String,
    pub venue: Option<String>,
    pub agenda: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMeetingRequest {
    pub actual_date: Option<String>,
    pub minutes: Option<String>,
    pub attendees: Option<serde_json::Value>,
    pub decisions: Option<serde_json::Value>,
    pub status: Option<String>,
}

// ── Action Items ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListActionItemsQuery {
    pub source_type: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateActionItemRequest {
    pub source_type: String,
    pub source_id: Uuid,
    pub description: Option<String>,
    pub assigned_to: Uuid,
    pub due_date: String,
}

// ── Accreditation ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListStandardsQuery {
    pub body: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStandardRequest {
    pub body: AccreditationBody,
    pub standard_code: String,
    pub standard_name: String,
    pub chapter: Option<String>,
    pub description: Option<String>,
    pub measurable_elements: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListComplianceQuery {
    pub standard_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateComplianceRequest {
    pub standard_id: Uuid,
    pub compliance: ComplianceStatus,
    pub evidence_summary: Option<String>,
    pub evidence_documents: Option<serde_json::Value>,
    pub gap_description: Option<String>,
    pub action_plan: Option<String>,
    pub responsible_person_id: Option<Uuid>,
    pub target_date: Option<String>,
}

// ── Audits ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAuditsQuery {
    pub status: Option<String>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAuditRequest {
    pub audit_type: String,
    pub title: String,
    pub scope: Option<String>,
    pub department_id: Option<Uuid>,
    pub audit_date: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAuditRequest {
    pub findings: Option<serde_json::Value>,
    pub non_conformities: Option<i32>,
    pub observations: Option<i32>,
    pub opportunities: Option<i32>,
    pub overall_score: Option<Decimal>,
    pub status: Option<String>,
    pub report_date: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Number generation helper
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SeqResult {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

async fn generate_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    seq_type: &str,
    fallback_prefix: &str,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = $2 \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
        Ok(format!("{fallback_prefix}-{ts}"))
    }
}

// ══════════════════════════════════════════════════════════
//  Indicator handlers
// ══════════════════════════════════════════════════════════

pub async fn list_indicators(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListIndicatorsQuery>,
) -> Result<Json<Vec<QualityIndicator>>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref category) = params.category {
        sqlx::query_as::<_, QualityIndicator>(
            "SELECT * FROM quality_indicators \
             WHERE tenant_id = $1 AND category = $2 \
             ORDER BY code",
        )
        .bind(claims.tenant_id)
        .bind(category)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, QualityIndicator>(
            "SELECT * FROM quality_indicators \
             WHERE tenant_id = $1 \
             ORDER BY code",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_indicator(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIndicatorRequest>,
) -> Result<Json<QualityIndicator>, AppError> {
    require_permission(&claims, permissions::quality::indicators::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityIndicator>(
        "INSERT INTO quality_indicators \
         (tenant_id, code, name, description, category, sub_category, \
          numerator_description, denominator_description, unit, \
          frequency, target_value, threshold_warning, threshold_critical, \
          auto_calculated) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,false)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.category)
    .bind(&body.sub_category)
    .bind(&body.numerator_description)
    .bind(&body.denominator_description)
    .bind(&body.unit)
    .bind(body.frequency)
    .bind(body.target_value)
    .bind(body.threshold_warning)
    .bind(body.threshold_critical)
    .bind(body.auto_calculated)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_indicator_values(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListIndicatorValuesQuery>,
) -> Result<Json<Vec<QualityIndicatorValue>>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(indicator_id) = params.indicator_id {
        sqlx::query_as::<_, QualityIndicatorValue>(
            "SELECT * FROM quality_indicator_values \
             WHERE tenant_id = $1 AND indicator_id = $2 \
             ORDER BY period_start DESC",
        )
        .bind(claims.tenant_id)
        .bind(indicator_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, QualityIndicatorValue>(
            "SELECT * FROM quality_indicator_values \
             WHERE tenant_id = $1 \
             ORDER BY period_start DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn record_indicator_value(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RecordIndicatorValueRequest>,
) -> Result<Json<QualityIndicatorValue>, AppError> {
    require_permission(&claims, permissions::quality::indicators::MANAGE)?;

    let period_start = chrono::NaiveDate::parse_from_str(&body.period_start, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid period_start format, expected YYYY-MM-DD".into()))?;
    let period_end = chrono::NaiveDate::parse_from_str(&body.period_end, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid period_end format, expected YYYY-MM-DD".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityIndicatorValue>(
        "INSERT INTO quality_indicator_values \
         (tenant_id, indicator_id, period_start, period_end, \
          numerator_value, denominator_value, calculated_value, \
          department_id, notes, recorded_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.indicator_id)
    .bind(period_start)
    .bind(period_end)
    .bind(body.numerator_value)
    .bind(body.denominator_value)
    .bind(body.calculated_value)
    .bind(body.department_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Document handlers
// ══════════════════════════════════════════════════════════

pub async fn list_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDocumentsQuery>,
) -> Result<Json<Vec<QualityDocument>>, AppError> {
    require_permission(&claims, permissions::quality::documents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.status, &params.category) {
        (Some(status), Some(category)) => {
            sqlx::query_as::<_, QualityDocument>(
                "SELECT * FROM quality_documents \
                 WHERE tenant_id = $1 AND status = $2::document_status AND category = $3 \
                 ORDER BY updated_at DESC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .bind(category)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(status), None) => {
            sqlx::query_as::<_, QualityDocument>(
                "SELECT * FROM quality_documents \
                 WHERE tenant_id = $1 AND status = $2::document_status \
                 ORDER BY updated_at DESC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(category)) => {
            sqlx::query_as::<_, QualityDocument>(
                "SELECT * FROM quality_documents \
                 WHERE tenant_id = $1 AND category = $2 \
                 ORDER BY updated_at DESC",
            )
            .bind(claims.tenant_id)
            .bind(category)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, QualityDocument>(
                "SELECT * FROM quality_documents \
                 WHERE tenant_id = $1 \
                 ORDER BY updated_at DESC",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QualityDocument>, AppError> {
    require_permission(&claims, permissions::quality::documents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityDocument>(
        "SELECT * FROM quality_documents WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDocumentRequest>,
) -> Result<Json<QualityDocument>, AppError> {
    require_permission(&claims, permissions::quality::documents::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityDocument>(
        "INSERT INTO quality_documents \
         (tenant_id, document_number, title, category, department_id, \
          content, summary, author_id, reviewer_id, \
          is_training_required) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,false)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.document_number)
    .bind(&body.title)
    .bind(&body.category)
    .bind(body.department_id)
    .bind(&body.content)
    .bind(&body.summary)
    .bind(claims.sub)
    .bind(body.reviewer_id)
    .bind(body.is_training_required)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_document_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDocumentStatusRequest>,
) -> Result<Json<QualityDocument>, AppError> {
    require_permission(&claims, permissions::quality::documents::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // When status transitions to approved or released, set approver_id / released_at
    let row = match body.status {
        DocumentStatus::Approved => {
            sqlx::query_as::<_, QualityDocument>(
                "UPDATE quality_documents SET \
                 status = $3::document_status, \
                 approver_id = $4, \
                 updated_at = now() \
                 WHERE id = $1 AND tenant_id = $2 \
                 RETURNING *",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(body.status)
            .bind(claims.sub)
            .fetch_optional(&mut *tx)
            .await?
        }
        DocumentStatus::Released => {
            sqlx::query_as::<_, QualityDocument>(
                "UPDATE quality_documents SET \
                 status = $3::document_status, \
                 released_at = now(), \
                 updated_at = now() \
                 WHERE id = $1 AND tenant_id = $2 \
                 RETURNING *",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(body.status)
            .fetch_optional(&mut *tx)
            .await?
        }
        _ => {
            sqlx::query_as::<_, QualityDocument>(
                "UPDATE quality_documents SET \
                 status = $3::document_status, \
                 updated_at = now() \
                 WHERE id = $1 AND tenant_id = $2 \
                 RETURNING *",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(body.status)
            .fetch_optional(&mut *tx)
            .await?
        }
    }
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn acknowledge_document(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QualityDocumentAcknowledgment>, AppError> {
    require_permission(&claims, permissions::quality::documents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify document exists
    let _doc = sqlx::query_as::<_, QualityDocument>(
        "SELECT * FROM quality_documents WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let row = sqlx::query_as::<_, QualityDocumentAcknowledgment>(
        "INSERT INTO quality_document_acknowledgments \
         (tenant_id, document_id, user_id) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (tenant_id, document_id, user_id) DO UPDATE \
         SET acknowledged_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Incident handlers
// ══════════════════════════════════════════════════════════

pub async fn list_incidents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListIncidentsQuery>,
) -> Result<Json<Vec<QualityIncident>>, AppError> {
    require_permission(&claims, permissions::quality::incidents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.status, &params.severity) {
        (Some(status), Some(severity)) => {
            sqlx::query_as::<_, QualityIncident>(
                "SELECT * FROM quality_incidents \
                 WHERE tenant_id = $1 \
                 AND status = $2::incident_status \
                 AND severity = $3::incident_severity \
                 ORDER BY incident_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .bind(severity)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(status), None) => {
            sqlx::query_as::<_, QualityIncident>(
                "SELECT * FROM quality_incidents \
                 WHERE tenant_id = $1 AND status = $2::incident_status \
                 ORDER BY incident_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(severity)) => {
            sqlx::query_as::<_, QualityIncident>(
                "SELECT * FROM quality_incidents \
                 WHERE tenant_id = $1 AND severity = $2::incident_severity \
                 ORDER BY incident_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(severity)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, QualityIncident>(
                "SELECT * FROM quality_incidents \
                 WHERE tenant_id = $1 \
                 ORDER BY incident_date DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QualityIncident>, AppError> {
    require_permission(&claims, permissions::quality::incidents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityIncident>(
        "SELECT * FROM quality_incidents WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIncidentRequest>,
) -> Result<Json<QualityIncident>, AppError> {
    require_permission(&claims, permissions::quality::incidents::CREATE)?;

    let incident_date = chrono::DateTime::parse_from_rfc3339(&body.incident_date)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(&body.incident_date, "%Y-%m-%d")
                .map(|d| {
                    d.and_hms_opt(0, 0, 0).map_or_else(chrono::Utc::now, |ndt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc))
                })
        })
        .map_err(|_| AppError::BadRequest("Invalid incident_date format".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let incident_number = generate_number(&mut tx, &claims.tenant_id, "INC", "INC").await?;

    let row = sqlx::query_as::<_, QualityIncident>(
        "INSERT INTO quality_incidents \
         (tenant_id, incident_number, title, description, incident_type, \
          severity, department_id, location, incident_date, \
          reported_by, is_anonymous, patient_id, immediate_action) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,false),$12,$13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&incident_number)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.incident_type)
    .bind(body.severity)
    .bind(body.department_id)
    .bind(&body.location)
    .bind(incident_date)
    .bind(claims.sub)
    .bind(body.is_anonymous)
    .bind(body.patient_id)
    .bind(&body.immediate_action)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIncidentRequest>,
) -> Result<Json<QualityIncident>, AppError> {
    require_permission(&claims, permissions::quality::incidents::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let contributing = body.contributing_factors.clone().unwrap_or(serde_json::json!([]));

    let row = sqlx::query_as::<_, QualityIncident>(
        "UPDATE quality_incidents SET \
         status = COALESCE($3::incident_status, status), \
         assigned_to = COALESCE($4, assigned_to), \
         root_cause = COALESCE($5, root_cause), \
         contributing_factors = CASE WHEN $6::jsonb IS NOT NULL THEN $6 ELSE contributing_factors END, \
         is_reportable = COALESCE($7, is_reportable), \
         regulatory_body = COALESCE($8, regulatory_body), \
         closed_at = CASE WHEN $3 = 'closed' THEN now() ELSE closed_at END, \
         closed_by = CASE WHEN $3 = 'closed' THEN $9 ELSE closed_by END, \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.status.and_then(|s| {
        // serde will have deserialized it; we need the string for the cast
        serde_json::to_value(s).ok().and_then(|v| v.as_str().map(String::from))
    }))
    .bind(body.assigned_to)
    .bind(&body.root_cause)
    .bind(if body.contributing_factors.is_some() { Some(&contributing) } else { None })
    .bind(body.is_reportable)
    .bind(&body.regulatory_body)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  CAPA handlers
// ══════════════════════════════════════════════════════════

pub async fn list_capa(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCapaQuery>,
) -> Result<Json<Vec<QualityCapa>>, AppError> {
    require_permission(&claims, permissions::quality::capa::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.incident_id, &params.status) {
        (Some(incident_id), Some(status)) => {
            sqlx::query_as::<_, QualityCapa>(
                "SELECT * FROM quality_capa \
                 WHERE tenant_id = $1 AND incident_id = $2 \
                 AND status = $3::capa_status \
                 ORDER BY due_date ASC",
            )
            .bind(claims.tenant_id)
            .bind(incident_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(incident_id), None) => {
            sqlx::query_as::<_, QualityCapa>(
                "SELECT * FROM quality_capa \
                 WHERE tenant_id = $1 AND incident_id = $2 \
                 ORDER BY due_date ASC",
            )
            .bind(claims.tenant_id)
            .bind(incident_id)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(status)) => {
            sqlx::query_as::<_, QualityCapa>(
                "SELECT * FROM quality_capa \
                 WHERE tenant_id = $1 AND status = $2::capa_status \
                 ORDER BY due_date ASC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, QualityCapa>(
                "SELECT * FROM quality_capa \
                 WHERE tenant_id = $1 \
                 ORDER BY due_date ASC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_capa(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCapaRequest>,
) -> Result<Json<QualityCapa>, AppError> {
    require_permission(&claims, permissions::quality::capa::MANAGE)?;

    let due_date = chrono::NaiveDate::parse_from_str(&body.due_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid due_date format, expected YYYY-MM-DD".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let capa_number = generate_number(&mut tx, &claims.tenant_id, "CAPA", "CAPA").await?;

    let row = sqlx::query_as::<_, QualityCapa>(
        "INSERT INTO quality_capa \
         (tenant_id, incident_id, capa_number, capa_type, \
          description, action_plan, assigned_to, due_date) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.incident_id)
    .bind(&capa_number)
    .bind(&body.capa_type)
    .bind(&body.description)
    .bind(&body.action_plan)
    .bind(body.assigned_to)
    .bind(due_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_capa(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCapaRequest>,
) -> Result<Json<QualityCapa>, AppError> {
    require_permission(&claims, permissions::quality::capa::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status_str = body.status.and_then(|s| {
        serde_json::to_value(s)
            .ok()
            .and_then(|v| v.as_str().map(String::from))
    });

    // Handle special logic for verified status
    let is_verified = body.status == Some(CapaStatus::Verified);
    let is_completed = body.status == Some(CapaStatus::Completed);

    let row = sqlx::query_as::<_, QualityCapa>(
        "UPDATE quality_capa SET \
         status = COALESCE($3::capa_status, status), \
         effectiveness_check = COALESCE($4, effectiveness_check), \
         completed_at = CASE WHEN $5 THEN now() ELSE completed_at END, \
         verified_by = CASE WHEN $6 THEN $7 ELSE verified_by END, \
         verified_at = CASE WHEN $6 THEN now() ELSE verified_at END, \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&status_str)
    .bind(&body.effectiveness_check)
    .bind(is_completed)
    .bind(is_verified)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Committee handlers
// ══════════════════════════════════════════════════════════

pub async fn list_committees(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QualityCommittee>>, AppError> {
    require_permission(&claims, permissions::quality::committees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, QualityCommittee>(
        "SELECT * FROM quality_committees \
         WHERE tenant_id = $1 \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_committee(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCommitteeRequest>,
) -> Result<Json<QualityCommittee>, AppError> {
    require_permission(&claims, permissions::quality::committees::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let members = body.members.clone().unwrap_or(serde_json::json!([]));

    let row = sqlx::query_as::<_, QualityCommittee>(
        "INSERT INTO quality_committees \
         (tenant_id, name, code, description, committee_type, \
          chairperson_id, secretary_id, members, meeting_frequency, \
          charter, is_mandatory) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,false)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(&body.description)
    .bind(&body.committee_type)
    .bind(body.chairperson_id)
    .bind(body.secretary_id)
    .bind(&members)
    .bind(body.meeting_frequency)
    .bind(&body.charter)
    .bind(body.is_mandatory)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Meeting handlers
// ══════════════════════════════════════════════════════════

pub async fn list_meetings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMeetingsQuery>,
) -> Result<Json<Vec<QualityCommitteeMeeting>>, AppError> {
    require_permission(&claims, permissions::quality::committees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(committee_id) = params.committee_id {
        sqlx::query_as::<_, QualityCommitteeMeeting>(
            "SELECT * FROM quality_committee_meetings \
             WHERE tenant_id = $1 AND committee_id = $2 \
             ORDER BY scheduled_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(committee_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, QualityCommitteeMeeting>(
            "SELECT * FROM quality_committee_meetings \
             WHERE tenant_id = $1 \
             ORDER BY scheduled_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_meeting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMeetingRequest>,
) -> Result<Json<QualityCommitteeMeeting>, AppError> {
    require_permission(&claims, permissions::quality::committees::MANAGE)?;

    let scheduled_date = chrono::DateTime::parse_from_rfc3339(&body.scheduled_date)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(&body.scheduled_date, "%Y-%m-%d")
                .map(|d| {
                    d.and_hms_opt(0, 0, 0).map_or_else(chrono::Utc::now, |ndt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc))
                })
        })
        .map_err(|_| AppError::BadRequest("Invalid scheduled_date format".into()))?;

    let agenda = body.agenda.clone().unwrap_or(serde_json::json!([]));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityCommitteeMeeting>(
        "INSERT INTO quality_committee_meetings \
         (tenant_id, committee_id, scheduled_date, venue, agenda) \
         VALUES ($1,$2,$3,$4,$5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.committee_id)
    .bind(scheduled_date)
    .bind(&body.venue)
    .bind(&agenda)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_meeting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMeetingRequest>,
) -> Result<Json<QualityCommitteeMeeting>, AppError> {
    require_permission(&claims, permissions::quality::committees::MANAGE)?;

    let actual_date = body.actual_date.as_deref().and_then(|d| {
        chrono::DateTime::parse_from_rfc3339(d)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .ok()
            .or_else(|| {
                chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
                    .ok()
                    .and_then(|nd| nd.and_hms_opt(0, 0, 0))
                    .map(|ndt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc))
            })
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityCommitteeMeeting>(
        "UPDATE quality_committee_meetings SET \
         actual_date = COALESCE($3, actual_date), \
         minutes = COALESCE($4, minutes), \
         attendees = COALESCE($5, attendees), \
         decisions = COALESCE($6, decisions), \
         status = COALESCE($7, status), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(actual_date)
    .bind(&body.minutes)
    .bind(&body.attendees)
    .bind(&body.decisions)
    .bind(&body.status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Action Item handlers
// ══════════════════════════════════════════════════════════

pub async fn list_action_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListActionItemsQuery>,
) -> Result<Json<Vec<QualityActionItem>>, AppError> {
    require_permission(&claims, permissions::quality::committees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.source_type, &params.status) {
        (Some(source_type), Some(status)) => {
            sqlx::query_as::<_, QualityActionItem>(
                "SELECT * FROM quality_action_items \
                 WHERE tenant_id = $1 AND source_type = $2 AND status = $3 \
                 ORDER BY due_date ASC",
            )
            .bind(claims.tenant_id)
            .bind(source_type)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(source_type), None) => {
            sqlx::query_as::<_, QualityActionItem>(
                "SELECT * FROM quality_action_items \
                 WHERE tenant_id = $1 AND source_type = $2 \
                 ORDER BY due_date ASC",
            )
            .bind(claims.tenant_id)
            .bind(source_type)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(status)) => {
            sqlx::query_as::<_, QualityActionItem>(
                "SELECT * FROM quality_action_items \
                 WHERE tenant_id = $1 AND status = $2 \
                 ORDER BY due_date ASC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, QualityActionItem>(
                "SELECT * FROM quality_action_items \
                 WHERE tenant_id = $1 \
                 ORDER BY due_date ASC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_action_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateActionItemRequest>,
) -> Result<Json<QualityActionItem>, AppError> {
    require_permission(&claims, permissions::quality::committees::MANAGE)?;

    let due_date = chrono::NaiveDate::parse_from_str(&body.due_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid due_date format, expected YYYY-MM-DD".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityActionItem>(
        "INSERT INTO quality_action_items \
         (tenant_id, source_type, source_id, description, assigned_to, due_date) \
         VALUES ($1,$2,$3,$4,$5,$6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.source_type)
    .bind(body.source_id)
    .bind(&body.description)
    .bind(body.assigned_to)
    .bind(due_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Accreditation Standard handlers
// ══════════════════════════════════════════════════════════

pub async fn list_standards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListStandardsQuery>,
) -> Result<Json<Vec<QualityAccreditationStandard>>, AppError> {
    require_permission(&claims, permissions::quality::accreditation::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref body) = params.body {
        sqlx::query_as::<_, QualityAccreditationStandard>(
            "SELECT * FROM quality_accreditation_standards \
             WHERE tenant_id = $1 AND body = $2::accreditation_body \
             ORDER BY standard_code",
        )
        .bind(claims.tenant_id)
        .bind(body)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, QualityAccreditationStandard>(
            "SELECT * FROM quality_accreditation_standards \
             WHERE tenant_id = $1 \
             ORDER BY body, standard_code",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_standard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStandardRequest>,
) -> Result<Json<QualityAccreditationStandard>, AppError> {
    require_permission(&claims, permissions::quality::accreditation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let measurable_elements = body.measurable_elements.clone()
        .unwrap_or(serde_json::json!([]));

    let row = sqlx::query_as::<_, QualityAccreditationStandard>(
        "INSERT INTO quality_accreditation_standards \
         (tenant_id, body, standard_code, standard_name, \
          chapter, description, measurable_elements) \
         VALUES ($1,$2,$3,$4,$5,$6,$7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.body)
    .bind(&body.standard_code)
    .bind(&body.standard_name)
    .bind(&body.chapter)
    .bind(&body.description)
    .bind(&measurable_elements)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Accreditation Compliance handlers
// ══════════════════════════════════════════════════════════

pub async fn list_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListComplianceQuery>,
) -> Result<Json<Vec<QualityAccreditationCompliance>>, AppError> {
    require_permission(&claims, permissions::quality::accreditation::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(standard_id) = params.standard_id {
        sqlx::query_as::<_, QualityAccreditationCompliance>(
            "SELECT * FROM quality_accreditation_compliance \
             WHERE tenant_id = $1 AND standard_id = $2 \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(standard_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, QualityAccreditationCompliance>(
            "SELECT * FROM quality_accreditation_compliance \
             WHERE tenant_id = $1 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn update_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateComplianceRequest>,
) -> Result<Json<QualityAccreditationCompliance>, AppError> {
    require_permission(&claims, permissions::quality::accreditation::MANAGE)?;

    let target_date = body.target_date.as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let evidence_documents = body.evidence_documents.clone()
        .unwrap_or(serde_json::json!([]));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityAccreditationCompliance>(
        "INSERT INTO quality_accreditation_compliance \
         (tenant_id, standard_id, compliance, evidence_summary, \
          evidence_documents, gap_description, action_plan, \
          responsible_person_id, target_date, assessed_at, assessed_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10) \
         ON CONFLICT (tenant_id, standard_id) DO UPDATE SET \
         compliance = EXCLUDED.compliance, \
         evidence_summary = EXCLUDED.evidence_summary, \
         evidence_documents = EXCLUDED.evidence_documents, \
         gap_description = EXCLUDED.gap_description, \
         action_plan = EXCLUDED.action_plan, \
         responsible_person_id = EXCLUDED.responsible_person_id, \
         target_date = EXCLUDED.target_date, \
         assessed_at = now(), \
         assessed_by = EXCLUDED.assessed_by, \
         updated_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.standard_id)
    .bind(body.compliance)
    .bind(&body.evidence_summary)
    .bind(&evidence_documents)
    .bind(&body.gap_description)
    .bind(&body.action_plan)
    .bind(body.responsible_person_id)
    .bind(target_date)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Audit handlers
// ══════════════════════════════════════════════════════════

pub async fn list_audits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAuditsQuery>,
) -> Result<Json<Vec<QualityAudit>>, AppError> {
    require_permission(&claims, permissions::quality::audits::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.status, &params.department_id) {
        (Some(status), Some(dept_id)) => {
            sqlx::query_as::<_, QualityAudit>(
                "SELECT * FROM quality_audits \
                 WHERE tenant_id = $1 AND status = $2 AND department_id = $3 \
                 ORDER BY audit_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .bind(dept_id)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(status), None) => {
            sqlx::query_as::<_, QualityAudit>(
                "SELECT * FROM quality_audits \
                 WHERE tenant_id = $1 AND status = $2 \
                 ORDER BY audit_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(dept_id)) => {
            sqlx::query_as::<_, QualityAudit>(
                "SELECT * FROM quality_audits \
                 WHERE tenant_id = $1 AND department_id = $2 \
                 ORDER BY audit_date DESC",
            )
            .bind(claims.tenant_id)
            .bind(dept_id)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, QualityAudit>(
                "SELECT * FROM quality_audits \
                 WHERE tenant_id = $1 \
                 ORDER BY audit_date DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QualityAudit>, AppError> {
    require_permission(&claims, permissions::quality::audits::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityAudit>(
        "SELECT * FROM quality_audits WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAuditRequest>,
) -> Result<Json<QualityAudit>, AppError> {
    require_permission(&claims, permissions::quality::audits::CREATE)?;

    let audit_date = chrono::NaiveDate::parse_from_str(&body.audit_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid audit_date format, expected YYYY-MM-DD".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let audit_number = generate_number(&mut tx, &claims.tenant_id, "AUDIT", "AUD").await?;

    let row = sqlx::query_as::<_, QualityAudit>(
        "INSERT INTO quality_audits \
         (tenant_id, audit_number, audit_type, title, scope, \
          department_id, auditor_id, audit_date) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&audit_number)
    .bind(&body.audit_type)
    .bind(&body.title)
    .bind(&body.scope)
    .bind(body.department_id)
    .bind(claims.sub)
    .bind(audit_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAuditRequest>,
) -> Result<Json<QualityAudit>, AppError> {
    require_permission(&claims, permissions::quality::audits::CREATE)?;

    let report_date = body.report_date.as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, QualityAudit>(
        "UPDATE quality_audits SET \
         findings = COALESCE($3, findings), \
         non_conformities = COALESCE($4, non_conformities), \
         observations = COALESCE($5, observations), \
         opportunities = COALESCE($6, opportunities), \
         overall_score = COALESCE($7, overall_score), \
         status = COALESCE($8, status), \
         report_date = COALESCE($9, report_date), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.findings)
    .bind(body.non_conformities)
    .bind(body.observations)
    .bind(body.opportunities)
    .bind(body.overall_score)
    .bind(&body.status)
    .bind(report_date)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Indicator auto-calculation handler
// ══════════════════════════════════════════════════════════

pub async fn calculate_indicator(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::quality::indicators::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify indicator exists
    let _indicator = sqlx::query_as::<_, QualityIndicator>(
        "SELECT * FROM quality_indicators WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // For auto-calculated indicators, compute based on recent period
    let now = chrono::Utc::now();
    let period_start = (now - chrono::Duration::days(30)).date_naive();
    let period_end = now.date_naive();

    // Count-based calculation: count of existing values in the period
    let value = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM quality_indicator_values \
         WHERE indicator_id = $1 AND tenant_id = $2 AND period_start >= $3",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(period_start)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or(0);

    let calculated = Decimal::from(value);

    // Store the calculated value
    let row = sqlx::query_as::<_, QualityIndicatorValue>(
        "INSERT INTO quality_indicator_values \
         (tenant_id, indicator_id, period_start, period_end, calculated_value, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(period_start)
    .bind(period_end)
    .bind(calculated)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"indicator_value": row})))
}

// ══════════════════════════════════════════════════════════
//  Document pending-acknowledgments handler
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingAckUser {
    pub user_id: Uuid,
    pub full_name: String,
}

pub async fn list_pending_acks(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PendingAckUser>>, AppError> {
    require_permission(&claims, permissions::quality::documents::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify document exists
    let _doc = sqlx::query_as::<_, QualityDocument>(
        "SELECT * FROM quality_documents WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let rows = sqlx::query_as::<_, PendingAckUser>(
        "SELECT u.id AS user_id, u.full_name \
         FROM users u \
         WHERE u.tenant_id = $1 AND u.is_active = true \
           AND u.id NOT IN ( \
             SELECT a.user_id FROM quality_document_acknowledgments a \
             WHERE a.document_id = $2 \
           ) \
         ORDER BY u.full_name",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Committee auto-schedule meetings handler
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct AutoScheduleRequest {
    pub months_ahead: Option<i32>,
}

pub async fn auto_schedule_meetings(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<AutoScheduleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::quality::committees::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let committee = sqlx::query_as::<_, QualityCommittee>(
        "SELECT * FROM quality_committees WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let months = body.months_ahead.unwrap_or(3);
    let mut created = 0i32;
    let now = chrono::Utc::now();

    let interval_days: i64 = match committee.meeting_frequency {
        CommitteeFrequency::Weekly => 7,
        CommitteeFrequency::Biweekly => 14,
        CommitteeFrequency::Monthly => 30,
        CommitteeFrequency::Quarterly => 90,
        CommitteeFrequency::Biannual => 182,
        CommitteeFrequency::Annual => 365,
        CommitteeFrequency::AsNeeded => {
            // Cannot auto-schedule as-needed meetings
            tx.commit().await?;
            return Ok(Json(serde_json::json!({"meetings_created": 0})));
        }
    };

    let end_date = now + chrono::Duration::days(i64::from(months) * 30);
    let mut meeting_date = now + chrono::Duration::days(interval_days);

    while meeting_date <= end_date {
        // Check if meeting already exists on that date
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM quality_committee_meetings \
             WHERE committee_id = $1 AND tenant_id = $2 \
             AND scheduled_date::date = $3::date",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .bind(meeting_date)
        .fetch_one(&mut *tx)
        .await?;

        if exists == 0 {
            sqlx::query(
                "INSERT INTO quality_committee_meetings \
                 (tenant_id, committee_id, scheduled_date, status) \
                 VALUES ($1, $2, $3, 'scheduled')",
            )
            .bind(claims.tenant_id)
            .bind(id)
            .bind(meeting_date)
            .execute(&mut *tx)
            .await?;
            created += 1;
        }
        meeting_date += chrono::Duration::days(interval_days);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({"meetings_created": created})))
}

// ══════════════════════════════════════════════════════════
//  Accreditation evidence compilation handler
// ══════════════════════════════════════════════════════════

pub async fn compile_evidence(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(body): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::quality::accreditation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Count total standards for this accreditation body
    let total_standards = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM quality_accreditation_standards \
         WHERE tenant_id = $1 AND body = $2::accreditation_body",
    )
    .bind(claims.tenant_id)
    .bind(&body)
    .fetch_one(&mut *tx)
    .await?;

    // Count compliant standards
    let compliant_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM quality_accreditation_compliance c \
         JOIN quality_accreditation_standards s ON s.id = c.standard_id \
         WHERE s.tenant_id = $1 AND s.body = $2::accreditation_body \
         AND c.compliance = 'compliant'::compliance_status",
    )
    .bind(claims.tenant_id)
    .bind(&body)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch non-compliant items
    let non_compliant = sqlx::query_as::<_, QualityAccreditationCompliance>(
        "SELECT c.* FROM quality_accreditation_compliance c \
         JOIN quality_accreditation_standards s ON s.id = c.standard_id \
         WHERE s.tenant_id = $1 AND s.body = $2::accreditation_body \
         AND c.compliance != 'compliant'::compliance_status \
         ORDER BY c.updated_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(&body)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let compliance_rate = if total_standards > 0 {
        #[allow(clippy::cast_precision_loss)]
        let rate = compliant_count as f64 / total_standards as f64 * 100.0;
        rate
    } else {
        0.0
    };

    Ok(Json(serde_json::json!({
        "accreditation_body": body,
        "total_standards": total_standards,
        "compliant_count": compliant_count,
        "compliance_rate": compliance_rate,
        "non_compliant_items": non_compliant
    })))
}

// ══════════════════════════════════════════════════════════
//  Extended handlers — Analytics & Reporting
// ══════════════════════════════════════════════════════════

// ── Request types ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ScheduleAuditsRequest {
    pub audit_type: String,
    pub department_id: Option<Uuid>,
    pub start_date: String,
    pub end_date: String,
    pub frequency_days: i32,
    pub title_prefix: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAuditFindingRequest {
    pub title: String,
    pub description: Option<String>,
    pub incident_type: String,
    pub severity: IncidentSeverity,
    pub location: Option<String>,
    pub immediate_action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMortalityReviewRequest {
    pub patient_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub department_id: Option<Uuid>,
    pub incident_date: String,
    pub root_cause: Option<String>,
    pub contributing_factors: Option<serde_json::Value>,
    pub preventability: Option<String>,
    pub lessons_learned: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AnalyticsDateRangeQuery {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub department_id: Option<Uuid>,
}

// ── Response row types ───────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OverdueCapaRow {
    pub id: Uuid,
    pub capa_number: String,
    pub incident_id: Uuid,
    pub capa_type: String,
    pub description: Option<String>,
    pub action_plan: Option<String>,
    pub assigned_to: Uuid,
    pub due_date: chrono::NaiveDate,
    pub status: String,
    pub days_overdue: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CommitteeDashboardRow {
    pub committee_id: Uuid,
    pub committee_name: String,
    pub total_scheduled: i64,
    pub total_held: i64,
    pub open_action_items: i64,
    pub closed_action_items: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PsiRow {
    pub indicator_type: String,
    pub event_count: i64,
    pub total_patient_days: Option<i64>,
    pub rate_per_1000: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeptScorecardRow {
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub indicator_count: i64,
    pub avg_value: Option<f64>,
    pub indicators_on_target: i64,
    pub indicators_warning: i64,
    pub indicators_critical: i64,
}

// ── 1. Schedule Audits ───────────────────────────────────

pub async fn schedule_audits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ScheduleAuditsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::quality::audits::CREATE)?;

    let start = chrono::NaiveDate::parse_from_str(&body.start_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid start_date format, expected YYYY-MM-DD".into()))?;
    let end = chrono::NaiveDate::parse_from_str(&body.end_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid end_date format, expected YYYY-MM-DD".into()))?;

    let prefix = body.title_prefix.as_deref().unwrap_or("Scheduled Audit");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut created = 0i32;
    let mut current = start;

    while current <= end {
        let audit_number = generate_number(&mut tx, &claims.tenant_id, "AUDIT", "AUD").await?;
        let title = format!("{prefix} - {current}");

        sqlx::query(
            "INSERT INTO quality_audits \
             (tenant_id, audit_number, audit_type, title, department_id, \
              auditor_id, audit_date, status) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled')",
        )
        .bind(claims.tenant_id)
        .bind(&audit_number)
        .bind(&body.audit_type)
        .bind(&title)
        .bind(body.department_id)
        .bind(claims.sub)
        .bind(current)
        .execute(&mut *tx)
        .await?;

        created += 1;
        current += chrono::Duration::days(i64::from(body.frequency_days));
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({"audits_scheduled": created})))
}

// ── 2. Audit Findings ────────────────────────────────────

pub async fn list_audit_findings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(audit_id): Path<Uuid>,
) -> Result<Json<Vec<QualityIncident>>, AppError> {
    require_permission(&claims, permissions::quality::audits::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Findings are incidents linked to an audit via contributing_factors JSONB
    let rows = sqlx::query_as::<_, QualityIncident>(
        "SELECT * FROM quality_incidents \
         WHERE tenant_id = $1 \
         AND (contributing_factors @> $2::jsonb \
              OR incident_type LIKE '%audit%') \
         ORDER BY incident_date DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(serde_json::json!({"audit_id": audit_id}))
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_audit_finding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(audit_id): Path<Uuid>,
    Json(body): Json<CreateAuditFindingRequest>,
) -> Result<Json<QualityIncident>, AppError> {
    require_permission(&claims, permissions::quality::audits::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify audit exists
    let _audit = sqlx::query_as::<_, QualityAudit>(
        "SELECT * FROM quality_audits WHERE id = $1 AND tenant_id = $2",
    )
    .bind(audit_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let incident_number = generate_number(&mut tx, &claims.tenant_id, "INC", "INC").await?;
    let contributing = serde_json::json!({"audit_id": audit_id});

    let row = sqlx::query_as::<_, QualityIncident>(
        "INSERT INTO quality_incidents \
         (tenant_id, incident_number, title, description, incident_type, \
          severity, location, incident_date, reported_by, \
          immediate_action, contributing_factors) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&incident_number)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.incident_type)
    .bind(body.severity)
    .bind(&body.location)
    .bind(claims.sub)
    .bind(&body.immediate_action)
    .bind(&contributing)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── 3. Overdue CAPAs ────────────────────────────────────

pub async fn list_overdue_capas(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OverdueCapaRow>>, AppError> {
    require_permission(&claims, permissions::quality::capa::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OverdueCapaRow>(
        "SELECT id, capa_number, incident_id, capa_type, description, \
                action_plan, assigned_to, due_date, status::text AS status, \
                (CURRENT_DATE - due_date)::int AS days_overdue \
         FROM quality_capa \
         WHERE tenant_id = $1 \
         AND status NOT IN ('closed', 'verified') \
         AND due_date < CURRENT_DATE \
         ORDER BY due_date ASC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 4. Committee Dashboard ──────────────────────────────

pub async fn committee_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CommitteeDashboardRow>>, AppError> {
    require_permission(&claims, permissions::quality::committees::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CommitteeDashboardRow>(
        "SELECT c.id AS committee_id, \
                c.name AS committee_name, \
                COUNT(DISTINCT m.id) AS total_scheduled, \
                COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') AS total_held, \
                COALESCE(( \
                  SELECT COUNT(*) FROM quality_action_items ai \
                  WHERE ai.source_type = 'meeting' AND ai.status != 'closed' \
                    AND ai.tenant_id = $1 \
                ), 0) AS open_action_items, \
                COALESCE(( \
                  SELECT COUNT(*) FROM quality_action_items ai \
                  WHERE ai.source_type = 'meeting' AND ai.status = 'closed' \
                    AND ai.tenant_id = $1 \
                ), 0) AS closed_action_items \
         FROM quality_committees c \
         LEFT JOIN quality_committee_meetings m ON m.committee_id = c.id AND m.tenant_id = c.tenant_id \
         WHERE c.tenant_id = $1 \
         GROUP BY c.id, c.name \
         ORDER BY c.name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 5. Mortality Review ─────────────────────────────────

pub async fn create_mortality_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMortalityReviewRequest>,
) -> Result<Json<QualityIncident>, AppError> {
    require_permission(&claims, permissions::quality::incidents::CREATE)?;

    let incident_date = chrono::DateTime::parse_from_rfc3339(&body.incident_date)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(&body.incident_date, "%Y-%m-%d")
                .map(|d| {
                    d.and_hms_opt(0, 0, 0).map_or_else(chrono::Utc::now, |ndt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc))
                })
        })
        .map_err(|_| AppError::BadRequest("Invalid incident_date format".into()))?;

    let contributing = body.contributing_factors.clone().unwrap_or(serde_json::json!({
        "preventability": body.preventability,
        "lessons_learned": body.lessons_learned,
    }));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let incident_number = generate_number(&mut tx, &claims.tenant_id, "INC", "MR").await?;

    let row = sqlx::query_as::<_, QualityIncident>(
        "INSERT INTO quality_incidents \
         (tenant_id, incident_number, title, description, incident_type, \
          severity, department_id, incident_date, reported_by, \
          patient_id, root_cause, contributing_factors) \
         VALUES ($1,$2,$3,$4,'mortality_review',$5,$6,$7,$8,$9,$10,$11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&incident_number)
    .bind(&body.title)
    .bind(&body.description)
    .bind(IncidentSeverity::Sentinel)
    .bind(body.department_id)
    .bind(incident_date)
    .bind(claims.sub)
    .bind(body.patient_id)
    .bind(&body.root_cause)
    .bind(&contributing)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── 6. Sentinel Events ──────────────────────────────────

pub async fn list_sentinel_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QualityIncident>>, AppError> {
    require_permission(&claims, permissions::quality::incidents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, QualityIncident>(
        "SELECT * FROM quality_incidents \
         WHERE tenant_id = $1 \
         AND (severity = 'critical'::incident_severity \
              OR incident_type LIKE '%sentinel%') \
         ORDER BY incident_date DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 7. Patient Safety Indicators ────────────────────────

pub async fn patient_safety_indicators(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<PsiRow>>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().and_then(|d| {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()
    });
    let to = params.to_date.as_deref().and_then(|d| {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()
    });

    let rows = sqlx::query_as::<_, PsiRow>(
        "WITH psi_events AS ( \
           SELECT incident_type AS indicator_type, COUNT(*) AS event_count \
           FROM quality_incidents \
           WHERE tenant_id = $1 \
             AND incident_type IN ('fall', 'medication_error', 'pressure_injury', \
                                   'hospital_fall', 'adverse_drug_event') \
             AND ($2::date IS NULL OR incident_date >= $2::timestamptz) \
             AND ($3::date IS NULL OR incident_date <= $3::timestamptz) \
           GROUP BY incident_type \
         ), \
         pdays AS ( \
           SELECT COALESCE(SUM(patient_days), 0) AS total_patient_days \
           FROM infection_device_days \
           WHERE tenant_id = $1 \
             AND ($2::date IS NULL OR record_date >= $2::date) \
             AND ($3::date IS NULL OR record_date <= $3::date) \
         ) \
         SELECT e.indicator_type, e.event_count, \
                p.total_patient_days, \
                CASE WHEN p.total_patient_days > 0 \
                  THEN (e.event_count::float8 / p.total_patient_days::float8) * 1000.0 \
                  ELSE NULL END AS rate_per_1000 \
         FROM psi_events e, pdays p \
         ORDER BY e.event_count DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 8. Department Scorecard ─────────────────────────────

pub async fn department_scorecard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<DeptScorecardRow>>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().and_then(|d| {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()
    });
    let to = params.to_date.as_deref().and_then(|d| {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()
    });

    let rows = sqlx::query_as::<_, DeptScorecardRow>(
        "SELECT v.department_id, \
                MAX(d.name) AS department_name, \
                COUNT(DISTINCT v.indicator_id) AS indicator_count, \
                AVG(v.calculated_value)::float8 AS avg_value, \
                COUNT(*) FILTER (WHERE v.calculated_value >= i.target_value) AS indicators_on_target, \
                COUNT(*) FILTER ( \
                  WHERE v.calculated_value < i.target_value \
                    AND v.calculated_value >= COALESCE(i.threshold_warning, 0) \
                ) AS indicators_warning, \
                COUNT(*) FILTER ( \
                  WHERE v.calculated_value < COALESCE(i.threshold_warning, i.threshold_critical, 0) \
                ) AS indicators_critical \
         FROM quality_indicator_values v \
         JOIN quality_indicators i ON i.id = v.indicator_id AND i.tenant_id = v.tenant_id \
         LEFT JOIN departments d ON d.id = v.department_id \
         WHERE v.tenant_id = $1 \
           AND ($2::date IS NULL OR v.period_start >= $2::date) \
           AND ($3::date IS NULL OR v.period_end <= $3::date) \
           AND ($4::uuid IS NULL OR v.department_id = $4) \
         GROUP BY v.department_id \
         ORDER BY avg_value DESC NULLS LAST",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
