#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_core::quality::AccreditationBody;
use medbrains_core::regulatory::{
    AccreditationScore, AdrReport, AdverseEventSeverity, AdverseEventStatus,
    ComplianceCalendarEvent, ComplianceChecklist, ComplianceChecklistItem,
    ComplianceChecklistStatus, ComplianceDashboard, ComplianceGap, DepartmentComplianceScore,
    MateriovigilanceReport, PcpndtForm, PcpndtFormStatus,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Checklists ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListChecklistsQuery {
    pub department_id: Option<Uuid>,
    pub accreditation_body: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChecklistRequest {
    pub department_id: Option<Uuid>,
    pub accreditation_body: AccreditationBody,
    pub standard_code: String,
    pub name: String,
    pub description: Option<String>,
    pub assessment_period_start: NaiveDate,
    pub assessment_period_end: NaiveDate,
    pub next_review_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistRequest {
    pub overall_status: Option<ComplianceChecklistStatus>,
    pub compliance_score: Option<f64>,
    pub next_review_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchChecklistItemRequest {
    pub items: Vec<ChecklistItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct ChecklistItemInput {
    pub id: Option<Uuid>,
    pub item_number: i32,
    pub criterion: String,
    pub status: ComplianceChecklistStatus,
    pub evidence_summary: Option<String>,
    pub evidence_documents: Option<Value>,
    pub gap_description: Option<String>,
    pub corrective_action: Option<String>,
    pub target_date: Option<NaiveDate>,
    pub responsible_user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistItemRequest {
    pub status: Option<ComplianceChecklistStatus>,
    pub evidence_summary: Option<String>,
    pub evidence_documents: Option<Value>,
    pub gap_description: Option<String>,
    pub corrective_action: Option<String>,
    pub target_date: Option<NaiveDate>,
    pub responsible_user_id: Option<Uuid>,
}

// ── ADR Reports ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAdrQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdrRequest {
    pub patient_id: Option<Uuid>,
    pub reporter_type: Option<String>,
    pub drug_name: String,
    pub drug_generic_name: Option<String>,
    pub drug_batch_number: Option<String>,
    pub manufacturer: Option<String>,
    pub reaction_description: String,
    pub onset_date: Option<NaiveDate>,
    pub reaction_date: NaiveDate,
    pub severity: AdverseEventSeverity,
    pub outcome: Option<String>,
    pub causality_assessment: Option<String>,
    pub seriousness_criteria: Option<Value>,
    pub dechallenge: Option<String>,
    pub rechallenge: Option<String>,
    pub concomitant_drugs: Option<Value>,
    pub relevant_history: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAdrRequest {
    pub reaction_description: Option<String>,
    pub severity: Option<AdverseEventSeverity>,
    pub outcome: Option<String>,
    pub causality_assessment: Option<String>,
    pub status: Option<AdverseEventStatus>,
    pub seriousness_criteria: Option<Value>,
    pub dechallenge: Option<String>,
    pub rechallenge: Option<String>,
    pub concomitant_drugs: Option<Value>,
    pub relevant_history: Option<String>,
}

// ── Materiovigilance ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListMvQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMvRequest {
    pub patient_id: Option<Uuid>,
    pub device_name: String,
    pub device_manufacturer: Option<String>,
    pub device_model: Option<String>,
    pub device_batch: Option<String>,
    pub event_description: String,
    pub event_date: NaiveDate,
    pub severity: AdverseEventSeverity,
    pub patient_outcome: Option<String>,
    pub device_action: Option<String>,
    pub investigation_findings: Option<String>,
    pub corrective_action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMvRequest {
    pub event_description: Option<String>,
    pub severity: Option<AdverseEventSeverity>,
    pub patient_outcome: Option<String>,
    pub device_action: Option<String>,
    pub status: Option<AdverseEventStatus>,
    pub investigation_findings: Option<String>,
    pub corrective_action: Option<String>,
}

// ── PCPNDT ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPcpndtQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePcpndtRequest {
    pub patient_id: Uuid,
    pub referral_doctor_id: Option<Uuid>,
    pub performing_doctor_id: Uuid,
    pub procedure_type: String,
    pub indication: String,
    pub gestational_age_weeks: Option<i32>,
    pub lmp_date: Option<NaiveDate>,
    pub declaration_text: Option<String>,
    pub patient_consent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePcpndtRequest {
    pub status: Option<PcpndtFormStatus>,
    pub registered_with: Option<String>,
    pub registration_date: Option<NaiveDate>,
    pub quarterly_report_included: Option<bool>,
}

// ── Compliance Calendar ──────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCalendarQuery {
    pub status: Option<String>,
    pub department_id: Option<Uuid>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCalendarRequest {
    pub title: String,
    pub description: Option<String>,
    pub regulatory_body_id: Option<Uuid>,
    pub event_type: String,
    pub due_date: NaiveDate,
    pub reminder_days: Option<Vec<i32>>,
    pub department_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub recurrence: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCalendarRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<NaiveDate>,
    pub status: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub recurrence: Option<String>,
}

// ── Dashboard query ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DeptDashboardQuery {
    pub department_id: Option<Uuid>,
}

// ── Internal row types ─────────────────────────────────

#[derive(sqlx::FromRow)]
struct GapRow {
    id: Uuid,
    name: String,
    department_id: Option<Uuid>,
    department_name: Option<String>,
    accreditation_body: String,
    non_compliant_items: i64,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Dashboard
// ══════════════════════════════════════════════════════════

pub async fn dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ComplianceDashboard>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Accreditation scores from quality_accreditation_compliance
    let acc_rows: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT s.accreditation_body::text, \
                COUNT(*), \
                COUNT(*) FILTER (WHERE c.status = 'compliant') \
         FROM quality_accreditation_standards s \
         LEFT JOIN quality_accreditation_compliance c ON c.standard_id = s.id \
         WHERE s.tenant_id = $1 \
         GROUP BY s.accreditation_body",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let accreditation_scores: Vec<AccreditationScore> = acc_rows
        .iter()
        .map(|(body, total, compliant)| {
            let t = *total;
            let c = *compliant;
            AccreditationScore {
                body: body.clone(),
                total_standards: t,
                compliant: c,
                non_compliant: t - c,
                score_percent: if t > 0 {
                    (c as f64 / t as f64) * 100.0
                } else {
                    0.0
                },
            }
        })
        .collect();

    // Department-wise checklist scores
    let dept_rows: Vec<(Uuid, String, f64, i64)> = sqlx::query_as(
        "SELECT cl.department_id, COALESCE(d.name, 'Organization-wide'), \
                COALESCE(AVG(cl.compliance_score), 0)::float8, COUNT(*) \
         FROM compliance_checklists cl \
         LEFT JOIN departments d ON d.id = cl.department_id \
         WHERE cl.tenant_id = $1 \
         GROUP BY cl.department_id, d.name \
         ORDER BY d.name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let department_scores: Vec<DepartmentComplianceScore> = dept_rows
        .into_iter()
        .map(|(dept_id, name, avg, count)| DepartmentComplianceScore {
            department_id: dept_id,
            department_name: name,
            avg_score: avg,
            checklist_count: count,
        })
        .collect();

    // Upcoming deadlines (next 30 days)
    let upcoming_deadlines: Vec<ComplianceCalendarEvent> =
        sqlx::query_as::<_, ComplianceCalendarEvent>(
            "SELECT * FROM compliance_calendar \
         WHERE tenant_id = $1 AND status IN ('upcoming', 'overdue') \
         AND due_date <= CURRENT_DATE + INTERVAL '30 days' \
         ORDER BY due_date LIMIT 20",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

    // Overdue count
    let overdue_items: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM compliance_calendar \
         WHERE tenant_id = $1 AND status = 'overdue'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    // Checklist counts
    let total_checklists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM compliance_checklists WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(0);

    let compliant_checklists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM compliance_checklists \
         WHERE tenant_id = $1 AND overall_status = 'compliant'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    // License expiry within 90 days
    let license_expiring_soon: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM facility_regulatory_licenses \
         WHERE tenant_id = $1 AND valid_until IS NOT NULL \
         AND valid_until <= CURRENT_DATE + INTERVAL '90 days' \
         AND valid_until > CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    tx.commit().await?;

    Ok(Json(ComplianceDashboard {
        accreditation_scores,
        department_scores,
        upcoming_deadlines,
        overdue_items,
        total_checklists,
        compliant_checklists,
        license_expiring_soon,
    }))
}

pub async fn department_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(dept_id): Path<Uuid>,
) -> Result<Json<Vec<ComplianceChecklist>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ComplianceChecklist>(
        "SELECT * FROM compliance_checklists \
         WHERE tenant_id = $1 AND department_id = $2 \
         ORDER BY assessment_period_start DESC",
    )
    .bind(claims.tenant_id)
    .bind(dept_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn dashboard_gaps(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ComplianceGap>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let gap_rows: Vec<GapRow> = sqlx::query_as(
        "SELECT cl.id, cl.name, cl.department_id, d.name AS department_name, \
                cl.accreditation_body::text, cl.non_compliant_items \
         FROM compliance_checklists cl \
         LEFT JOIN departments d ON d.id = cl.department_id \
         WHERE cl.tenant_id = $1 AND cl.non_compliant_items > 0 \
         ORDER BY cl.non_compliant_items DESC LIMIT 20",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut gaps = Vec::new();
    for row in &gap_rows {
        // Fetch gap descriptions for this checklist
        let descs: Vec<(String,)> = sqlx::query_as(
            "SELECT COALESCE(gap_description, criterion) \
             FROM compliance_checklist_items \
             WHERE checklist_id = $1 AND status = 'non_compliant' \
             LIMIT 5",
        )
        .bind(row.id)
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

        gaps.push(ComplianceGap {
            checklist_id: row.id,
            checklist_name: row.name.clone(),
            department_id: row.department_id,
            department_name: row.department_name.clone(),
            accreditation_body: row.accreditation_body.clone(),
            non_compliant_items: row.non_compliant_items,
            gap_descriptions: descs.into_iter().map(|(d,)| d).collect(),
        });
    }

    tx.commit().await?;
    Ok(Json(gaps))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Checklists
// ══════════════════════════════════════════════════════════

pub async fn list_checklists(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListChecklistsQuery>,
) -> Result<Json<Vec<ComplianceChecklist>>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut sql = String::from("SELECT * FROM compliance_checklists WHERE tenant_id = $1");
    let mut param_idx = 2u32;

    if params.department_id.is_some() {
        sql.push_str(&format!(" AND department_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.accreditation_body.is_some() {
        sql.push_str(&format!(" AND accreditation_body::text = ${param_idx}"));
        param_idx += 1;
    }
    if params.status.is_some() {
        sql.push_str(&format!(" AND overall_status::text = ${param_idx}"));
        let _ = param_idx;
    }
    sql.push_str(" ORDER BY assessment_period_start DESC LIMIT 200");

    let mut q = sqlx::query_as::<_, ComplianceChecklist>(&sql).bind(claims.tenant_id);

    if let Some(ref dept) = params.department_id {
        q = q.bind(dept);
    }
    if let Some(ref body) = params.accreditation_body {
        q = q.bind(body);
    }
    if let Some(ref status) = params.status {
        q = q.bind(status);
    }

    let rows = q.fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateChecklistRequest>,
) -> Result<Json<ComplianceChecklist>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceChecklist>(
        "INSERT INTO compliance_checklists \
         (tenant_id, department_id, accreditation_body, standard_code, \
          name, description, assessment_period_start, assessment_period_end, \
          next_review_date, notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.accreditation_body)
    .bind(&body.standard_code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.assessment_period_start)
    .bind(body.assessment_period_end)
    .bind(body.next_review_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let checklist = sqlx::query_as::<_, ComplianceChecklist>(
        "SELECT * FROM compliance_checklists WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, ComplianceChecklistItem>(
        "SELECT * FROM compliance_checklist_items \
         WHERE checklist_id = $1 AND tenant_id = $2 \
         ORDER BY item_number",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let mut result =
        serde_json::to_value(&checklist).map_err(|e| AppError::Internal(e.to_string()))?;
    result["items"] =
        serde_json::to_value(&items).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Json(result))
}

pub async fn update_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChecklistRequest>,
) -> Result<Json<ComplianceChecklist>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceChecklist>(
        "UPDATE compliance_checklists SET \
         overall_status = COALESCE($3, overall_status), \
         compliance_score = COALESCE($4, compliance_score), \
         next_review_date = COALESCE($5, next_review_date), \
         notes = COALESCE($6, notes), \
         assessed_by = $7, \
         assessed_at = CASE WHEN $3 IS NOT NULL THEN now() ELSE assessed_at END, \
         updated_by = $7 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.overall_status)
    .bind(body.compliance_score)
    .bind(body.next_review_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn batch_checklist_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(checklist_id): Path<Uuid>,
    Json(body): Json<BatchChecklistItemRequest>,
) -> Result<Json<Vec<ComplianceChecklistItem>>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut results = Vec::new();
    let mut compliant = 0i32;
    let mut non_compliant = 0i32;
    let total = body.items.len() as i32;

    for item in &body.items {
        let row = if let Some(existing_id) = item.id {
            sqlx::query_as::<_, ComplianceChecklistItem>(
                "UPDATE compliance_checklist_items SET \
                 item_number = $3, criterion = $4, status = $5, \
                 evidence_summary = COALESCE($6, evidence_summary), \
                 evidence_documents = COALESCE($7, evidence_documents), \
                 gap_description = $8, corrective_action = $9, \
                 target_date = $10, responsible_user_id = $11 \
                 WHERE id = $1 AND tenant_id = $2 \
                 RETURNING *",
            )
            .bind(existing_id)
            .bind(claims.tenant_id)
            .bind(item.item_number)
            .bind(&item.criterion)
            .bind(item.status)
            .bind(&item.evidence_summary)
            .bind(&item.evidence_documents)
            .bind(&item.gap_description)
            .bind(&item.corrective_action)
            .bind(item.target_date)
            .bind(item.responsible_user_id)
            .fetch_one(&mut *tx)
            .await?
        } else {
            sqlx::query_as::<_, ComplianceChecklistItem>(
                "INSERT INTO compliance_checklist_items \
                 (tenant_id, checklist_id, item_number, criterion, status, \
                  evidence_summary, evidence_documents, gap_description, \
                  corrective_action, target_date, responsible_user_id, created_by) \
                 VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'[]'),$8,$9,$10,$11,$12) \
                 RETURNING *",
            )
            .bind(claims.tenant_id)
            .bind(checklist_id)
            .bind(item.item_number)
            .bind(&item.criterion)
            .bind(item.status)
            .bind(&item.evidence_summary)
            .bind(&item.evidence_documents)
            .bind(&item.gap_description)
            .bind(&item.corrective_action)
            .bind(item.target_date)
            .bind(item.responsible_user_id)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?
        };

        match row.status {
            ComplianceChecklistStatus::Compliant => compliant += 1,
            ComplianceChecklistStatus::NonCompliant => non_compliant += 1,
            _ => {}
        }
        results.push(row);
    }

    // Update parent checklist counters
    sqlx::query(
        "UPDATE compliance_checklists SET \
         total_items = $3, compliant_items = $4, non_compliant_items = $5, \
         updated_by = $6 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .bind(total)
    .bind(compliant)
    .bind(non_compliant)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(results))
}

pub async fn update_checklist_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((checklist_id, item_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateChecklistItemRequest>,
) -> Result<Json<ComplianceChecklistItem>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceChecklistItem>(
        "UPDATE compliance_checklist_items SET \
         status = COALESCE($3, status), \
         evidence_summary = COALESCE($4, evidence_summary), \
         evidence_documents = COALESCE($5, evidence_documents), \
         gap_description = COALESCE($6, gap_description), \
         corrective_action = COALESCE($7, corrective_action), \
         target_date = COALESCE($8, target_date), \
         responsible_user_id = COALESCE($9, responsible_user_id), \
         verified_by = CASE WHEN $3 = 'compliant' THEN $10 ELSE verified_by END, \
         verified_at = CASE WHEN $3 = 'compliant' THEN now() ELSE verified_at END \
         WHERE id = $1 AND checklist_id = $2 AND tenant_id = $11 \
         RETURNING *",
    )
    .bind(item_id)
    .bind(checklist_id)
    .bind(body.status)
    .bind(&body.evidence_summary)
    .bind(&body.evidence_documents)
    .bind(&body.gap_description)
    .bind(&body.corrective_action)
    .bind(body.target_date)
    .bind(body.responsible_user_id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — ADR Reports
// ══════════════════════════════════════════════════════════

pub async fn list_adr_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAdrQuery>,
) -> Result<Json<Vec<AdrReport>>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut sql = String::from("SELECT * FROM adr_reports WHERE tenant_id = $1");
    let mut param_idx = 2u32;

    if params.status.is_some() {
        sql.push_str(&format!(" AND status::text = ${param_idx}"));
        param_idx += 1;
    }
    if params.severity.is_some() {
        sql.push_str(&format!(" AND severity::text = ${param_idx}"));
        let _ = param_idx;
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT 200");

    let mut q = sqlx::query_as::<_, AdrReport>(&sql).bind(claims.tenant_id);
    if let Some(ref status) = params.status {
        q = q.bind(status);
    }
    if let Some(ref severity) = params.severity {
        q = q.bind(severity);
    }

    let rows = q.fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_adr_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAdrRequest>,
) -> Result<Json<AdrReport>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let report_number = format!(
        "ADR-{}-{:04X}",
        now.format("%Y%m%d"),
        now.timestamp_subsec_millis()
    );

    let row = sqlx::query_as::<_, AdrReport>(
        "INSERT INTO adr_reports \
         (tenant_id, report_number, patient_id, reporter_id, reporter_type, \
          drug_name, drug_generic_name, drug_batch_number, manufacturer, \
          reaction_description, onset_date, reaction_date, severity, \
          outcome, causality_assessment, \
          seriousness_criteria, dechallenge, rechallenge, \
          concomitant_drugs, relevant_history, created_by) \
         VALUES ($1,$2,$3,$4,COALESCE($5,'doctor'),$6,$7,$8,$9,$10,$11,$12,$13,\
                 $14,$15,COALESCE($16,'[]'),\
                 $17,$18,COALESCE($19,'[]'),$20,$4) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&report_number)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(&body.reporter_type)
    .bind(&body.drug_name)
    .bind(&body.drug_generic_name)
    .bind(&body.drug_batch_number)
    .bind(&body.manufacturer)
    .bind(&body.reaction_description)
    .bind(body.onset_date)
    .bind(body.reaction_date)
    .bind(body.severity)
    .bind(&body.outcome)
    .bind(&body.causality_assessment)
    .bind(&body.seriousness_criteria)
    .bind(&body.dechallenge)
    .bind(&body.rechallenge)
    .bind(&body.concomitant_drugs)
    .bind(&body.relevant_history)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_adr_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AdrReport>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdrReport>(
        "SELECT * FROM adr_reports WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_adr_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAdrRequest>,
) -> Result<Json<AdrReport>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdrReport>(
        "UPDATE adr_reports SET \
         reaction_description = COALESCE($3, reaction_description), \
         severity = COALESCE($4, severity), \
         outcome = COALESCE($5, outcome), \
         causality_assessment = COALESCE($6, causality_assessment), \
         status = COALESCE($7, status), \
         seriousness_criteria = COALESCE($8, seriousness_criteria), \
         dechallenge = COALESCE($9, dechallenge), \
         rechallenge = COALESCE($10, rechallenge), \
         concomitant_drugs = COALESCE($11, concomitant_drugs), \
         relevant_history = COALESCE($12, relevant_history), \
         updated_by = $13 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.reaction_description)
    .bind(body.severity)
    .bind(&body.outcome)
    .bind(&body.causality_assessment)
    .bind(body.status)
    .bind(&body.seriousness_criteria)
    .bind(&body.dechallenge)
    .bind(&body.rechallenge)
    .bind(&body.concomitant_drugs)
    .bind(&body.relevant_history)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn submit_adr_to_pvpi(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AdrReport>, AppError> {
    require_permission(&claims, permissions::regulatory::adr::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AdrReport>(
        "UPDATE adr_reports SET \
         status = 'submitted', \
         submitted_to_pvpi = true, \
         submitted_at = now(), \
         updated_by = $3 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Materiovigilance
// ══════════════════════════════════════════════════════════

pub async fn list_mv_reports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMvQuery>,
) -> Result<Json<Vec<MateriovigilanceReport>>, AppError> {
    require_permission(&claims, permissions::regulatory::materiovigilance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, MateriovigilanceReport>(
            "SELECT * FROM materiovigilance_reports \
             WHERE tenant_id = $1 AND status::text = $2 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, MateriovigilanceReport>(
            "SELECT * FROM materiovigilance_reports \
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

pub async fn create_mv_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMvRequest>,
) -> Result<Json<MateriovigilanceReport>, AppError> {
    require_permission(&claims, permissions::regulatory::materiovigilance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let report_number = format!(
        "MV-{}-{:04X}",
        now.format("%Y%m%d"),
        now.timestamp_subsec_millis()
    );

    let row = sqlx::query_as::<_, MateriovigilanceReport>(
        "INSERT INTO materiovigilance_reports \
         (tenant_id, report_number, patient_id, reporter_id, \
          device_name, device_manufacturer, device_model, device_batch, \
          event_description, event_date, severity, patient_outcome, \
          device_action, investigation_findings, corrective_action, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,\
                 COALESCE($13,'none'),$14,$15,$4) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&report_number)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(&body.device_name)
    .bind(&body.device_manufacturer)
    .bind(&body.device_model)
    .bind(&body.device_batch)
    .bind(&body.event_description)
    .bind(body.event_date)
    .bind(body.severity)
    .bind(&body.patient_outcome)
    .bind(&body.device_action)
    .bind(&body.investigation_findings)
    .bind(&body.corrective_action)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_mv_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MateriovigilanceReport>, AppError> {
    require_permission(&claims, permissions::regulatory::materiovigilance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MateriovigilanceReport>(
        "SELECT * FROM materiovigilance_reports WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_mv_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMvRequest>,
) -> Result<Json<MateriovigilanceReport>, AppError> {
    require_permission(&claims, permissions::regulatory::materiovigilance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MateriovigilanceReport>(
        "UPDATE materiovigilance_reports SET \
         event_description = COALESCE($3, event_description), \
         severity = COALESCE($4, severity), \
         patient_outcome = COALESCE($5, patient_outcome), \
         device_action = COALESCE($6, device_action), \
         status = COALESCE($7, status), \
         investigation_findings = COALESCE($8, investigation_findings), \
         corrective_action = COALESCE($9, corrective_action), \
         updated_by = $10 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.event_description)
    .bind(body.severity)
    .bind(&body.patient_outcome)
    .bind(&body.device_action)
    .bind(body.status)
    .bind(&body.investigation_findings)
    .bind(&body.corrective_action)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn submit_mv_to_cdsco(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MateriovigilanceReport>, AppError> {
    require_permission(&claims, permissions::regulatory::materiovigilance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MateriovigilanceReport>(
        "UPDATE materiovigilance_reports SET \
         status = 'submitted', \
         submitted_to_cdsco = true, \
         submitted_at = now(), \
         updated_by = $3 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — PCPNDT Forms
// ══════════════════════════════════════════════════════════

pub async fn list_pcpndt_forms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPcpndtQuery>,
) -> Result<Json<Vec<PcpndtForm>>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, PcpndtForm>(
            "SELECT * FROM pcpndt_forms \
             WHERE tenant_id = $1 AND status::text = $2 \
             ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PcpndtForm>(
            "SELECT * FROM pcpndt_forms \
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

pub async fn create_pcpndt_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePcpndtRequest>,
) -> Result<Json<PcpndtForm>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let form_number = format!(
        "PCPNDT-{}-{:04X}",
        now.format("%Y%m%d"),
        now.timestamp_subsec_millis()
    );

    let row = sqlx::query_as::<_, PcpndtForm>(
        "INSERT INTO pcpndt_forms \
         (tenant_id, form_number, patient_id, referral_doctor_id, \
          performing_doctor_id, procedure_type, indication, \
          gestational_age_weeks, lmp_date, declaration_text, \
          patient_consent_id, gender_disclosure_blocked, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&form_number)
    .bind(body.patient_id)
    .bind(body.referral_doctor_id)
    .bind(body.performing_doctor_id)
    .bind(&body.procedure_type)
    .bind(&body.indication)
    .bind(body.gestational_age_weeks)
    .bind(body.lmp_date)
    .bind(&body.declaration_text)
    .bind(body.patient_consent_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_pcpndt_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PcpndtForm>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PcpndtForm>(
        "SELECT * FROM pcpndt_forms WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_pcpndt_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePcpndtRequest>,
) -> Result<Json<PcpndtForm>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PcpndtForm>(
        "UPDATE pcpndt_forms SET \
         status = COALESCE($3, status), \
         registered_with = COALESCE($4, registered_with), \
         registration_date = COALESCE($5, registration_date), \
         quarterly_report_included = COALESCE($6, quarterly_report_included), \
         form_signed_at = CASE WHEN $3 = 'submitted' THEN now() \
                          ELSE form_signed_at END \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.status)
    .bind(&body.registered_with)
    .bind(body.registration_date)
    .bind(body.quarterly_report_included)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn pcpndt_quarterly_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let summary: Vec<(String, i64)> = sqlx::query_as(
        "SELECT procedure_type, COUNT(*) \
         FROM pcpndt_forms \
         WHERE tenant_id = $1 \
         AND created_at >= date_trunc('quarter', CURRENT_DATE) \
         GROUP BY procedure_type \
         ORDER BY procedure_type",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pcpndt_forms \
         WHERE tenant_id = $1 \
         AND created_at >= date_trunc('quarter', CURRENT_DATE)",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    tx.commit().await?;

    let by_type: Vec<Value> = summary
        .into_iter()
        .map(|(t, c)| serde_json::json!({"procedure_type": t, "count": c}))
        .collect();

    Ok(Json(serde_json::json!({
        "quarter_start": Utc::now().date_naive().format("%Y-%m-%d").to_string(),
        "total_forms": total,
        "by_procedure_type": by_type,
    })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Compliance Calendar
// ══════════════════════════════════════════════════════════

pub async fn list_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCalendarQuery>,
) -> Result<Json<Vec<ComplianceCalendarEvent>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut sql = String::from("SELECT * FROM compliance_calendar WHERE tenant_id = $1");
    let mut param_idx = 2u32;

    if params.status.is_some() {
        sql.push_str(&format!(" AND status = ${param_idx}"));
        param_idx += 1;
    }
    if params.department_id.is_some() {
        sql.push_str(&format!(" AND department_id = ${param_idx}"));
        param_idx += 1;
    }
    if params.from_date.is_some() {
        sql.push_str(&format!(" AND due_date >= ${param_idx}"));
        param_idx += 1;
    }
    if params.to_date.is_some() {
        sql.push_str(&format!(" AND due_date <= ${param_idx}"));
        let _ = param_idx;
    }
    sql.push_str(" ORDER BY due_date LIMIT 200");

    let mut q = sqlx::query_as::<_, ComplianceCalendarEvent>(&sql).bind(claims.tenant_id);
    if let Some(ref status) = params.status {
        q = q.bind(status);
    }
    if let Some(dept) = params.department_id {
        q = q.bind(dept);
    }
    if let Some(from) = params.from_date {
        q = q.bind(from);
    }
    if let Some(to) = params.to_date {
        q = q.bind(to);
    }

    let rows = q.fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_calendar_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCalendarRequest>,
) -> Result<Json<ComplianceCalendarEvent>, AppError> {
    require_permission(&claims, permissions::regulatory::calendar::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceCalendarEvent>(
        "INSERT INTO compliance_calendar \
         (tenant_id, title, description, regulatory_body_id, event_type, \
          due_date, reminder_days, department_id, assigned_to, \
          recurrence, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'{30,7,1}'),$8,$9,\
                 COALESCE($10,'once'),$11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.regulatory_body_id)
    .bind(&body.event_type)
    .bind(body.due_date)
    .bind(&body.reminder_days)
    .bind(body.department_id)
    .bind(body.assigned_to)
    .bind(&body.recurrence)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_calendar_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCalendarRequest>,
) -> Result<Json<ComplianceCalendarEvent>, AppError> {
    require_permission(&claims, permissions::regulatory::calendar::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceCalendarEvent>(
        "UPDATE compliance_calendar SET \
         title = COALESCE($3, title), \
         description = COALESCE($4, description), \
         due_date = COALESCE($5, due_date), \
         status = COALESCE($6, status), \
         assigned_to = COALESCE($7, assigned_to), \
         recurrence = COALESCE($8, recurrence), \
         completed_at = CASE WHEN $6 = 'completed' THEN now() \
                        ELSE completed_at END, \
         completed_by = CASE WHEN $6 = 'completed' THEN $9 \
                        ELSE completed_by END \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.due_date)
    .bind(&body.status)
    .bind(body.assigned_to)
    .bind(&body.recurrence)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn overdue_calendar(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ComplianceCalendarEvent>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Auto-update overdue items
    sqlx::query(
        "UPDATE compliance_calendar SET status = 'overdue' \
         WHERE tenant_id = $1 AND status = 'upcoming' \
         AND due_date < CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let rows = sqlx::query_as::<_, ComplianceCalendarEvent>(
        "SELECT * FROM compliance_calendar \
         WHERE tenant_id = $1 AND status = 'overdue' \
         ORDER BY due_date LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Extended handlers — Regulatory
// ══════════════════════════════════════════════════════════

// ── Request types ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateSubmissionRequest {
    pub title: String,
    pub description: Option<String>,
    pub regulatory_body_id: Option<Uuid>,
    pub due_date: NaiveDate,
    pub department_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub submission_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListSubmissionsQuery {
    pub status: Option<String>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMockSurveyRequest {
    pub department_id: Option<Uuid>,
    pub accreditation_body: AccreditationBody,
    pub standard_code: String,
    pub name: String,
    pub description: Option<String>,
    pub assessment_period_start: NaiveDate,
    pub assessment_period_end: NaiveDate,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListMockSurveysQuery {
    pub department_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StaffCredentialsQuery {
    pub department_id: Option<Uuid>,
    pub expiry_within_days: Option<i32>,
}

// ── Response row types ───────────────────────────────────

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AutoPopulateResult {
    pub item_id: Uuid,
    pub criterion: String,
    pub matched_standard: Option<String>,
    pub evidence_found: bool,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct StaffCredentialRow {
    pub employee_id: Uuid,
    pub employee_name: Option<String>,
    pub credential_type: String,
    pub credential_number: Option<String>,
    pub issuing_authority: Option<String>,
    pub issue_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub days_to_expiry: Option<i32>,
    pub is_expired: Option<bool>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct LicenseDashboardRow {
    pub id: Uuid,
    pub license_type: String,
    pub license_number: Option<String>,
    pub issuing_authority: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub days_to_expiry: Option<i32>,
    pub status: Option<String>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct NablDocumentRow {
    pub id: Uuid,
    pub document_type: String,
    pub document_name: Option<String>,
    pub status: Option<String>,
    pub uploaded_at: Option<chrono::DateTime<Utc>>,
    pub expiry_date: Option<NaiveDate>,
    pub days_to_expiry: Option<i32>,
}

// ── 1. Auto-populate Checklist ──────────────────────────

pub async fn auto_populate_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(checklist_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get checklist and its accreditation body
    let checklist = sqlx::query_as::<_, ComplianceChecklist>(
        "SELECT * FROM compliance_checklists WHERE id = $1 AND tenant_id = $2",
    )
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Get checklist items
    let items = sqlx::query_as::<_, ComplianceChecklistItem>(
        "SELECT * FROM compliance_checklist_items \
         WHERE checklist_id = $1 AND tenant_id = $2 \
         ORDER BY item_number",
    )
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut updated = 0i32;
    let body_str = serde_json::to_value(checklist.accreditation_body)
        .ok()
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default();

    for item in &items {
        // Try to find matching compliance evidence from quality_accreditation_compliance
        let evidence: Option<(String, String)> = sqlx::query_as(
            "SELECT c.evidence_summary, s.standard_code \
             FROM quality_accreditation_compliance c \
             JOIN quality_accreditation_standards s ON s.id = c.standard_id \
             WHERE s.tenant_id = $1 \
             AND s.body::text = $2 \
             AND c.compliance = 'compliant'::compliance_status \
             AND (s.standard_code ILIKE '%' || $3 || '%' \
                  OR s.standard_name ILIKE '%' || $3 || '%') \
             LIMIT 1",
        )
        .bind(claims.tenant_id)
        .bind(&body_str)
        .bind(&item.criterion)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((evidence_summary, _standard_code)) = evidence {
            sqlx::query(
                "UPDATE compliance_checklist_items SET \
                 status = 'compliant'::compliance_checklist_status, \
                 evidence_summary = COALESCE(evidence_summary, $3), \
                 verified_by = $4, verified_at = now() \
                 WHERE id = $1 AND tenant_id = $2 \
                 AND status != 'compliant'",
            )
            .bind(item.id)
            .bind(claims.tenant_id)
            .bind(&evidence_summary)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
            updated += 1;
        }
    }

    // Recount checklist stats
    let stats: (i64, i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), \
                COUNT(*) FILTER (WHERE status = 'compliant'), \
                COUNT(*) FILTER (WHERE status = 'non_compliant') \
         FROM compliance_checklist_items \
         WHERE checklist_id = $1 AND tenant_id = $2",
    )
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE compliance_checklists SET \
         total_items = $3, compliant_items = $4, non_compliant_items = $5, \
         updated_by = $6 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .bind(stats.0 as i32)
    .bind(stats.1 as i32)
    .bind(stats.2 as i32)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "checklist_id": checklist_id,
        "total_items": items.len(),
        "items_auto_populated": updated,
    })))
}

// ── 2. Submissions (via compliance_calendar with event_type='submission') ─

pub async fn list_submissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListSubmissionsQuery>,
) -> Result<Json<Vec<ComplianceCalendarEvent>>, AppError> {
    require_permission(&claims, permissions::regulatory::calendar::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.status, &params.department_id) {
        (Some(status), Some(dept)) => {
            sqlx::query_as::<_, ComplianceCalendarEvent>(
                "SELECT * FROM compliance_calendar \
                 WHERE tenant_id = $1 AND event_type = 'submission' \
                 AND status = $2 AND department_id = $3 \
                 ORDER BY due_date DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .bind(dept)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(status), None) => {
            sqlx::query_as::<_, ComplianceCalendarEvent>(
                "SELECT * FROM compliance_calendar \
                 WHERE tenant_id = $1 AND event_type = 'submission' \
                 AND status = $2 \
                 ORDER BY due_date DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(dept)) => {
            sqlx::query_as::<_, ComplianceCalendarEvent>(
                "SELECT * FROM compliance_calendar \
                 WHERE tenant_id = $1 AND event_type = 'submission' \
                 AND department_id = $2 \
                 ORDER BY due_date DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .bind(dept)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, ComplianceCalendarEvent>(
                "SELECT * FROM compliance_calendar \
                 WHERE tenant_id = $1 AND event_type = 'submission' \
                 ORDER BY due_date DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSubmissionRequest>,
) -> Result<Json<ComplianceCalendarEvent>, AppError> {
    require_permission(&claims, permissions::regulatory::calendar::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceCalendarEvent>(
        "INSERT INTO compliance_calendar \
         (tenant_id, title, description, regulatory_body_id, event_type, \
          due_date, department_id, assigned_to, recurrence, created_by) \
         VALUES ($1,$2,$3,$4,'submission',$5,$6,$7,COALESCE($8,'once'),$9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.regulatory_body_id)
    .bind(body.due_date)
    .bind(body.department_id)
    .bind(body.assigned_to)
    .bind(&body.submission_type)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── 3. Mock Surveys (via compliance_checklists) ─────────

pub async fn list_mock_surveys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMockSurveysQuery>,
) -> Result<Json<Vec<ComplianceChecklist>>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (&params.department_id, &params.status) {
        (Some(dept), Some(status)) => {
            sqlx::query_as::<_, ComplianceChecklist>(
                "SELECT * FROM compliance_checklists \
                 WHERE tenant_id = $1 \
                 AND (name ILIKE '%mock%survey%' OR description ILIKE '%mock%survey%') \
                 AND department_id = $2 AND overall_status::text = $3 \
                 ORDER BY assessment_period_start DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .bind(dept)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (Some(dept), None) => {
            sqlx::query_as::<_, ComplianceChecklist>(
                "SELECT * FROM compliance_checklists \
                 WHERE tenant_id = $1 \
                 AND (name ILIKE '%mock%survey%' OR description ILIKE '%mock%survey%') \
                 AND department_id = $2 \
                 ORDER BY assessment_period_start DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .bind(dept)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, Some(status)) => {
            sqlx::query_as::<_, ComplianceChecklist>(
                "SELECT * FROM compliance_checklists \
                 WHERE tenant_id = $1 \
                 AND (name ILIKE '%mock%survey%' OR description ILIKE '%mock%survey%') \
                 AND overall_status::text = $2 \
                 ORDER BY assessment_period_start DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, ComplianceChecklist>(
                "SELECT * FROM compliance_checklists \
                 WHERE tenant_id = $1 \
                 AND (name ILIKE '%mock%survey%' OR description ILIKE '%mock%survey%') \
                 ORDER BY assessment_period_start DESC LIMIT 200",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_mock_survey(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMockSurveyRequest>,
) -> Result<Json<ComplianceChecklist>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::CREATE)?;

    let name = if body.name.to_lowercase().contains("mock") {
        body.name.clone()
    } else {
        format!("Mock Survey - {}", body.name)
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceChecklist>(
        "INSERT INTO compliance_checklists \
         (tenant_id, department_id, accreditation_body, standard_code, \
          name, description, assessment_period_start, assessment_period_end, \
          notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.accreditation_body)
    .bind(&body.standard_code)
    .bind(&name)
    .bind(&body.description)
    .bind(body.assessment_period_start)
    .bind(body.assessment_period_end)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── 4. Staff Credentials ────────────────────────────────

pub async fn staff_credentials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<StaffCredentialsQuery>,
) -> Result<Json<Vec<StaffCredentialRow>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let expiry_days = params.expiry_within_days.unwrap_or(90);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, StaffCredentialRow>(
        "SELECT ec.employee_id, \
                e.first_name || ' ' || COALESCE(e.last_name, '') AS employee_name, \
                ec.credential_type, \
                ec.credential_number, \
                ec.issuing_authority, \
                ec.issue_date, \
                ec.expiry_date, \
                (ec.expiry_date - CURRENT_DATE)::int AS days_to_expiry, \
                (ec.expiry_date < CURRENT_DATE) AS is_expired \
         FROM employee_credentials ec \
         JOIN employees e ON e.id = ec.employee_id AND e.tenant_id = ec.tenant_id \
         WHERE ec.tenant_id = $1 \
           AND ec.expiry_date IS NOT NULL \
           AND ec.expiry_date <= CURRENT_DATE + ($2::int || ' days')::interval \
           AND ($3::uuid IS NULL OR e.department_id = $3) \
         ORDER BY ec.expiry_date ASC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(expiry_days)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 5. License Dashboard ────────────────────────────────

pub async fn license_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LicenseDashboardRow>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LicenseDashboardRow>(
        "SELECT id, license_type, license_number, issuing_authority, \
                valid_from, valid_until, \
                CASE WHEN valid_until IS NOT NULL \
                  THEN (valid_until - CURRENT_DATE)::int \
                  ELSE NULL END AS days_to_expiry, \
                status \
         FROM facility_regulatory_licenses \
         WHERE tenant_id = $1 \
         ORDER BY valid_until ASC NULLS LAST LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6. NABL Document Tracking ───────────────────────────

pub async fn nabl_document_tracking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<NablDocumentRow>>, AppError> {
    require_permission(&claims, permissions::regulatory::dashboard::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, NablDocumentRow>(
        "SELECT id, document_type, document_name, status, \
                uploaded_at, expiry_date, \
                CASE WHEN expiry_date IS NOT NULL \
                  THEN (expiry_date - CURRENT_DATE)::int \
                  ELSE NULL END AS days_to_expiry \
         FROM lab_nabl_documents \
         WHERE tenant_id = $1 \
         ORDER BY expiry_date ASC NULLS LAST LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
